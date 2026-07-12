import re
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100, pattern=r'^[a-zA-Z0-9_]+$')
    email: str = Field(pattern=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    password: str = Field(min_length=8, max_length=128)
    display_name: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        return validate_password_strength(v)


class PasswordResetRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        return validate_password_strength(v)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    display_name: Optional[str] = None
    is_active: bool
    is_admin: bool

    model_config = ConfigDict(from_attributes=True)


def validate_password_strength(value: str) -> str:
    if not re.search(r'[A-Z]', value):
        raise ValueError("密码必须包含至少一个大写字母")
    if not re.search(r'[a-z]', value):
        raise ValueError("密码必须包含至少一个小写字母")
    if not re.search(r'[0-9]', value):
        raise ValueError("密码必须包含至少一个数字")
    if not re.search(r'[!@#$%^&*(),.?\":{}|<>_\-+=;\[\]]', value):
        raise ValueError("密码必须包含至少一个特殊字符")
    return value
