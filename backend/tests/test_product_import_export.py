"""Regression tests for product CSV/XLSX import and export."""

import asyncio
import io

import pytest
from fastapi import HTTPException
from openpyxl import Workbook
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models import all_models  # noqa: F401
from app.schemas.product import ProductCreate, ProductUpdate
from app.services.product_import_export_service import (
    build_product_csv,
    build_product_xlsx,
    export_products,
    import_products_from_upload,
)
from app.services.product_service import create_product, update_product


def test_product_csv_import_and_export(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-csv.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        csv_content = (
            "SKU,商品名称,品牌,成本价,重量g,状态,标签,属性JSON\n"
            "SKU-001,便携收纳包,CBHunter,12.5,180,active,travel;bag,\"{\"\"material\"\":\"\"nylon\"\"}\"\n"
        ).encode("utf-8-sig")
        async with sessions() as session:
            result = await import_products_from_upload(session, "user-1", "products.csv", csv_content)
            products = await export_products(session, "user-1")
            csv_bytes = build_product_csv(products)

        await engine.dispose()

        assert result["created_count"] == 1
        assert result["failed_count"] == 0
        assert products[0].sku == "SKU-001"
        assert "便携收纳包" in csv_bytes.decode("utf-8-sig")

    asyncio.run(run_test())


def test_product_xlsx_import_and_export(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-xlsx.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["SKU", "商品名称", "成本价", "重量g", "状态"])
        sheet.append(["SKU-002", "桌面补光灯", 28.9, 320, "draft"])
        output = io.BytesIO()
        workbook.save(output)

        async with sessions() as session:
            result = await import_products_from_upload(session, "user-2", "products.xlsx", output.getvalue())
            products = await export_products(session, "user-2")
            xlsx_bytes = build_product_xlsx(products)

        await engine.dispose()

        assert result["created_count"] == 1
        assert result["failed_count"] == 0
        assert products[0].name == "桌面补光灯"
        assert xlsx_bytes.startswith(b"PK")

    asyncio.run(run_test())


def test_product_creation_and_import_reject_obvious_automation_test_names(tmp_path):
    async def run_test():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'product-name-quality.db'}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        csv_content = (
            "SKU,商品名称,成本价,重量g,状态\n"
            "SKU-TEST,测试商品-自动化测试,99.99,200,draft\n"
        ).encode("utf-8-sig")
        async with sessions() as session:
            with pytest.raises(HTTPException) as create_error:
                await create_product(session, "user-3", ProductCreate(name="测试商品-自动化测试"))
            product = await create_product(session, "user-3", ProductCreate(name="真实便携收纳包"))
            with pytest.raises(HTTPException) as update_error:
                await update_product(session, product, ProductUpdate(name="自动化测试商品"))
            result = await import_products_from_upload(session, "user-3", "products.csv", csv_content)

        await engine.dispose()

        assert "测试残留" in create_error.value.detail
        assert "测试残留" in update_error.value.detail
        assert result["created_count"] == 0
        assert result["failed_count"] == 1
        assert "测试残留" in result["errors"][0]["error"]

    asyncio.run(run_test())
