import hashlib
import os
import base64
from cryptography.fernet import Fernet
from app.config import settings

_fernet = None

def _derive_key() -> Fernet:
    """Derive encryption key from best available source."""
    # 1. Environment variable (user-controlled, highest priority)
    env_key = os.environ.get("ENCRYPTION_KEY")
    if env_key:
        return Fernet(env_key.encode() if isinstance(env_key, str) else env_key)

    # 2. .env file
    cfg_key = settings.encryption_key
    if cfg_key:
        return Fernet(cfg_key.encode() if isinstance(cfg_key, str) else cfg_key)

    # No key configured — refuse to operate
    raise RuntimeError(
        "ENCRYPTION_KEY is not set. Please generate a key with:\n"
        "  python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"\n"
        "Then set it in your .env file as ENCRYPTION_KEY=<generated-key>"
    )

def get_cipher() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = _derive_key()
    return _fernet

def encrypt(plaintext: str) -> str:
    return get_cipher().encrypt(plaintext.encode()).decode()

def decrypt(ciphertext: str) -> str:
    return get_cipher().decrypt(ciphertext.encode()).decode()
