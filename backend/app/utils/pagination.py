import math
from fastapi import Query


async def pagination_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    return {"page": page, "page_size": page_size}


def paginate(query, total: int, page: int, page_size: int):
    return {
        "data": query,
        "meta": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size) if total > 0 else 0,
        },
    }
