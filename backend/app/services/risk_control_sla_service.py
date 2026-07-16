"""Risk-control SLA template configuration."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.config_service import get_config_json


RISK_SLA_TEMPLATES = {
    "account": {"critical": 12, "warning": 24, "info": 72},
    "business": {"critical": 24, "warning": 72, "info": 120},
    "compliance": {"critical": 12, "warning": 48, "info": 120},
    "logistics": {"critical": 6, "warning": 24, "info": 72},
    "currency": {"critical": 24, "warning": 72, "info": 120},
    "inventory": {"critical": 24, "warning": 72, "info": 120},
}


async def get_risk_sla_templates(db: AsyncSession) -> dict:
    configured = await get_config_json(db, "risk.sla_templates")
    if not configured:
        return RISK_SLA_TEMPLATES
    templates: dict[str, dict[str, int]] = {}
    for risk_type, defaults in RISK_SLA_TEMPLATES.items():
        raw = configured.get(risk_type) if isinstance(configured.get(risk_type), dict) else {}
        templates[risk_type] = {}
        for severity, default_hours in defaults.items():
            value = raw.get(severity)
            try:
                hours = int(value)
            except (TypeError, ValueError):
                hours = default_hours
            templates[risk_type][severity] = max(hours, 1)
    return templates
