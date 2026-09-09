from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from config.settings import _LOCAL_DEV_SECRET_KEY, resolve_secret_key


class ResolveSecretKeyTests(SimpleTestCase):
    def test_explicit_secret_key_wins(self):
        self.assertEqual(
            resolve_secret_key({"SECRET_KEY": "local-test-secret", "ENV": "development"}),
            "local-test-secret",
        )

    def test_production_requires_secret_key(self):
        with self.assertRaises(ImproperlyConfigured) as ctx:
            resolve_secret_key({"ENV": "production"})
        self.assertIn("SECRET_KEY", str(ctx.exception))

    def test_production_rejects_blank_secret_key(self):
        with self.assertRaises(ImproperlyConfigured):
            resolve_secret_key({"ENV": "production", "SECRET_KEY": "   "})

    def test_local_dev_uses_documented_fallback_when_unset(self):
        self.assertEqual(
            resolve_secret_key({"ENV": "development"}),
            _LOCAL_DEV_SECRET_KEY,
        )
