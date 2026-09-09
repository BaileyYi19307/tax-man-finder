from django.db import models
from django.db.models import Exists, OuterRef, Q
from django.conf import settings


class AccountantProfileQuerySet(models.QuerySet):
    def publicly_visible(self):
        """
        Profiles that should appear in customer-facing discovery.

        Requires publication_status=published and current publish readiness
        (bio, credentials, location, and ≥1 active service in a public category).
        """
        from services.category_assignment import UNCATEGORIZED_SLUG
        from services.models import Service

        publishable_service = Service.objects.filter(
            accountant_id=OuterRef("user_id"),
            is_active=True,
            category__isnull=False,
            category__is_active=True,
        ).exclude(category__slug=UNCATEGORIZED_SLUG)

        return (
            self.filter(publication_status=AccountantProfile.PublicationStatus.PUBLISHED)
            .annotate(_has_publishable_service=Exists(publishable_service))
            .filter(_has_publishable_service=True)
            .exclude(Q(bio__isnull=True) | Q(bio=""))
            .exclude(credentials="")
            .exclude(location="")
        )


class AccountantProfile(models.Model):
    class ServiceScope(models.TextChoices):
        LOCAL = "local", "Local / in-person"
        REMOTE = "remote", "Remote"
        NATIONWIDE = "nationwide", "Nationwide"

    class PublicationStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="accountant_profile",
    )
    years_experience = models.IntegerField(default=0)
    credentials = models.TextField(blank=True, default="")
    bio = models.TextField(blank=True, null=True)
    firm_name = models.CharField(max_length=255, blank=True, default="")
    # Human-readable base/business location for display (not a service area).
    location = models.CharField(max_length=255, blank=True, default="")
    # Optional WGS84 base coordinates — required only for map pins / radius search.
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    # How the accountant serves clients (distinct from map pin = base location).
    service_scope = models.CharField(
        max_length=20,
        choices=ServiceScope.choices,
        default=ServiceScope.LOCAL,
    )
    # Explicit publication state (independent of readiness).
    publication_status = models.CharField(
        max_length=20,
        choices=PublicationStatus.choices,
        default=PublicationStatus.DRAFT,
    )
    # Legacy unused DB column — do not write; API uses computed readiness instead.
    profile_complete = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = AccountantProfileQuerySet.as_manager()

    def __str__(self):
        return f"AccountantProfile({self.user.email})"

    @staticmethod
    def _has_text(value) -> bool:
        return bool(str(value or "").strip())

    def publishable_services(self):
        """Active offerings in an active public category (not Uncategorized)."""
        from services.category_assignment import UNCATEGORIZED_SLUG

        return self.user.services.filter(
            is_active=True,
            category__isnull=False,
            category__is_active=True,
        ).exclude(category__slug=UNCATEGORIZED_SLUG)

    @property
    def is_profile_info_complete(self):
        """Bio + credentials present (subset of publish readiness)."""
        return self._has_text(self.credentials) and self._has_text(self.bio)

    @property
    def has_services(self):
        return self.user.services.filter(is_active=True).exists()

    @property
    def is_publish_ready(self) -> bool:
        """True when required profile fields and a valid categorized service exist."""
        return (
            self._has_text(self.bio)
            and self._has_text(self.credentials)
            and self._has_text(self.location)
            and self.publishable_services().exists()
        )

    @property
    def is_public(self) -> bool:
        """Customer-facing visibility: explicitly published and currently ready."""
        return (
            self.publication_status == self.PublicationStatus.PUBLISHED
            and self.is_publish_ready
        )

    @property
    def is_complete(self):
        """
        Compatibility alias for is_publish_ready.

        Exposed as profile_complete / accountant_profile_complete in API payloads
        so existing frontend gates align with publish readiness (not publication
        status). The unused DB column profile_complete is not consulted.
        """
        return self.is_publish_ready

    def publish_readiness_errors(self) -> dict:
        """Field-level errors describing what is missing to publish."""
        errors = {}
        if not self._has_text(self.bio):
            errors["bio"] = "Bio is required to publish."
        if not self._has_text(self.credentials):
            errors["credentials"] = "Credentials are required to publish."
        if not self._has_text(self.location):
            errors["location"] = "Location is required to publish."
        if not self.publishable_services().exists():
            errors["services"] = (
                "At least one active service with a valid public category "
                "is required to publish."
            )
        return errors

    @property
    def is_map_eligible(self):
        return self.latitude is not None and self.longitude is not None
