"""Tests for truthful Miaoshou import mappings."""

from app.services.import_miaoshou import map_order_status


def test_miaoshou_unknown_order_status_stays_pending():
    assert map_order_status("未知状态") == "pending"


def test_miaoshou_order_status_mapping_preserves_known_states():
    assert map_order_status("订单已完成") == "delivered"
    assert map_order_status("已取消") == "cancelled"
    assert map_order_status("退款处理中") == "refunded"
    assert map_order_status("已发货") == "shipped"
