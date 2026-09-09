from django.apps import apps
from django.db import IntegrityError, connection, transaction
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from bookings.models import Booking
from inquiries.models import Inquiry
from users.models import User

from .category_seed import seed_categories_and_backfill_services
from .models import Service, ServiceCategory


class ServiceCategoryModelTest(TestCase):
    def test_slug_must_be_unique(self):
        ServiceCategory.objects.create(
            name="Bookkeeping",
            slug="bookkeeping-unique-test",
            sort_order=1,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ServiceCategory.objects.create(
                    name="Bookkeeping duplicate",
                    slug="bookkeeping-unique-test",
                    sort_order=2,
                )

    def test_default_ordering_is_sort_order_then_name(self):
        ServiceCategory.objects.create(name="Zulu", slug="zulu", sort_order=20)
        ServiceCategory.objects.create(name="Alpha", slug="alpha", sort_order=10)
        ServiceCategory.objects.create(name="Beta", slug="beta", sort_order=10)
        names = list(
            ServiceCategory.objects.filter(
                slug__in=["zulu", "alpha", "beta"]
            ).values_list("name", flat=True)
        )
        self.assertEqual(names, ["Alpha", "Beta", "Zulu"])


class ServiceCategorySeedMigrationTest(TestCase):
    EXPECTED_ACTIVE_SLUGS = (
        "individual-tax-returns",
        "small-business-tax-returns",
        "tax-planning",
        "bookkeeping",
        "payroll",
        "sales-tax",
        "business-formation",
        "irs-notices-and-tax-resolution",
    )

    def test_mvp_categories_are_seeded_active(self):
        for slug in self.EXPECTED_ACTIVE_SLUGS:
            category = ServiceCategory.objects.get(slug=slug)
            self.assertTrue(category.is_active)
            self.assertTrue(category.name)

    def test_uncategorized_is_seeded_inactive(self):
        uncategorized = ServiceCategory.objects.get(slug="uncategorized")
        self.assertFalse(uncategorized.is_active)
        self.assertEqual(uncategorized.name, "Uncategorized")

    def test_no_other_category_seeded(self):
        self.assertFalse(ServiceCategory.objects.filter(slug="other").exists())


class ServiceCategoryNullableFkTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.accountant = User.objects.create_user(
            email="category-fk@example.com",
            password="testpassword",
            is_verified=True,
        )

    def test_service_category_is_optional(self):
        service = Service.objects.create(
            name="Custom offering",
            description="Accountant-authored description",
            accountant=self.accountant,
        )
        self.assertIsNone(service.category_id)

    def test_service_can_link_to_category_without_changing_pk(self):
        service = Service.objects.create(
            name="Linked offering",
            description="desc",
            accountant=self.accountant,
        )
        original_pk = service.pk
        category = ServiceCategory.objects.get(slug="tax-planning")
        service.category = category
        service.save(update_fields=["category"])
        service.refresh_from_db()
        self.assertEqual(service.pk, original_pk)
        self.assertEqual(service.category_id, category.id)


class ServiceCategoryBackfillAndBookingStabilityTest(TestCase):
    def test_exact_name_maps_and_booking_service_fk_preserved(self):
        accountant = User.objects.create_user(
            email="mapped-acct@example.com",
            password="testpassword",
            is_verified=True,
        )
        client = User.objects.create_user(
            email="mapped-client@example.com",
            password="testpassword",
            is_verified=True,
        )
        service = Service.objects.create(
            name="Individual tax returns",
            description="Federal and state",
            accountant=accountant,
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
        )
        service_id = service.id
        individual = ServiceCategory.objects.get(slug="individual-tax-returns")
        service.category = individual
        service.save(update_fields=["category"])

        starts = timezone.now() + timedelta(days=2)
        inquiry = Inquiry.objects.create(client=client, accountant=accountant)
        booking = Booking.objects.create(
            inquiry=inquiry,
            client=client,
            accountant=accountant,
            service=service,
            starts_at=starts,
            ends_at=starts + timedelta(minutes=30),
        )

        self.assertEqual(booking.service_id, service_id)
        self.assertEqual(Service.objects.get(pk=service_id).category_id, individual.id)
        self.assertEqual(Booking.objects.get(pk=booking.pk).service_id, service_id)

    def test_non_exact_names_use_uncategorized_rule(self):
        accountant = User.objects.create_user(
            email="uncat-acct@example.com",
            password="testpassword",
            is_verified=True,
        )
        service = Service.objects.create(
            name="Tax Filing",
            description="Ambiguous legacy title",
            accountant=accountant,
        )
        uncategorized = ServiceCategory.objects.get(slug="uncategorized")
        service.category = uncategorized
        service.save(update_fields=["category"])
        service.refresh_from_db()
        self.assertEqual(service.category_id, uncategorized.id)
        self.assertFalse(service.category.is_active)


class ServiceCategoryMigrationBackfillTest(TestCase):
    """Exercise the data-migration backfill helper against historical rows."""

    def test_seed_migration_maps_exact_names_only(self):
        accountant = User.objects.create_user(
            email="migrate-backfill@example.com",
            password="testpassword",
            is_verified=True,
        )
        exact = Service.objects.create(
            name="Bookkeeping",
            description="Exact category name",
            accountant=accountant,
            category=None,
        )
        fuzzy = Service.objects.create(
            name="Small business bookkeeping",
            description="Not an exact category name",
            accountant=accountant,
            category=None,
        )
        exact_id, fuzzy_id = exact.id, fuzzy.id

        seed_categories_and_backfill_services(apps, connection.schema_editor())

        exact.refresh_from_db()
        fuzzy.refresh_from_db()
        self.assertEqual(exact.id, exact_id)
        self.assertEqual(fuzzy.id, fuzzy_id)
        self.assertEqual(exact.category.slug, "bookkeeping")
        self.assertEqual(fuzzy.category.slug, "uncategorized")
