import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Message
from inquiries.models import Inquiry
from rest_framework_simplejwt.authentication import JWTAuthentication


# WebSocket is the single write path:
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
        content = text_data_json.get("message","").strip()
        if not content:
            return

        sender_id=self.scope["user"].id
        print("WS RECEIVE:", content, "from", sender_id)

        message= await self.create_message(content,sender_id)

        # send message to room group
        #sends an event to a group
            # event has a special 'type' key 
            #chat.message calls the chat_message method

        await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "chat.message",
                        "id": message.id,
                        "content": message.content,
                        "sender_id": sender_id,
                        "created_at": message.created_at.isoformat(),
                    },
                )

    async def chat_message(self, event):
        print("WS SEND:", event)

        await self.send(text_data=json.dumps({
            "id": event["id"],
            "content": event["content"],
            "sender_id": event["sender_id"], 
            "created_at": event["created_at"]
        }))


    

    async def disconnect(self,close_code):
        # leave room group
        await self.channel_layer.group_discard(
            self.group_name, self.channel_name
        )

    @database_sync_to_async
    def create_message(self,content,sender_id):
        inquiry=Inquiry.objects.get(id = self.inquiry_id)
        return Message.objects.create(
            inquiry=inquiry,
            sender_id=sender_id,
            content=content
        )
    

