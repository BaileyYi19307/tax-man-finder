# chats/permissions.py
from rest_framework.permissions import BasePermission

class IsConversationParticipant(BasePermission):
    def has_object_permission(self, request, view, obj):
        inquiry = obj.inquiry
        return request.user in [inquiry.client, inquiry.accountant]
