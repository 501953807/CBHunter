from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.rate_limit import check_login_rate, check_register_rate
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from app.schemas.common import ApiResponse
from app.services.auth_service import register_user, authenticate_user, create_access_token
from app.services.audit_service import record_audit_event
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class ProfileUpdateRequest(BaseModel):
    email: str | None = Field(None, pattern=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    display_name: str | None = Field(None, max_length=100)


@router.post("/register", response_model=ApiResponse)
async def register(request: Request, req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    await check_register_rate(request)
    try:
        user = await register_user(db, req)
        token = create_access_token(user.id)
        return ApiResponse(data={
            "user": UserResponse.model_validate(user),
            "token": TokenResponse(access_token=token).model_dump(),
        })
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=ApiResponse)
async def login(request: Request, req: LoginRequest, db: AsyncSession = Depends(get_db)):
    await check_login_rate(request)
    try:
        user = await authenticate_user(db, req.username, req.password)
        token = create_access_token(user.id)
        return ApiResponse(data={
            "user": UserResponse.model_validate(user),
            "token": TokenResponse(access_token=token).model_dump(),
        })
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.get("/me", response_model=ApiResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return ApiResponse(data=UserResponse.model_validate(current_user))


@router.put("/me", response_model=ApiResponse)
async def update_me(req: ProfileUpdateRequest, current_user: User = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    old_value = _user_snapshot(current_user)
    if req.display_name:
        current_user.display_name = req.display_name
    if req.email:
        current_user.email = req.email
    await db.commit()
    await db.refresh(current_user)
    await record_audit_event(
        db,
        user=current_user,
        action="update",
        resource_type="user_profile",
        resource_id=current_user.id,
        old_value=old_value,
        new_value=_user_snapshot(current_user),
        detail="更新当前账号资料",
    )
    return ApiResponse(data=UserResponse.model_validate(current_user))


def _user_snapshot(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
    }
