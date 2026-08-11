"""Runner for frontend information architecture validation chunks."""

from . import chunk_01
from . import chunk_02
from . import chunk_03
from . import chunk_04
from . import chunk_05

def validate() -> list[str]:
    env: dict[str, object] = {}
    chunk_01.run(env)
    chunk_02.run(env)
    chunk_03.run(env)
    chunk_04.run(env)
    chunk_05.run(env)
    errors = env.get("errors", [])
    if not isinstance(errors, list):
        raise TypeError("validation chunks must keep errors as a list")
    return errors
