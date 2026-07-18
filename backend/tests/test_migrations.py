import pytest
from alembic.config import Config
from alembic import command
import os


class TestAlembicMigrations:
    def test_alembic_ini_exists(self):
        alembic_ini = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
        assert os.path.exists(alembic_ini), "alembic.ini not found"

    def test_env_py_exists(self):
        env_py = os.path.join(os.path.dirname(__file__), "..", "alembic", "env.py")
        assert os.path.exists(env_py), "env.py not found"

    def test_versions_dir_exists(self):
        versions_dir = os.path.join(os.path.dirname(__file__), "..", "alembic", "versions")
        assert os.path.exists(versions_dir), "versions directory not found"

    def test_generate_migration(self):
        """Test that alembic can generate a migration"""
        alembic_ini = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
        if not os.path.exists(alembic_ini):
            pytest.skip("alembic.ini not found")
        
        cfg = Config(alembic_ini)
        try:
            command.revision(cfg, message="test_migration", autogenerate=True)
        except Exception as e:
            pytest.fail(f"Failed to generate migration: {e}")
