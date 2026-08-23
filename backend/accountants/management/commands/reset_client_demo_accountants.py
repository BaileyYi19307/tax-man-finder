"""
Reset local/demo public accountants to exactly four fake profiles.

Usage (from backend/, venv active, DEBUG=True only):

  python manage.py reset_client_demo_accountants

Safety:
  - Refuses to run when DEBUG is False.
  - Preserves client users and inquiries/messages/bookings tied to non-demo accountants
    (e.g. pro@test.com) by hiding them from the public directory instead of deleting users.
  - Deletes only disposable *@example.com demo accountant users created by this / prior map seeds.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from accountants.models import AccountantProfile
from services.models import Service
from users.models import User

DEMO_PASSWORD = "DemoMap123!"
DEMO_EMAIL_DOMAIN = "example.com"
DEMO_EMAIL_PREFIXES = ("demo.map.", "demo.acct.")

DEMO_ACCOUNTANTS = [
    {
        "email": "demo.acct.jordan@example.com",
        "first_name": "Jordan",
        "last_name": "Lee",
        "firm_name": "Lee & Associates Tax",
        "credentials": "CPA",
        "bio": "Helps Philadelphia families with year-round tax planning and clean annual filings.",
        "location": "Philadelphia, PA",
        "latitude": 39.9526,
        "longitude": -75.1652,
        "service_scope": AccountantProfile.ServiceScope.LOCAL,
        "years_experience": 8,
        "service_name": "Individual tax returns",
        "service_description": "Form 1040 preparation and filing support.",
        "pricing_type": Service.PricingType.FIXED,
        "indicative_price": "350.00",
        "consultation_fee": "0.00",
        "cancellation_policy": "Free consultations can be cancelled any time before the meeting.",
    },
    {
        "email": "demo.acct.maya@example.com",
        "first_name": "Maya",
        "last_name": "Patel",
        "firm_name": "Patel Tax Studio",
        "credentials": "CPA",
        "bio": "Princeton-based CPA focused on small-business bookkeeping and quarterly estimates.",
        "location": "Princeton, NJ",
        "latitude": 40.3573,
        "longitude": -74.6672,
        "service_scope": AccountantProfile.ServiceScope.LOCAL,
        "years_experience": 6,
        "service_name": "Small business bookkeeping",
        "service_description": "Monthly books and quarterly estimated taxes.",
        "pricing_type": Service.PricingType.HOURLY,
        "indicative_price": "175.00",
        "consultation_fee": "50.00",
        "cancellation_policy": (
            "Cancel at least 24 hours before the consultation for a full refund of the "
            "consultation fee. Later cancellations are non-refundable."
        ),
    },
    {
        "email": "demo.acct.alex@example.com",
        "first_name": "Alex",
        "last_name": "Morgan",
        "firm_name": "Morgan Remote Tax",
        "credentials": "EA",
        "bio": "Enrolled Agent offering remote tax help for freelancers and NYC professionals.",
        "location": "New York, NY",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "service_scope": AccountantProfile.ServiceScope.REMOTE,
        "years_experience": 10,
        "service_name": "Freelance tax consult",
        "service_description": "Remote consult for 1099 income and deductions.",
        "pricing_type": Service.PricingType.FIXED,
        "indicative_price": "225.00",
        "consultation_fee": "75.00",
        "cancellation_policy": (
            "Consultation fee is refundable if cancelled 48 hours or more before the meeting."
        ),
    },
    {
        "email": "demo.acct.taylor@example.com",
        "first_name": "Taylor",
        "last_name": "Chen",
        "firm_name": "Capitol Chen CPA",
        "credentials": "CPA",
        "bio": "Washington, DC CPA supporting multi-state filers and nationwide remote clients.",
        "location": "Washington, DC",
        "latitude": 38.9072,
        "longitude": -77.0369,
        "service_scope": AccountantProfile.ServiceScope.NATIONWIDE,
        "years_experience": 12,
        "service_name": "Multi-state tax filing",
        "service_description": "Returns spanning multiple state jurisdictions.",
        "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
        "indicative_price": None,
        "consultation_fee": "0.00",
        "cancellation_policy": "Introductory consultations are free; cancel anytime before the meeting.",
    },
]


def _is_disposable_demo_email(email: str) -> bool:
    email = (email or "").lower()
    if not email.endswith(f"@{DEMO_EMAIL_DOMAIN}"):
        return False
    return any(email.startswith(prefix) for prefix in DEMO_EMAIL_PREFIXES)


class Command(BaseCommand):
    help = (
        "DEBUG-only: hide non-demo public accountants and seed exactly four "
        "complete map demo accountants."
    )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "reset_client_demo_accountants only runs when DEBUG=True."
            )

        with transaction.atomic():
            report = self._reset()

        self.stdout.write(self.style.SUCCESS("Demo accountant reset complete."))
        for line in report:
            self.stdout.write(f"  {line}")

    def _reset(self):
        report = []
        demo_emails = {row["email"] for row in DEMO_ACCOUNTANTS}

        # 1) Delete prior disposable demo users (old map seeds + this command).
        disposable = User.objects.filter(
            Q(email__iendswith=f"@{DEMO_EMAIL_DOMAIN}")
            & (
                Q(email__istartswith="demo.map.")
                | Q(email__istartswith="demo.acct.")
            )
        )
        deleted_emails = list(disposable.values_list("email", flat=True))
        deleted_count, _ = disposable.delete()
        report.append(
            f"Deleted disposable demo users/rows cascade count≈{deleted_count} "
            f"({', '.join(deleted_emails) or 'none'})"
        )

        # 2) Hide other complete public accountants without deleting users
        #    (preserves inquiries such as client@test.com ↔ pro@test.com).
        hidden = []
        for profile in AccountantProfile.objects.select_related("user"):
            email = profile.user.email
            if email in demo_emails or _is_disposable_demo_email(email):
                continue
            if not profile.is_complete:
                continue
            updated = Service.objects.filter(
                accountant=profile.user, is_active=True
            ).update(is_active=False)
            if updated:
                hidden.append(f"{email} (deactivated {updated} service(s))")
        report.append(
            "Hidden non-demo public accountants by deactivating services: "
            + (", ".join(hidden) if hidden else "none")
        )

        # 3) Upsert the four demo accountants.
        for row in DEMO_ACCOUNTANTS:
            user, created = User.objects.get_or_create(
                email=row["email"],
                defaults={
                    "first_name": row["first_name"],
                    "last_name": row["last_name"],
                    "is_verified": True,
                    "is_accountant": True,
                },
            )
            if created:
                user.set_password(DEMO_PASSWORD)
            user.first_name = row["first_name"]
            user.last_name = row["last_name"]
            user.is_verified = True
            user.is_accountant = True
            user.save()

            profile, _ = AccountantProfile.objects.get_or_create(user=user)
            profile.credentials = row["credentials"]
            profile.bio = row["bio"]
            profile.firm_name = row["firm_name"]
            profile.location = row["location"]
            profile.latitude = row["latitude"]
            profile.longitude = row["longitude"]
            profile.service_scope = row["service_scope"]
            profile.years_experience = row["years_experience"]
            profile.save()

            Service.objects.filter(accountant=user).update(is_active=False)
            Service.objects.create(
                accountant=user,
                name=row["service_name"],
                description=row["service_description"],
                pricing_type=row["pricing_type"],
                indicative_price=row["indicative_price"],
                consultation_fee=row.get("consultation_fee"),
                cancellation_policy=row.get("cancellation_policy") or "",
                is_active=True,
            )

            report.append(
                f"{'Created' if created else 'Updated'} {row['first_name']} {row['last_name']} "
                f"| {row['location']} | ({row['latitude']}, {row['longitude']}) "
                f"| {row['service_name']} | complete={profile.is_complete} "
                f"map={profile.is_map_eligible}"
            )

        clients = User.objects.filter(accountant_profile__isnull=True).count()
        # Users without profile relation:
        from django.db.models import Exists, OuterRef

        has_profile = AccountantProfile.objects.filter(user_id=OuterRef("pk"))
        client_like = User.objects.annotate(has_p=Exists(has_profile)).filter(has_p=False)
        report.append(f"Users without accountant profile (preserved clients/misc): {client_like.count()}")
        report.append(f"Accountant profiles now: {AccountantProfile.objects.count()}")
        report.append(f"Demo login password for new demo users: {DEMO_PASSWORD}")
        return report
