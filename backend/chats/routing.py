from django.urls import re_path

from .consumers import ChatConsumer

websocket_urlpatterns=[
    #call the as_asgi() - get an ASGI aplication that will instantiate an instance of our consumer for each user-connection
    re_path(r"^ws/inquries/(?P<inquiry_id>\d+)/$", ChatConsumer.as_asgi()),
]