from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsAccountant(BasePermission):
    """
    Read access for everyone, but write access only for accountants
    """
    def has_permission(self, request, view):

        #allow get, head, options for anyone 
        if request.method in SAFE_METHODS:
            return True
        
        #only accountants can write
       

