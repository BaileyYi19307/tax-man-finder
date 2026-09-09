from rest_framework import serializers

from .field_utils import normalize_string_list
from .models import AccountantProfile


class StringListField(serializers.Field):
    """Read/write JSON string lists with normalization rules."""

    def __init__(self, *, field_name: str, **kwargs):
        self.field_name = field_name
        kwargs.setdefault("required", False)
        super().__init__(**kwargs)

    def to_representation(self, value):
        if value is None:
            return []
        return list(value)

    def to_internal_value(self, data):
        return normalize_string_list(data, field_name=self.field_name)


class AccountantProfileSerializer(serializers.ModelSerializer):
    """Validates and creates an Accountant Profile"""

    languages = StringListField(field_name="languages")
    industries = StringListField(field_name="industries")
    headline = serializers.CharField(
        max_length=160, allow_blank=True, required=False
    )
    website = serializers.URLField(
        allow_blank=True, required=False, max_length=500
    )
    license_information = serializers.CharField(
        allow_blank=True, required=False, trim_whitespace=True
    )

    class Meta:
        model = AccountantProfile
        fields = "__all__"
        read_only_fields = [
            "user",
            "profile_complete",
            "publication_status",
            "latitude",
            "longitude",
            "created_at",
            "updated_at",
        ]

    def validate_headline(self, value):
        return str(value or "").strip()


class AccountantProfileStatusSerializer(serializers.Serializer):
    profile_info_complete = serializers.BooleanField()
    services_exist = serializers.BooleanField()
    profile_complete = serializers.BooleanField()
    publication_status = serializers.CharField()
    is_publish_ready = serializers.BooleanField()
    is_public = serializers.BooleanField()
    # Owner/dashboard only; omitted from public status responses.
    publish_readiness_errors = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()),
        required=False,
        read_only=True,
    )
