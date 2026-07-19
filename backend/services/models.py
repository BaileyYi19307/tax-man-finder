from django.db import models
from django.conf import settings
# Create your models here.
class Service(models.Model):

    #first value represents database representation, second value represents human readable representation
    class PricingType(models.TextChoices):
        FIXED = 'fixed', 'Fixed'
        HOURLY = 'hourly', 'Hourly'
        CONSULTATION_REQUIRED = 'consultation_required', 'Consultation Required'
        
    name = models.CharField(max_length=255)
    description = models.TextField()
    accountant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="services")

    pricing_type = models.CharField(max_length=32,choices=PricingType.choices,default=PricingType.FIXED)
    indicative_price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    is_active=models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name