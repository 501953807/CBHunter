"""Import regression tests for the project's Python 3.9 runtime."""


def test_main_application_imports_on_python39():
    from app.main import app

    assert app.title
