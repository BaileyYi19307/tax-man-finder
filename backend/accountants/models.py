from django.db import models
from users.models import User
from django.conf import settings


class AccountantProfile(models.Model):
    class ServiceScope(models.TextChoices):
        LOCAL = "local", "Local / in-person"
        REMOTE = "remote", "Remote"
        NATIONWIDE = "nationwide", "Nationwide"

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
    profile_complete = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"AccountantProfile({self.user.email})"

    @property
    def is_profile_info_complete(self):
        return bool(self.credentials and self.bio)

    @property
    def has_services(self):
        return self.user.services.filter(is_active=True).exists()

    @property
    def is_complete(self):
        return self.is_profile_info_complete and self.has_services

    @property
    def is_map_eligible(self):
        return self.latitude is not None and self.longitude is not None