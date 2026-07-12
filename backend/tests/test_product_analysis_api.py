"""Product analysis API evidence contract tests."""

import asyncio

from app.api.v1 import product_analysis as product_analysis_api
from app.models.user import User


def test_new_product_rankings_endpoint_returns_evidence(monkeypatch):
    async def fake_rank_new_products(db, user_id):
        return [{
            "id": "product-1",
            "name": "真实新品",
            "sku": "SKU-1",
            "score": 70,
            "reasons": ["有描述"],
        }]

    monkeypatch.setattr(product_analysis_api, "rank_new_products", fake_rank_new_products)

    response = asyncio.run(product_analysis_api.new_product_rankings(
        current_user=User(id="user-a", username="u", email="u@example.com", hashed_password="x"),
        db=None,
    ))

    assert response.status == "ready"
    assert response.evidence_window == "当前商品主数据与订单明细快照"
    assert response.confidence_reason
    assert response.source_refs[0].type == "product"
    assert response.source_refs[0].id == "product-1"
    assert response.data_gaps == []
