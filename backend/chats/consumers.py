import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Message
from .message_rules import MessageSendDenied, assert_can_send_message, clean_message_content
from inquiries.models import Inquiry
from rest_framework_simplejwt.authentication import JWTAuthentication


# Ongoing chat write path (start-conversation is HTTP POST /api/inquiries/):
#     WS /ws/inquiries/<id>/?token=JWT

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
        try: 
            validated_token = jwt_auth.get_validated_token(token)
            return jwt_auth.get_user(validated_token)
        except Exception:
            return None 

    @database_sync_to_async
    def user_is_participant(self, user):
        try: 
            inquiry = Inquiry.objects.get(id=self.inquiry_id)
        except Inquiry.DoesNotExist:
            return False
        return user in [inquiry.client, inquiry.accountant]
    
    async def connect(self):
        self.inquiry_id = self.scope["url_route"]["kwargs"]["inquiry_id"]      
        #obtains convo id parameter from the url route in chat/routing.py
        #every consumer has a scope that contains information about its connection 
        self.group_name = f"inquiry_{self.inquiry_id}" #construct a Channels group name 

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


    # receive message from websocket
    async def receive(self, text_data):
        
        try:         
            text_data_json = json.loads(text_data)
        except json.JSONDecodeError:
            return

        try:
            content = clean_message_content(text_data_json.get("message", ""))
        except MessageSendDenied:
            # Blank / whitespace: reject without creating a Message (keep socket open).
            await self.send(text_data=json.dumps({
                "error": "Message content cannot be blank.",
            }))
            return

        sender = self.scope["user"]

        try:
            message = await self.create_message(content, sender)
        except MessageSendDenied as exc:
            # Closed (or lost participant): close with domain code, no Message.
            code = 4008 if exc.code == "closed" else 4003
            await self.close(code=code)
            return

        await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "chat.message",
                        "id": message.id,
                        "content": message.content,
                        "sender_id": sender.id,
                        "created_at": message.created_at.isoformat(),
                        "attachments": [],
                        "is_system": False,
                    },
                )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "id": event["id"],
            "content": event["content"],
            "sender_id": event["sender_id"],
            "created_at": event["created_at"],
            "attachments": event.get("attachments") or [],
            "is_system": bool(event.get("is_system")),
        }))

    async def disconnect(self,close_code):
        # leave room group
        await self.channel_layer.group_discard(
            self.group_name, self.channel_name
        )

    @database_sync_to_async
    def create_message(self, content, sender):
        inquiry = Inquiry.objects.select_related("client", "accountant").get(
            id=self.inquiry_id
        )
        assert_can_send_message(sender, inquiry)
        return Message.objects.create(
            inquiry=inquiry,
            sender=sender,
            content=content,
        )
