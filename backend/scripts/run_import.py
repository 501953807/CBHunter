"""CLI script to import CocoTrip Shop data from 妙手ERP exports.

Usage:
    cd backend && source venv/bin/activate
    python scripts/run_import.py
"""

import asyncio
import sys
import os

# Add parent to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.database import async_session, init_db
from app.services.import_miaoshou import import_cocotrip_data


async def main():
    print("=" * 60)
    print("  CocoTrip Shop 数据导入工具")
    print("=" * 60)
    print()

    # Initialize DB
    await init_db()

    # Get admin user
    async with async_session() as db:
        from app.models.user import User
        from sqlalchemy import select
        result = await db.execute(select(User))
        user = result.scalar_one_or_none()
        if not user:
            print("❌ 没有找到用户，请先注册")
            return
        print(f"✅ 找到用户: {user.email} (ID: {user.id[:8]}...)")

        # Clear existing mock data first
        from app.models.product import Product
        from app.models.order import Order
        from app.models.order_item import OrderItem
        from sqlalchemy import delete

        # Only clear if user confirms
        print("⚠️  即将清空现有的 mock 产品/订单数据并导入真实数据")
        confirm = input("继续？(y/N): ")
        if confirm.lower() != 'y':
            print("已取消")
            return

        # Clear existing data for this user
        await db.execute(
            delete(OrderItem).where(
                OrderItem.order_id.in_(
                    select(Order.id).where(Order.user_id == user.id)
                )
            )
        )
        await db.execute(delete(Order).where(Order.user_id == user.id))
        await db.execute(delete(Product).where(Product.user_id == user.id))
        await db.commit()
        print("✅ 已清空旧数据")

        # Import
        print("\n📦 正在导入CocoTrip数据...")
        result = await import_cocotrip_data(db, user.id)

        print()
        print("=" * 60)
        print("  📊 导入结果")
        print("=" * 60)
        print(f"  平台账户: {result['platform_account']['name']}")
        print(f"  产品: {result['products']['created']} 创建, {result['products']['skipped']} 跳过")
        print(f"  订单: {result['orders']['created']} 创建, {result['orders']['skipped']} 跳过")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
