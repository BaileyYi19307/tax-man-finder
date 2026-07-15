"""
ASGI config for config project.

Django must be initialized before importing apps that touch models
(e.g. chats.routing → consumers → models).
"""

import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Initialize Django before importing anything that loads models.
django_asgi_app = get_asgi_application()

from chats.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": URLRouter(websocket_urlpatterns),
})
