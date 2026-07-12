"""Content factory workbench regression tests."""

import asyncio
from types import SimpleNamespace

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1 import content as content_api
from app.api.v1 import pricing as pricing_api
from app.api.v1.content import (
    ContentTaskGenerateRequest,
    FiveStepTitleGenRequest,
    VideoContentRequest,
    generate_content_task_candidate,
    generate_titles_five_step,
    generate_video_plan,
)
from app.database import Base
from app.models import all_models  # noqa: F401
from app.models.sourcing_item import SourcingItem
from app.services.content_workbench_service import (
    REQUIRED_CONTENT_GAPS,
    confirm_content_task_version,
    get_content_task_matrix,
    get_content_workbench,
    save_content_task_version,
)


def test_content_workbench_lists_decision_passed_products(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'content-workbench.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            session.add_all([
                SourcingItem(
                    user_id="content-user",
                    product_name="越南风编织包",
                    source_name="1688",
                    source_url="https://detail.1688.com/offer/content-ready.html",
                    source_price_rmb=18,
                    category="bags",
                    platform="shopee",
                    market="MY",
                    pipeline_stage="decision_passed",
                    source_image="https://cdn.shopify.com/s/files/1/0015/3426/3341/files/4a172617-554b-4d17-bb89-19ca5fbdfbd7.png?v=1750758267",
                    extra_data={
                        "platform_requirements": {
                            "shopee": {
                                "required_attributes": ["类目", "品牌", "材质", "重量"],
                                "media": ["主图", "场景图"],
                                "content": ["标题", "卖点"],
                                "compliance": ["禁限售复核"],
                            }
                        },
                        "content_workbench": {
                            "bullets": ["轻便", "大容量"],
                            "image_plan": ["主图白底", "尺寸图"],
                            "ai_assist": ["标题优化"],
                        },
                        "media_readiness": {
                            "captured_image_count": 1,
                            "missing_image_count": 4,
                            "gaps": ["缺少平台辅图", "缺少尺寸/规格图"],
                        },
                    },
                ),
                SourcingItem(
                    user_id="content-user",
                    product_name="未决策商品",
                    source_name="1688",
                    source_price_rmb=12,
                    pipeline_stage="discovery",
                ),
            ])
            await session.commit()

            workbench = await get_content_workbench(session, "content-user")
        await engine.dispose()

        assert workbench["status"] == "ready"
        assert workbench["metrics"]["total"] == 1
        item = workbench["items"][0]
        assert item["work_item_id"].startswith("sourcing_item:")
        assert item["product_name"] == "越南风编织包"
        assert item["target_platform"] == "shopee"
        assert item["target_market"] == "MY"
        assert item["content_status"] == "not_started"
        assert item["lifecycle_status"] == "content_required"
        assert item["image_url"].startswith("https://")
        required_attributes = set(item["platform_requirements"]["required_attributes"])
        assert {"类目", "品牌", "材质", "重量"}.issubset(required_attributes)
        assert {"category", "brand", "seller_sku"}.issubset(required_attributes)
        assert item["content_brief"]["bullets"] == ["轻便", "大容量"]
        assert item["media_readiness"]["captured_image_count"] == 1
        assert item["media_readiness"]["missing_image_count"] == 4
        assert "缺少平台辅图" in item["media_readiness"]["gaps"]
        assert item["evidence_completeness"]["content"] == "missing"
        assert "缺少已确认标题文案" in item["content_gaps"]

    asyncio.run(run_test())


def test_content_workbench_gaps_follow_confirmed_task_versions(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'content-confirmed-gaps.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            item = SourcingItem(
                user_id="content-user",
                product_name="越南风编织包",
                source_name="1688",
                source_price_rmb=18,
                category="bags",
                platform="shopee",
                market="MY",
                pipeline_stage="decision_passed",
            )
            session.add(item)
            await session.commit()
            await session.refresh(item)

            title = await save_content_task_version(
                session,
                "content-user",
                item.id,
                "listing_copy",
                "越南风编织包 轻便通勤",
                provider="ai",
            )
            await confirm_content_task_version(session, "content-user", item.id, "listing_copy", title["version"])
            video = await save_content_task_version(
                session,
                "content-user",
                item.id,
                "video_script",
                "展示通勤、容量和海岛场景。",
                provider="ai",
            )
            await confirm_content_task_version(session, "content-user", item.id, "video_script", video["version"])
            workbench = await get_content_workbench(session, "content-user")
        await engine.dispose()

        gaps = workbench["items"][0]["content_gaps"]
        assert "缺少已确认标题文案" not in gaps
        assert "缺少已确认视频脚本" not in gaps
        assert "缺少已确认卖点描述" in gaps
        assert workbench["items"][0]["content_status"] == "in_progress"

    asyncio.run(run_test())


def test_ai_generation_saves_unconfirmed_task_versions(tmp_path, monkeypatch):
    async def skip_entitlement(*args, **kwargs):
        return None

    async def fake_generate_titles(*args, **kwargs):
        return {
            "status": "ready",
            "titles": ["越南风编织包 轻便通勤海岛旅行", "手工感编织托特包 大容量出游"],
            "evidence_window": "测试输入",
            "confidence_reason": "测试生成",
        }

    async def fake_generate_video_content_plan(*args, **kwargs):
        return {
            "status": "ready",
            "scripts": [{"title": "海岛出游包", "script": "展示容量、肩背和度假场景"}],
            "hashtags": ["#beachbag"],
            "calendar": [],
            "evidence_window": "测试输入",
            "confidence_reason": "测试生成",
        }

    monkeypatch.setattr(content_api, "require_entitlement", skip_entitlement)
    monkeypatch.setattr(content_api, "require_and_consume_quota", skip_entitlement)
    monkeypatch.setattr(content_api, "generate_titles", fake_generate_titles)
    monkeypatch.setattr(content_api, "generate_video_content_plan", fake_generate_video_content_plan)

    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'content-ai-candidates.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            item = SourcingItem(
                user_id="content-user",
                product_name="越南风编织包",
                source_name="1688",
                source_price_rmb=18,
                category="bags",
                platform="shopee",
                market="MY",
                pipeline_stage="decision_passed",
            )
            session.add(item)
            await session.commit()
            await session.refresh(item)

            user = SimpleNamespace(id="content-user")
            title_response = await generate_titles_five_step(
                FiveStepTitleGenRequest(
                    product_name=item.product_name,
                    category="bags",
                    platform="shopee",
                    market="MY",
                    content_item_id=item.id,
                ),
                current_user=user,
                db=session,
            )
            video_response = await generate_video_plan(
                VideoContentRequest(
                    product_name=item.product_name,
                    category="bags",
                    platform="shopee",
                    market="MY",
                    content_item_id=item.id,
                ),
                current_user=user,
                db=session,
            )
            matrix = await get_content_task_matrix(session, "content-user", item.id)
        await engine.dispose()

        listing_task = next(task for task in matrix["tasks"] if task["task_type"] == "listing_copy")
        video_task = next(task for task in matrix["tasks"] if task["task_type"] == "video_script")
        assert title_response.data["task_version"] == {"task_type": "listing_copy", "version": 1}
        assert video_response.data["task_version"] == {"task_type": "video_script", "version": 1}
        assert listing_task["status"] == "draft_ready"
        assert listing_task["confirmed_version"] is None
        assert listing_task["latest_version"]["provider"] == "ai"
        assert "越南风编织包" in listing_task["latest_version"]["content"]
        assert video_task["status"] == "draft_ready"
        assert video_task["confirmed_version"] is None
        assert "海岛出游包" in video_task["latest_version"]["content"]

    asyncio.run(run_test())


def test_generic_ai_content_task_generation_saves_unconfirmed_candidate(tmp_path, monkeypatch):
    async def skip_entitlement(*args, **kwargs):
        return None

    async def fake_execute_task(*args, **kwargs):
        return content_api.TaskResult(
            True,
            {
                "text": "越南风编织包 卖点候选：轻便、大容量、适合东南亚夏季通勤场景。",
                "data_gaps": ["ai_provider"],
            },
            provider="rule_engine",
            confidence="low",
        )

    monkeypatch.setattr(content_api, "require_entitlement", skip_entitlement)
    monkeypatch.setattr(content_api, "execute_task", fake_execute_task)

    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'content-generic-ai-task.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            item = SourcingItem(
                user_id="content-user",
                product_name="越南风编织包",
                source_name="1688",
                source_price_rmb=18,
                category="bags",
                platform="shopee",
                market="MY",
                pipeline_stage="content_required",
            )
            session.add(item)
            await session.commit()
            await session.refresh(item)

            response = await generate_content_task_candidate(
                item.id,
                ContentTaskGenerateRequest(
                    task_type="selling_points",
                    product_name=item.product_name,
                    category="bags",
                    platform="shopee",
                    market="MY",
                    features="轻便、大容量、海岛通勤",
                    selling_points="编织质感，适合东南亚夏季场景",
                ),
                current_user=SimpleNamespace(id="content-user"),
                db=session,
            )
            matrix = await get_content_task_matrix(session, "content-user", item.id)
        await engine.dispose()

        selling_task = next(task for task in matrix["tasks"] if task["task_type"] == "selling_points")
        assert response.status == "ready"
        assert response.data["task_version"] == {"task_type": "selling_points", "version": 1}
        assert response.data["provider"] == "rule_engine"
        assert response.data["confidence"] == "low"
        assert selling_task["status"] == "draft_ready"
        assert selling_task["confirmed_version"] is None
        assert "越南风编织包" in selling_task["latest_version"]["content"]

    asyncio.run(run_test())


def test_content_task_matrix_tracks_versions_and_manual_confirmation(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'content-task-matrix.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            item = SourcingItem(
                user_id="content-user",
                product_name="越南风编织包",
                source_name="1688",
                source_url="https://detail.1688.com/offer/content-task.html",
                source_price_rmb=18,
                category="bags",
                platform="shopee",
                market="MY",
                pipeline_stage="decision_passed",
            )
            session.add(item)
            await session.commit()
            await session.refresh(item)

            initial = await get_content_task_matrix(session, "content-user", item.id)
            saved = await save_content_task_version(
                session,
                "content-user",
                item.id,
                "listing_copy",
                "轻量编织包，适合通勤和海岛旅行。",
                provider="manual",
            )
            confirmed = await confirm_content_task_version(
                session,
                "content-user",
                item.id,
                "listing_copy",
                saved["version"],
            )
        await engine.dispose()

        assert [task["task_type"] for task in initial["tasks"]] == [
            "listing_copy",
            "selling_points",
            "description",
            "image_understanding",
            "image_edit_plan",
            "video_script",
            "compliance_check",
            "enhanced_content",
            "ad_creative",
            "influencer_brief",
        ]
        optional = [task for task in initial["tasks"] if not task["required_for_pricing"]]
        assert [task["task_type"] for task in optional] == ["enhanced_content", "ad_creative", "influencer_brief"]
        listing_task = next(task for task in confirmed["tasks"] if task["task_type"] == "listing_copy")
        assert listing_task["status"] == "confirmed"
        assert listing_task["version_count"] == 1
        assert listing_task["confirmed_version"] == 1
        assert listing_task["latest_version"]["content"] == "轻量编织包，适合通勤和海岛旅行。"
        assert confirmed["metrics"]["confirmed"] == 1
        assert confirmed["metrics"]["unconfirmed"] == 9

    asyncio.run(run_test())


def test_confirming_all_content_tasks_advances_product_to_pricing_queue(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'content-to-pricing.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            item = SourcingItem(
                user_id="content-user",
                product_name="越南风编织包",
                source_name="1688",
                source_price_rmb=18,
                category="bags",
                platform="shopee",
                market="MY",
                pipeline_stage="content_required",
            )
            session.add(item)
            await session.commit()
            await session.refresh(item)

            for task_type, _label in REQUIRED_CONTENT_GAPS:
                saved = await save_content_task_version(
                    session,
                    "content-user",
                    item.id,
                    task_type,
                    f"{task_type} 已确认内容",
                    provider="manual",
                )
                matrix = await confirm_content_task_version(
                    session,
                    "content-user",
                    item.id,
                    task_type,
                    saved["version"],
                )

            await session.refresh(item)
            workbench = await get_content_workbench(session, "content-user")
            pricing = await pricing_api.get_pricing_workbench(
                current_user=SimpleNamespace(id="content-user", is_admin=False),
                db=session,
            )
        await engine.dispose()

        assert item.pipeline_stage == "pricing_required"
        assert matrix["metrics"]["confirmed"] == len(REQUIRED_CONTENT_GAPS)
        assert matrix["metrics"]["required_total"] == len(REQUIRED_CONTENT_GAPS)
        assert matrix["metrics"]["required_confirmed"] == len(REQUIRED_CONTENT_GAPS)
        assert matrix["next_action"] == "进入定价校验"
        assert matrix["next_action_route"] == "/pricing"
        assert workbench["items"][0]["content_status"] == "ready"
        assert workbench["items"][0]["lifecycle_status"] == "content_ready"
        assert pricing.status == "ready"
        assert pricing.data["items"][0]["id"] == item.id
        assert pricing.data["items"][0]["pricing_status"] == "pricing_required"

    asyncio.run(run_test())
