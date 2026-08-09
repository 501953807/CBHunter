"""Content factory image export task execution tests."""

import asyncio
import io
import json

from PIL import Image
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.sourcing_item import SourcingItem
from app.services.content_asset_service import create_image_asset_from_bytes
from app.services.content_image_export_task_service import execute_image_export_tasks
from app.services.content_workbench_service import get_content_task_matrix


def _image_bytes(width=600, height=400):
    output = io.BytesIO()
    Image.new("RGB", (width, height), (20, 120, 180)).save(output, format="PNG")
    return output.getvalue()


def test_execute_image_export_tasks_creates_assets_and_updates_plan(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'image-export-tasks.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            source_asset = await create_image_asset_from_bytes(
                session,
                "content-user",
                _image_bytes(),
                {"width": 800, "height": 800, "output_format": "jpeg"},
                original_name="source-main.png",
                operation="image_edit",
                extra={"content_item_id": "seed"},
            )
            source_url = f"/api/v1/content/assets/{source_asset.id}/file"
            image_plan = {
                "schema": "listing_image_slots.v1",
                "product_id": "item-1",
                "publish_image_limit": 9,
                "publishable_image_count": 1,
                "retained_image_count": 0,
                "export_task_schema": "listing_image_export_tasks.v1",
                "export_tasks": [{
                    "task_id": "item-1-image-slot-1",
                    "position": 1,
                    "role": "main_image",
                    "label": "主图",
                    "source_image_url": source_url,
                    "asset_name": "source-main.png",
                    "scope": "publish_image",
                    "target_width": 1080,
                    "target_height": 1080,
                    "fit": "contain",
                    "crop_mode": "none",
                    "output_format": "jpeg",
                    "quality": 90,
                    "status": "planned_not_exported",
                }],
                "slots": [{
                    "position": 1,
                    "role": "main_image",
                    "label": "主图",
                    "image_url": source_url,
                    "asset_name": "source-main.png",
                    "publishable": True,
                    "edit_options": {
                        "width": 1080,
                        "height": 1080,
                        "fit": "contain",
                        "output_format": "jpeg",
                        "quality": 90,
                    },
                }],
            }
            item = SourcingItem(
                id="item-1",
                user_id="content-user",
                product_name="导出任务测试商品",
                source_name="1688",
                source_price_rmb=18,
                platform="shopee",
                market="MY",
                pipeline_stage="decision_passed",
                extra_data={
                    "content_tasks": {
                        "image_edit_plan": {
                            "confirmed_version": 1,
                            "versions": [{
                                "version": 1,
                                "status": "confirmed",
                                "content": json.dumps(image_plan),
                                "provider": "manual_image_slot_plan",
                            }],
                        }
                    }
                },
            )
            session.add(item)
            await session.commit()

            result = await execute_image_export_tasks(session, "content-user", "item-1")
            matrix = await get_content_task_matrix(session, "content-user", "item-1")

        await engine.dispose()

        assert result["executed"] == 1
        assert result["failed"] == 0
        assert result["assets"][0]["width"] == 1080
        image_task = next(task for task in matrix["tasks"] if task["task_type"] == "image_edit_plan")
        updated = json.loads(image_task["latest_version"]["content"])
        assert updated["export_tasks"][0]["status"] == "exported_to_content_asset"
        assert updated["export_tasks"][0]["generated_asset_url"].startswith("/api/v1/content/assets/")
        assert updated["slots"][0]["image_url"] == updated["export_tasks"][0]["generated_asset_url"]
        assert updated["last_export_execution"]["executed"] == 1

    asyncio.run(run_test())
