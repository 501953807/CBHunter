"""Unified application exceptions and global error handler.

All services raise AppException instead of bare HTTPException.
The handler converts to consistent ApiResponse(error=...) format.
"""

from typing import Optional
from fastapi import Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Base application exception with structured error info."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        detail: Optional[dict] = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.detail = detail or {}
        super().__init__(message)


class NotFoundException(AppException):
    def __init__(self, resource: str, identifier: str = ""):
        super().__init__(
            code="NOT_FOUND",
            message=f"{resource}不存在" + (f": {identifier}" if identifier else ""),
            status_code=404,
            detail={"resource": resource, "identifier": identifier},
        )


class DuplicateException(AppException):
    def __init__(self, resource: str, field: str = ""):
        super().__init__(
            code="DUPLICATE",
            message=f"{resource}已存在" + (f" ({field})" if field else ""),
            status_code=409,
            detail={"resource": resource, "field": field},
        )


class ConfigException(AppException):
    def __init__(self, key: str):
        super().__init__(
            code="CONFIG_MISSING",
            message=f"缺少系统配置: {key}",
            status_code=500,
            detail={"key": key},
        )


class ValidationException(AppException):
    def __init__(self, message: str, detail: Optional[dict] = None):
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            status_code=422,
            detail=detail,
        )


def register_exception_handlers(app):
    """Register global exception handlers on FastAPI app."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        from app.schemas.common import ApiResponse

        return JSONResponse(
            status_code=exc.status_code,
            content=ApiResponse(
                error=exc.message,
                meta={"code": exc.code, "detail": exc.detail},
            ).model_dump(),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        import logging
        logger = logging.getLogger(__name__)
        logger.exception(f"Unhandled exception: {exc}")

        from app.schemas.common import ApiResponse

        return JSONResponse(
            status_code=500,
            content=ApiResponse(error="服务器内部错误").model_dump(),
        )
