"""Tests for password complexity validation in auth schema."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from pydantic import ValidationError
from app.schemas.auth import RegisterRequest


class TestPasswordComplexity:
    def test_valid_password(self):
        req = RegisterRequest(
            username="testuser",
            email="test@example.com",
            password="Abc123!@#",
        )
        assert req.username == "testuser"

    def test_too_short(self):
        with pytest.raises(ValidationError):
            RegisterRequest(
                username="testuser",
                email="test@example.com",
                password="Ab1!",
            )

    def test_no_uppercase(self):
        with pytest.raises(ValidationError) as exc:
            RegisterRequest(
                username="testuser",
                email="test@example.com",
                password="abc123!@",
            )
        assert "大写字母" in str(exc.value)

    def test_no_lowercase(self):
        with pytest.raises(ValidationError) as exc:
            RegisterRequest(
                username="testuser",
                email="test@example.com",
                password="ABC123!@",
            )
        assert "小写字母" in str(exc.value)

    def test_no_digit(self):
        with pytest.raises(ValidationError) as exc:
            RegisterRequest(
                username="testuser",
                email="test@example.com",
                password="Abcdef!@",
            )
        assert "数字" in str(exc.value)

    def test_no_special_char(self):
        with pytest.raises(ValidationError) as exc:
            RegisterRequest(
                username="testuser",
                email="test@example.com",
                password="Abcdef123",
            )
        assert "特殊字符" in str(exc.value)
