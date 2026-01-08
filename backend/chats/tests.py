
import json
from django.test import TestCase
from channels.testing import WebsocketCommunicator
from .consumers import ChatConsumer

class ChatTests(TestCase):
    async def test_my_consumer(self):
        communicator = WebsocketCommunicator(
            ChatConsumer.as_asgi(),
            "/testws/"
        )
        connected, _ = await communicator.connect()
        assert connected

        await communicator.send_to(
            text_data=json.dumps({"message": "hello"})
        )

        response = await communicator.receive_from()
        assert json.loads(response)["message"] == "hello"

        await communicator.disconnect()
