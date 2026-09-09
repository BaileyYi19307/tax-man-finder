"""
Test-only HTTP/WebSocket pieces for the legacy Channels room-chat Selenium suite.

Production uses inquiry WebSockets (`/ws/inquiries/<id>/`) via config.asgi.
These helpers exist solely so chats.tests.ChatTests can exercise the tutorial
templates under chats/templates without changing production URLConf or ASGI.
"""

from __future__ import annotations

import json

from channels.generic.websocket import AsyncWebsocketConsumer
from django.urls import path, re_path
from django.views.generic import TemplateView


class TutorialRoomConsumer(AsyncWebsocketConsumer):
    """Minimal room broadcast consumer matching chats/templates/chats/room.html."""

    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"chat_{self.room_name}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        payload = json.loads(text_data or "{}")
        message = payload.get("message", "")
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "chat.message", "message": message},
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({"message": event["message"]}))


class ChatRoomTemplateView(TemplateView):
    template_name = "chats/room.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["room_name"] = self.kwargs["room_name"]
        return context


urlpatterns = [
    path(
        "chats/",
        TemplateView.as_view(template_name="chats/index.html"),
        name="chat-index",
    ),
    path(
        "chats/<str:room_name>/",
        ChatRoomTemplateView.as_view(),
        name="chat-room",
    ),
]

websocket_urlpatterns = [
    re_path(r"^ws/chat/(?P<room_name>\w+)/$", TutorialRoomConsumer.as_asgi()),
]
