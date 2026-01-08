from django.urls import re_path

from . import consumers

websocket_urlpatterns=[
    #call the as_asgi() - get an ASGI aplication that will instantiate an instance of our consumer for each user-connection
    re_path(r"ws/chat/(?P<room_name>\w+)/$", consumers.ChatConsumer.as_asgi()),
]