"""Tests for encryption utility."""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import importlib
from cryptography.fernet import Fernet

TEST_KEY = Fernet.generate_key().decode()
os.environ["ENCRYPTION_KEY"] = TEST_KEY

# Force fresh import so the module picks up our test key
import app.utils.encryption as enc_mod
importlib.reload(enc_mod)


class TestEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        from app.utils.encryption import encrypt, decrypt
        plaintext = "my-secret-api-key-12345"
        ciphertext = encrypt(plaintext)
        assert ciphertext != plaintext
        assert len(ciphertext) > 0
        assert decrypt(ciphertext) == plaintext

    def test_different_inputs_different_ciphertexts(self):
        from app.utils.encryption import encrypt
        c1 = encrypt("value1")
        c2 = encrypt("value2")
        assert c1 != c2

    def test_empty_string(self):
        from app.utils.encryption import encrypt, decrypt
        c = encrypt("")
        assert decrypt(c) == ""

    def test_unicode_text(self):
        from app.utils.encryption import encrypt, decrypt
        text = "中文测试数据"
        c = encrypt(text)
        assert decrypt(c) == text
