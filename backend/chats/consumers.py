import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import async_to_sync 
from channels.generic.websocket import WebsocketConsumer


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        #obtrains room_name parameter from the url route in chat/routing.py
        #every consumer has a scope that contains information about its connection 
        self.room_group_name = f"chat_{self.room_name}" #construct a Channels group name 

        #join a group 
        await self.channel_layer.group_add(
            self.room_group_name, self.channel_name
        )

        await self.accept() # accepts the websocket connection

    # receive message from websocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json["message"]

        # send message to room group
        #sends an event to a group
            # event has a special 'type' key 
            #chat.message calls the chat_message method
        await self.channel_layer.group_send(
            self.room_group_name, {"type": "chat.message", "message": message}
        )

    async def disconnect(self,close_code):
        # leave room group
        await self.channel_layer.group_discard(
            self.room_group_name, self.channel_name
        )

    # receive message from room group
    async def chat_message(self, event):
        message = event["message"]

        # Send message to WebSocket
        await self.send(text_data=json.dumps({"message": message}))
