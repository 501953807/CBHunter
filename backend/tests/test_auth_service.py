"""Tests for auth_service: password hashing, token creation, user registration."""

import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.auth_service import (
    hash_password, verify_password, create_access_token,
)


class TestPasswordHashing:
    def test_hash_and_verify(self):
        password = "MyStr0ng!Pass"
        hashed = hash_password(password)
        assert hashed != password
        assert verify_password(password, hashed) is True

    def test_wrong_password_fails(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_empty_password(self):
        hashed = hash_password("")
        assert verify_password("", hashed) is True

    def test_unicode_password(self):
        password = "密码Test123!"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True


class TestTokenCreation:
    def test_creates_valid_jwt(self):
        token = create_access_token("user-123")
        assert token is not None
        assert len(token) > 20
        assert token.count('.') == 2  # JWT has 3 parts

    def test_different_users_different_tokens(self):
        t1 = create_access_token("user-1")
        t2 = create_access_token("user-2")
        assert t1 != t2

    def test_token_is_string(self):
        token = create_access_token("test")
        assert isinstance(token, str)
