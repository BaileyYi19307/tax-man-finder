from django.urls import path

from . import views

urlpatterns = [
    path("conversations/", views.ConversationView.as_view(), name="get-conversations"),
    path(
        "conversations/<int:conversation_id>/messages/",
       views.MessageListView.as_view(),
        name="conversation-messages",
    ),
    ]