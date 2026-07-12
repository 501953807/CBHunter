import re
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.listing_template import ListingTemplate
from app.models.product import Product
from app.schemas.template import TemplateCreate, TemplateUpdate


async def list_templates(db: AsyncSession, user_id: str, platform: Optional[str] = None):
    query = select(ListingTemplate).where(ListingTemplate.user_id == user_id)
    if platform:
        query = query.where(
            (ListingTemplate.platform == platform) | (ListingTemplate.platform == "all")
        )
    query = query.order_by(ListingTemplate.is_default.desc(), ListingTemplate.name)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_template(db: AsyncSession, template_id: str, user_id: str) -> Optional[ListingTemplate]:
    result = await db.execute(
        select(ListingTemplate).where(
            ListingTemplate.id == template_id,
            ListingTemplate.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def create_template(db: AsyncSession, user_id: str, req: TemplateCreate) -> ListingTemplate:
    if req.is_default:
        await _clear_default_for_platform(db, user_id, req.platform)
    template = ListingTemplate(
        user_id=user_id,
        name=req.name,
        description=req.description,
        platform=req.platform,
        category_id=req.category_id,
        template_data=req.template_data,
        is_default=req.is_default,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def update_template(db: AsyncSession, template: ListingTemplate, req: TemplateUpdate) -> ListingTemplate:
    update_data = req.model_dump(exclude_unset=True)
    target_platform = update_data.get("platform", template.platform)
    if update_data.get("is_default"):
        await _clear_default_for_platform(db, template.user_id, target_platform, exclude_id=template.id)
    for field, value in update_data.items():
        setattr(template, field, value)
    await db.commit()
    await db.refresh(template)
    return template


async def delete_template(db: AsyncSession, template: ListingTemplate):
    await db.delete(template)
    await db.commit()


async def preview_template(
    db: AsyncSession,
    template: ListingTemplate,
    product_id: str,
    user_id: str,
) -> dict:
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.user_id == user_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        return {"error": "Product not found"}

    variables = {
        "product_name": product.name or "",
        "brand": product.brand or "",
        "sku": product.sku or "",
        "description": product.description or "",
        "category": product.category_id or "",
    }

    resolved = render_template_fields(template.template_data, variables, product.cost_price)

    return {
        "template_name": template.name,
        "platform": template.platform,
        "product_name": product.name,
        "resolved_data": resolved,
    }


async def _clear_default_for_platform(
    db: AsyncSession,
    user_id: str,
    platform: str,
    exclude_id: Optional[str] = None,
) -> None:
    query = select(ListingTemplate).where(
        ListingTemplate.user_id == user_id,
        ListingTemplate.platform == platform,
        ListingTemplate.is_default == True,
    )
    if exclude_id:
        query = query.where(ListingTemplate.id != exclude_id)
    result = await db.execute(query)
    for item in result.scalars().all():
        item.is_default = False


def render_template_fields(
    template_data: dict,
    variables: dict[str, str],
    cost_price: Optional[float] = None,
) -> dict:
    """Render structured template fields with canonical and legacy variables."""

    def replace_var(match):
        expr = match.group(1)
        if expr.startswith("price_markup:"):
            if cost_price is None:
                return match.group(0)
            pct = float(expr.split(":")[1])
            return str(round(cost_price * (1 + pct / 100), 2))
        if expr.startswith("price_fixed:"):
            if cost_price is None:
                return match.group(0)
            amount = float(expr.split(":")[1])
            return str(round(cost_price + amount, 2))
        return variables.get(expr, match.group(0))

    def render_value(value):
        if isinstance(value, str):
            rendered = re.sub(r"\{\{(\w+(?::[\d.]+)?)\}\}", replace_var, value)
            return re.sub(r"(?<!\{)\{(\w+)\}(?!\})", replace_var, rendered)
        if isinstance(value, list):
            return [render_value(item) for item in value]
        if isinstance(value, dict):
            return {key: render_value(item) for key, item in value.items()}
        return value

    return render_value(template_data)
