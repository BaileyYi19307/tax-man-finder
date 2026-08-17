from users.permissions import IsAccountant


class IsServiceOwner(IsAccountant):
    """An accountant may only mutate services they own."""

    def has_object_permission(self, request, view, obj):
        return obj.accountant_id == request.user.id
