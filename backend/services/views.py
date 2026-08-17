from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import viewsets

from .serializers import ServiceSerializer
from .models import Service
from .permissions import IsServiceOwner
from users.permissions import IsAccountant


class ServicesViewSet(viewsets.ModelViewSet):
    """Public catalog for list/retrieve; accountants manage only their own services."""

    queryset = Service.objects.all()
    serializer_class = ServiceSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        if self.action == "mine":
            return [IsAccountant()]
        return [IsServiceOwner()]

    def perform_create(self, serializer):
        serializer.save(accountant=self.request.user)

    @action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        services = (
            self.get_queryset()
            .filter(accountant=request.user)
            .order_by("name", "id")
        )
        serializer = self.get_serializer(services, many=True)
        return Response(serializer.data)
