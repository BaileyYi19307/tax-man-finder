from rest_framework.permissions import BasePermission

class IsAccountant(BasePermission):
    """
    is the authenticated user an accountant? 
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.has_accountant_profile()
            
       

