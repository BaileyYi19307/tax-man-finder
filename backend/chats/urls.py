from django.urls import path

from . import views

urlpatterns = [
    path("",views.index,name="index"),
    path("<str:room_name>/", views.room, name="room"),
    path("conversations/", views.ConversationView.as_view(), name="get-conversations"),
    path(
        "conversations/<int:conversation_id>/messages/",
       views.MessageListView.as_view(),
        name="conversation-messages",
    ),
]