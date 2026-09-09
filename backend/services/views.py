from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import viewsets

from .category_assignment import public_category_queryset
from .cancellation_policy import cancellation_policy_choices_payload
from .serializers import ServiceCategorySerializer, ServiceSerializer
from .models import Service
from .permissions import IsServiceOwner
from users.permissions import IsAccountant


class ServiceCategoryListView(APIView):
    """Read-only list of active, publicly assignable service categories."""

    permission_classes = [AllowAny]

    def get(self, request):
        categories = public_category_queryset()
        return Response(ServiceCategorySerializer(categories, many=True).data)


class CancellationPolicyListView(APIView):
    """Platform cancellation policy codes and customer-facing wording."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(cancellation_policy_choices_payload())


class ServicesViewSet(viewsets.ModelViewSet):
    """Public catalog for list/retrieve; accountants manage only their own services."""

    queryset = Service.objects.select_related("category").all()
    serializer_class = ServiceSerializer

    def get_queryset(self):
        from accountants.models import AccountantProfile

        qs = Service.objects.select_related("category", "accountant").all()
        if self.action in ("list", "retrieve"):
            public_accountant_ids = AccountantProfile.objects.publicly_visible().values(
                "user_id"
            )
            return qs.filter(
                is_active=True,
                accountant_id__in=public_accountant_ids,
            )
        return qs

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
