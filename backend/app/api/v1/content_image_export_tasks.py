"""Content factory image export task endpoints."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.audit_service import record_audit_event
from app.services.content_image_export_task_service import execute_image_export_tasks
from app.services.evidence_service import source_ref

router = APIRouter(prefix="/content", tags=["content"])


class ImageExportTasksExecuteRequest(BaseModel):
    task_ids: list[str] = Field(default_factory=list)
    limit: int = Field(default=30, ge=1, le=30)


@router.post("/workbench/{item_id}/image-export-tasks/execute", response_model=ApiResponse)
async def execute_content_image_export_tasks(
    item_id: str,
    req: ImageExportTasksExecuteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await execute_image_export_tasks(
        db,
        current_user.id,
        item_id,
        task_ids=req.task_ids,
        limit=req.limit,
    )
    await record_audit_event(
        db,
        user=current_user,
        action="execute",
        resource_type="content_image_export_tasks",
        resource_id=item_id,
        new_value={
            "executed": result["executed"],
            "failed": result["failed"],
            "task_version": result["task_version"],
        },
        detail="执行内容工厂图片导出任务",
    )
    return ApiResponse(
        data=result,
        status="ready" if result["executed"] else "data_required",
        source_refs=[
            source_ref("sourcing_item", item_id),
            *[source_ref("content_asset", asset["id"]) for asset in result.get("assets", [])],
        ],
        evidence_window="当前商品已确认图片槽位计划与本次导出执行结果",
        confidence_reason="导出结果来自后端确定性图片处理服务生成的 ContentAsset，不表示已上传到 Shopee/TEMU/TikTok Shop。",
        data_gaps=[] if result["executed"] else ["暂无成功导出的图片素材"],
    )
