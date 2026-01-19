from rest_framework import permissions

class IsAccountant(permissions.BasePermission):
    """
    Allows access only to users with accountant role
    """
    def has_permission(self, request, view):
       
        return (request.user and request.user.is_authenticated and request.user.is_accountant)


