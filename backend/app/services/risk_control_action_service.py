"""Actions created from current risk-control events."""

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.operation_record import OperationRecord
from app.services.operation_service import create_record
from app.services.risk_control_service import get_risk_control_overview


async def create_operation_record_from_risk(db: AsyncSession, user_id: str, risk_id: str) -> OperationRecord:
    overview = await get_risk_control_overview(db, user_id)
    risk = next((item for item in overview["risks"] if item["id"] == risk_id), None)
    if not risk:
        raise HTTPException(status_code=404, detail="风险事件不存在或当前没有真实来源")
    if not risk.get("listing_id") and not risk.get("platform_account_id"):
        raise HTTPException(status_code=400, detail="该风险缺少可生成运营台账的店铺或 Listing 对象")
    return await create_record(db, user_id, {
        "record_type": "listing_optimization" if risk.get("listing_id") else "ad_campaign",
        "status": "operation_pending",
        "name": _operation_name_for_risk(risk),
        "platform": risk.get("platform"),
        "market": risk.get("market"),
        "counterparty": risk.get("account_name") or "平台店铺",
        "planned_amount_rmb": 0,
        "actual_amount_rmb": None,
        "currency": "CNY",
        "notes": risk.get("detail") or risk.get("estimated_impact"),
        "metrics": {
            "risk_id": risk["id"],
            "risk_type": risk.get("type"),
            "risk_severity": risk.get("severity"),
            "estimated_impact": risk.get("estimated_impact"),
        },
        "extra": {
            "source": "risk_control",
            "risk_id": risk["id"],
            "listing_id": risk.get("listing_id"),
            "product_id": risk.get("product_id"),
            "platform_account_id": risk.get("platform_account_id"),
            "route": risk.get("route"),
        },
    })


def _operation_name_for_risk(risk: dict) -> str:
    title = risk.get("title") or "风险处置"
    if risk["id"].startswith("business:sales-decline:"):
        return f"销售急剧下滑处置：{title}"
    if risk["id"].startswith("inventory:slow-capital:"):
        return f"滞销库存资金处置：{title}"
    return f"风险处置：{title}"
