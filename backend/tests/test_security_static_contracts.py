"""Static security contract tests for high-risk endpoints."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _route_block(source: str, marker: str) -> str:
    start = source.index(marker)
    next_route = source.find("\n@router.", start + len(marker))
    return source[start:] if next_route == -1 else source[start:next_route]


def test_product_image_proxy_requires_authenticated_user():
    source = (ROOT / "backend/app/api/v1/products.py").read_text(encoding="utf-8")

    block = _route_block(source, '@router.get("/image-proxy")')

    assert "current_user: User = Depends(get_current_user)" in block
    assert "_is_private_or_local_host" in block
    assert "MAX_PROXY_IMAGE_BYTES" in block


def test_frontend_does_not_call_authenticated_image_proxy_from_plain_img_src():
    source = (ROOT / "frontend/src/utils/productImages.ts").read_text(encoding="utf-8")

    assert "/api/v1/products/image-proxy" not in source
