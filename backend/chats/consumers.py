import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import async_to_sync 
from channels.generic.websocket import WebsocketConsumer
from .models import Conversation
from channels.db import database_sync_to_async
from .models import Message

from rest_framework_simplejwt.authentication import JWTAuthentication
from django.contrib.auth.models import AnonymousUser


# WebSocket is the single write path:
#     WS /ws/conversations/<id>/?token=JWT

class ChatConsumer(AsyncWebsocketConsumer):
    async def authenticate(self):
        query = self.scope["query_string"].decode()
        token = None

        if "token=" in query:
            token = query.split("token=")[1]

        return await self.get_user_from_token(token)

    @database_sync_to_async
    def get_user_from_token(self, token):
        if not token:
            return None

        jwt_auth = JWTAuthentication()
        validated_token = jwt_auth.get_validated_token(token)
        return jwt_auth.get_user(validated_token)


    @database_sync_to_async
    def user_is_participant(self, user):
        conversation = Conversation.objects.get(id=self.conversation_id)
        inquiry = conversation.inquiry
        return user in [inquiry.client, inquiry.accountant]
    
    async def connect(self):
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]      
        #obtains convo id parameter from the url route in chat/routing.py
        #every consumer has a scope that contains information about its connection 
        self.group_name = f"conversation_{self.conversation_id}" #construct a Channels group name 

        user = await self.authenticate()

        if not user:
            await self.close(code=4001)
            return

        is_allowed = await self.user_is_participant(user)
        if not is_allowed:
            await self.close(code=4003)
            return

        self.scope["user"] = user

        #join a group 
        await self.channel_layer.group_add(
            self.group_name, self.channel_name
        )

        await self.accept() # accepts the websocket connection



    @database_sync_to_async
    def get_conversation(self):
        return Conversation.objects.get(id=self.conversation_id)

    # receive message from websocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        body = text_data_json["message"]

        sender_id=self.scope["user"].id

        message= await self.create_message(body,sender_id)

        # send message to room group
        #sends an event to a group
            # event has a special 'type' key 
            #chat.message calls the chat_message method
        await self.channel_layer.group_send(
            self.group_name, {"type": "chat.message", "id":message.id,"body":message.body,"created_at": message.created_at.isoformat(),
}
        )

    async def disconnect(self,close_code):
        # leave room group
        await self.channel_layer.group_discard(
            self.group_name, self.channel_name
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "id":event["id"],
            "body":event["body"],
            "created_at":event["created_at"]
        }))

    @database_sync_to_async
    def create_message(self,body,sender_id):
        conversation=Conversation.objects.get(id = self.conversation_id)
        return Message.objects.create(
            conversation=conversation,
            sender_id=sender_id,
            body=body
        )
    

