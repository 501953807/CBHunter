from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.platforms import router as platforms_router
from app.api.v1.products import router as products_router
from app.api.v1.categories import router as categories_router
from app.api.v1.templates import router as templates_router
from app.api.v1.orders import router as orders_router
from app.api.v1.shipments import router as shipments_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.research import router as research_router
from app.api.v1.ai_suggestions import router as ai_suggestions_router
from app.api.v1.sync import router as sync_router
from app.api.v1.system import router as system_router
from app.api.v1.profitability import router as profitability_router
from app.api.v1.recommender import router as recommender_router
from app.api.v1.sourcing import router as sourcing_router
from app.api.v1.import_data import router as import_router
from app.api.v1.product_analysis import router as product_analysis_router
from app.api.v1.discovery import router as discovery_router
from app.api.v1.dictionary import router as dictionary_router
from app.api.v1.scout import router as scout_router
from app.api.v1.scout_supply import router as scout_supply_router
from app.api.v1.scout_trending import router as scout_trending_router
from app.api.v1.settings import router as settings_router
from app.api.v1.content import router as content_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.collect import router as collect_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.smart import router as smart_router
from app.api.v1.config import router as config_router
from app.api.v1.listing import router as listing_router
from app.api.v1.pricing import router as pricing_router
from app.api.v1.monitor import router as monitor_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.reports import router as reports_router
from app.api.v1.audit import router as audit_router
from app.api.v1.inventory_alerts import router as inventory_alerts_router
from app.api.v1.seeds import router as seeds_router
from app.api.v1.finance import router as finance_router
from app.api.v1.operations import router as operations_router
from app.api.v1.promotions import router as promotions_router
from app.api.v1.realtime import router as realtime_router
from app.api.v1.risk_control import router as risk_control_router
from app.api.v1.business_flow import router as business_flow_router
from app.api.v1.billing import router as billing_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(platforms_router)
api_router.include_router(products_router)
api_router.include_router(categories_router)
api_router.include_router(templates_router)
api_router.include_router(orders_router)
api_router.include_router(shipments_router)
api_router.include_router(analytics_router)
api_router.include_router(research_router)
api_router.include_router(ai_suggestions_router)
api_router.include_router(sync_router)
api_router.include_router(system_router)
api_router.include_router(profitability_router)
api_router.include_router(recommender_router)
api_router.include_router(sourcing_router)
api_router.include_router(import_router)
api_router.include_router(product_analysis_router)
api_router.include_router(discovery_router)
api_router.include_router(dictionary_router)
api_router.include_router(scout_router)
api_router.include_router(scout_trending_router)
api_router.include_router(scout_supply_router)
api_router.include_router(settings_router)
api_router.include_router(content_router)
api_router.include_router(dashboard_router)
api_router.include_router(collect_router)
api_router.include_router(tasks_router)
api_router.include_router(smart_router)
api_router.include_router(config_router)
api_router.include_router(listing_router)
api_router.include_router(pricing_router)
api_router.include_router(monitor_router)
api_router.include_router(notifications_router)
api_router.include_router(reports_router)
api_router.include_router(audit_router)
api_router.include_router(inventory_alerts_router)
api_router.include_router(seeds_router)
api_router.include_router(finance_router)
api_router.include_router(operations_router)
api_router.include_router(promotions_router)
api_router.include_router(realtime_router)
api_router.include_router(risk_control_router)
api_router.include_router(business_flow_router)
api_router.include_router(billing_router)
