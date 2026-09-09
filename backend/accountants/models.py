from django.db import models
from django.db.models import Exists, F, OuterRef, Q, Value
from django.db.models.functions import Replace, Trim
from django.conf import settings


def _trimmed_text(field_name: str):
    """
    DB equivalent of str.strip() for common whitespace (spaces, tabs, newlines).

    Used so publicly_visible / backfill agree with is_publish_ready._has_text.
    """
    cleaned = F(field_name)
    for ch in ("\t", "\n", "\r"):
        cleaned = Replace(cleaned, Value(ch), Value(""))
    return Trim(cleaned, output_field=models.TextField())


class AccountantProfileQuerySet(models.QuerySet):
    def publicly_visible(self):
        """
        Profiles that should appear in customer-facing discovery.

        Requires publication_status=published and current publish readiness
        (name, bio, credentials, location, languages, availability, and ≥1
        active service in a public category). Text fields are trimmed so
        whitespace-only values match is_publish_ready.
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
            .filter(Q(offers_remote=True) | Q(offers_in_person=True))
            .exclude(Q(languages=[]) | Q(languages__isnull=True))
            .annotate(
                _has_publishable_service=Exists(publishable_service),
                _first_name_trimmed=_trimmed_text("user__first_name"),
                _last_name_trimmed=_trimmed_text("user__last_name"),
                _bio_trimmed=_trimmed_text("bio"),
                _credentials_trimmed=_trimmed_text("credentials"),
                _location_trimmed=_trimmed_text("location"),
            )
            .filter(_has_publishable_service=True)
            .exclude(_first_name_trimmed="")
            .exclude(_last_name_trimmed="")
            .exclude(Q(_bio_trimmed__isnull=True) | Q(_bio_trimmed=""))
            .exclude(_credentials_trimmed="")
            .exclude(_location_trimmed="")
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
    headline = models.CharField(max_length=160, blank=True, default="")
    languages = models.JSONField(default=list, blank=True)
    offers_remote = models.BooleanField(default=False)
    offers_in_person = models.BooleanField(default=False)
    industries = models.JSONField(default=list, blank=True)
    website = models.URLField(max_length=500, blank=True, default="")
    license_information = models.TextField(blank=True, default="")
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
        """True when all publish requirements are currently satisfied."""
        return not self.publish_readiness_errors()

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

    def _normalized_languages(self) -> list:
        raw = self.languages
        if not isinstance(raw, list):
            return []
        return [str(item).strip() for item in raw if str(item or "").strip()]

    def publish_readiness_errors(self) -> dict:
        """
        Field-level publish gaps as DRF-style lists.

        Empty dict when the profile is publish-ready. Single source of truth for
        publish validation and owner dashboard payloads. Uses offers_remote /
        offers_in_person (not legacy service_scope).
        """
        errors = {}
        user = self.user
        if not self._has_text(getattr(user, "first_name", "")):
            errors["first_name"] = ["First name is required to publish."]
        if not self._has_text(getattr(user, "last_name", "")):
            errors["last_name"] = ["Last name is required to publish."]
        if not self._has_text(self.bio):
            errors["bio"] = ["Bio is required to publish."]
        if not self._has_text(self.location):
            errors["location"] = ["Location is required to publish."]
        if not self._has_text(self.credentials):
            errors["credentials"] = ["Credentials are required to publish."]
        if not self._normalized_languages():
            errors["languages"] = [
                "At least one language is required to publish."
            ]
        if not (self.offers_remote or self.offers_in_person):
            errors["availability"] = [
                "Select remote and/or in-person availability to publish."
            ]
        if not self.publishable_services().exists():
            errors["services"] = [
                "At least one active service with a valid public category "
                "is required to publish."
            ]
        return errors

    @property
    def is_map_eligible(self):
        return self.latitude is not None and self.longitude is not None
