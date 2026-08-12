"""WebSocket ChatConsumer rules (Phase 4)."""

import json

from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken

from chats.models import Message
from config.asgi import application
from inquiries.models import Inquiry
from services.models import Service
from users.models import User

IN_MEMORY_CHANNEL_LAYER = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
class ChatConsumerWebSocketTests(TransactionTestCase):
    def setUp(self):
        self.accountant = User.objects.create_user(
            email="acct-ws@test.com",
            password="password123",
            is_accountant=True,
        )
        self.client_user = User.objects.create_user(
            email="client-ws@test.com",
            password="password123",
            is_accountant=False,
        )
        self.outsider = User.objects.create_user(
            email="outsider-ws@test.com",
            password="password123",
            is_accountant=False,
        )
        self.service = Service.objects.create(
            accountant=self.accountant,
            name="Tax Filing",
            description="File taxes",
            indicative_price=100,
        )
        self.inquiry = Inquiry.objects.create(
            client=self.client_user,
            accountant=self.accountant,
            service=self.service,
            status=Inquiry.StatusChoices.OPEN,
        )
        self.client_token = str(AccessToken.for_user(self.client_user))
        self.outsider_token = str(AccessToken.for_user(self.outsider))

    def _ws_path(self, token=None):
        token = token or self.client_token
        return f"/ws/inquiries/{self.inquiry.id}/?token={token}"

    def test_participant_can_connect_to_closed_inquiry(self):
        self.inquiry.status = Inquiry.StatusChoices.CLOSED
        self.inquiry.save(update_fields=["status"])
        async_to_sync(self._assert_connect_ok)()

    async def _assert_connect_ok(self):
        communicator = WebsocketCommunicator(application, self._ws_path())
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()

    def test_ws_message_on_closed_inquiry_does_not_create_message(self):
        self.inquiry.status = Inquiry.StatusChoices.CLOSED
        self.inquiry.save(update_fields=["status"])
        async_to_sync(self._assert_closed_send_rejected)()
        self.assertEqual(Message.objects.count(), 0)

    async def _assert_closed_send_rejected(self):
        communicator = WebsocketCommunicator(application, self._ws_path())
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_to(
            text_data=json.dumps({"message": "Are you still available?"})
        )
        event = await communicator.receive_output(timeout=1)
        self.assertEqual(event["type"], "websocket.close")
        self.assertEqual(event["code"], 4008)

    def test_ws_blank_message_is_rejected(self):
        async_to_sync(self._assert_blank_rejected)()
        self.assertEqual(Message.objects.count(), 0)

    async def _assert_blank_rejected(self):
        communicator = WebsocketCommunicator(application, self._ws_path())
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_to(text_data=json.dumps({"message": "   "}))
        event = await communicator.receive_from(timeout=1)
        payload = json.loads(event)
        self.assertIn("error", payload)
        await communicator.disconnect()

    def test_ws_non_participant_cannot_connect(self):
        async_to_sync(self._assert_outsider_rejected)()
        self.assertEqual(Message.objects.count(), 0)

    async def _assert_outsider_rejected(self):
        communicator = WebsocketCommunicator(
            application, self._ws_path(token=self.outsider_token)
        )
        connected, _ = await communicator.connect()
        self.assertFalse(connected)

    def test_ws_message_on_open_inquiry_is_stored(self):
        async_to_sync(self._assert_open_send_ok)()
        self.assertEqual(Message.objects.count(), 1)
        self.assertEqual(Message.objects.get().content, "Hello")

    async def _assert_open_send_ok(self):
        communicator = WebsocketCommunicator(application, self._ws_path())
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_to(text_data=json.dumps({"message": "Hello"}))
        event = await communicator.receive_from(timeout=1)
        payload = json.loads(event)
        self.assertEqual(payload["content"], "Hello")
        await communicator.disconnect()
