from django.test import TestCase
from unittest.mock import patch
from rest_framework.test import APIClient

from users.models import User
from accountants.models import AccountantProfile
from accountants.geo import haversine_miles, DEFAULT_RADIUS_MILES
from services.models import Service
from django.urls import reverse

class ProfileStatusTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        #setup data for the whole test case

        #make a user
        cls.user = User.objects.create_user(
            email="acct@test.com",
            password="password123",
            is_accountant=True,
        )

        cls.profile = AccountantProfile.objects.create(
            user=cls.user,
            credentials="",
            bio="",
            years_experience=0,
        )
        
    def setUp(self):
        self.client = APIClient()

    def test_incomplete_initially(self):
        url = reverse("profile-status", args=[self.user.id])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["profile_complete"])

    def test_bio_complete_no_services(self):
        self.profile.credentials="CPA"
        self.profile.bio="hi"
        self.profile.years_experience = 3
        self.profile.save()

        url = reverse("profile-status", args=[self.user.id])
        resp = self.client.get(url)

        self.assertEqual(resp.status_code,200)
        self.assertFalse(resp.data["profile_complete"])
        
    def test_profile_complete_when_info_and_services_exist(self):
        self.profile.credentials="CPA"
        self.profile.bio="hi"
        self.profile.years_experience = 3
        self.profile.save()

        # Service.accountant is a User, not AccountantProfile
        Service.objects.create(
            accountant=self.user,
            name="Tax Filing",
            description="This is a tax filing",
            indicative_price=100,
        )
        
        url = reverse("profile-status", args=[self.user.id])
        resp = self.client.get(url)

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["profile_complete"])


class PublicAccountantProfileTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            email="public-acct@test.com",
            password="password123",
            is_accountant=True,
            first_name="Public",
            last_name="Acct",
        )
        cls.profile = AccountantProfile.objects.create(
            user=cls.user,
            credentials="CPA",
            bio="Helps with taxes",
            years_experience=5,
            firm_name="Public Tax",
            location="Remote",
        )
        cls.service = Service.objects.create(
            accountant=cls.user,
            name="Tax Filing",
            description="File taxes",
            indicative_price=100,
            is_active=True,
        )

    def setUp(self):
        self.client = APIClient()

    def test_public_profile_lists_active_services(self):
        url = reverse("public-accountant-profile", args=[self.user.id])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["user_id"], self.user.id)
        self.assertEqual(resp.data["email"], "public-acct@test.com")
        self.assertEqual(resp.data["first_name"], "Public")
        self.assertEqual(resp.data["firm_name"], "Public Tax")
        self.assertEqual(resp.data["location"], "Remote")
        self.assertEqual(len(resp.data["services"]), 1)
        self.assertEqual(resp.data["services"][0]["id"], self.service.id)


class AccountantDirectoryAndOnboardingTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.listed = User.objects.create_user(
            email="listed@test.com",
            password="password123",
            is_verified=True,
            first_name="Listed",
            last_name="Pro",
        )
        AccountantProfile.objects.create(
            user=cls.listed,
            credentials="CPA",
            bio="Helps with taxes",
            years_experience=5,
            firm_name="Listed Tax",
            location="Boston, MA",
        )
        Service.objects.create(
            accountant=cls.listed,
            name="Individual returns",
            description="Form 1040",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            is_active=True,
        )
        cls.incomplete = User.objects.create_user(
            email="incomplete@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(
            user=cls.incomplete,
            credentials="",
            bio="",
        )
        cls.client_user = User.objects.create_user(
            email="later-pro@test.com",
            password="password123",
            is_verified=True,
        )

    def setUp(self):
        self.client = APIClient()

    def test_directory_is_public(self):
        url = reverse("accountant-directory")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["user_id"], self.listed.id)
        self.assertEqual(resp.data[0]["email"], "listed@test.com")
        self.assertEqual(resp.data[0]["first_name"], "Listed")
        self.assertEqual(resp.data[0]["firm_name"], "Listed Tax")
        self.assertEqual(resp.data[0]["location"], "Boston, MA")
        self.assertTrue(resp.data[0]["profile_complete"])

    def test_directory_excludes_incomplete_profiles(self):
        bio_only = User.objects.create_user(
            email="bio-only@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(
            user=bio_only,
            credentials="EA",
            bio="Almost ready",
        )
        url = reverse("accountant-directory")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        ids = [row["user_id"] for row in resp.data]
        self.assertEqual(ids, [self.listed.id])
        self.assertNotIn(self.incomplete.id, ids)
        self.assertNotIn(bio_only.id, ids)

    def test_create_profile_requires_auth(self):
        url = reverse("create_accountant")
        resp = self.client.post(
            url,
            {"bio": "Bio", "credentials": "CPA", "years_experience": 2},
            format="json",
        )
        self.assertEqual(resp.status_code, 401)
        self.assertFalse(AccountantProfile.objects.filter(user=self.client_user).exists())

    def test_user_can_become_accountant_without_new_account(self):
        self.client.force_authenticate(user=self.client_user)
        url = reverse("create_accountant")
        resp = self.client.post(
            url,
            {
                "bio": "I prepare individual returns.",
                "credentials": "EA",
                "years_experience": 4,
                "user": self.listed.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        profile = AccountantProfile.objects.get(user=self.client_user)
        self.assertEqual(profile.credentials, "EA")
        self.assertEqual(profile.user_id, self.client_user.id)

    def test_new_accountant_can_access_accountant_dashboard(self):
        self.client.force_authenticate(user=self.client_user)
        self.client.post(
            reverse("create_accountant"),
            {
                "bio": "I prepare individual returns.",
                "credentials": "EA",
                "years_experience": 4,
            },
            format="json",
        )
        resp = self.client.get(reverse("accountant-dashboard"))
        self.assertEqual(resp.status_code, 200)

    def test_existing_profile_can_be_completed(self):
        empty = User.objects.create_user(
            email="empty-pro@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(user=empty, credentials="", bio="")
        self.client.force_authenticate(user=empty)
        resp = self.client.post(
            reverse("create_accountant"),
            {
                "bio": "Now complete.",
                "credentials": "CPA",
                "years_experience": 6,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        empty.accountant_profile.refresh_from_db()
        self.assertEqual(empty.accountant_profile.bio, "Now complete.")
        self.assertEqual(empty.accountant_profile.credentials, "CPA")

    def test_create_profile_requires_bio_and_credentials(self):
        self.client.force_authenticate(user=self.client_user)
        resp = self.client.post(
            reverse("create_accountant"),
            {"bio": "", "credentials": "CPA"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(AccountantProfile.objects.filter(user=self.client_user).exists())

    def test_own_profile_requires_auth(self):
        resp = self.client.get(reverse("my-accountant-profile"))
        self.assertEqual(resp.status_code, 401)

    def test_own_profile_404_without_profile(self):
        self.client.force_authenticate(user=self.client_user)
        resp = self.client.get(reverse("my-accountant-profile"))
        self.assertEqual(resp.status_code, 404)

    def test_onboarding_creates_profile_linked_to_authenticated_user(self):
        self.client.force_authenticate(user=self.client_user)
        resp = self.client.post(
            reverse("create_accountant"),
            {
                "first_name": "Ada",
                "last_name": "Lovelace",
                "firm_name": "Lovelace Tax",
                "location": "Remote",
                "bio": "I prepare individual returns.",
                "credentials": "EA",
                "years_experience": 4,
                "service_name": "Individual tax returns",
                "service_description": "Form 1040 preparation",
                "user": self.listed.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(AccountantProfile.objects.filter(user=self.client_user).count(), 1)
        self.assertEqual(AccountantProfile.objects.filter(user=self.listed).count(), 1)

        profile = AccountantProfile.objects.get(user=self.client_user)
        self.assertEqual(profile.firm_name, "Lovelace Tax")
        self.assertEqual(profile.location, "Remote")
        self.assertEqual(profile.user_id, self.client_user.id)
        self.assertTrue(profile.is_complete)

        self.client_user.refresh_from_db()
        self.assertEqual(self.client_user.first_name, "Ada")
        self.assertEqual(self.client_user.last_name, "Lovelace")
        self.assertTrue(
            Service.objects.filter(
                accountant=self.client_user,
                name="Individual tax returns",
                is_active=True,
            ).exists()
        )
        self.assertEqual(resp.data["first_name"], "Ada")
        self.assertTrue(resp.data["profile_complete"])

        me = self.client.get(reverse("users-me"))
        self.assertEqual(me.status_code, 200)
        self.assertTrue(me.data["has_accountant_profile"])
        self.assertTrue(me.data["accountant_profile_complete"])

        dashboard = self.client.get(reverse("accountant-dashboard"))
        self.assertEqual(dashboard.status_code, 200)

    def test_second_save_does_not_duplicate_profile_or_service(self):
        self.client.force_authenticate(user=self.client_user)
        payload = {
            "first_name": "Ada",
            "last_name": "Lovelace",
            "bio": "I prepare individual returns.",
            "credentials": "EA",
            "years_experience": 4,
            "service_name": "Individual tax returns",
        }
        first = self.client.post(reverse("create_accountant"), payload, format="json")
        second = self.client.post(
            reverse("create_accountant"),
            {**payload, "bio": "Updated bio.", "service_name": "Business taxes"},
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(AccountantProfile.objects.filter(user=self.client_user).count(), 1)
        self.assertEqual(Service.objects.filter(accountant=self.client_user).count(), 1)
        profile = AccountantProfile.objects.get(user=self.client_user)
        self.assertEqual(profile.bio, "Updated bio.")
        self.assertEqual(Service.objects.get(accountant=self.client_user).name, "Individual tax returns")

    def test_incomplete_profile_can_be_resumed_without_duplicate(self):
        empty = User.objects.create_user(
            email="resume-pro@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(user=empty, credentials="", bio="")
        self.client.force_authenticate(user=empty)
        own = self.client.get(reverse("my-accountant-profile"))
        self.assertEqual(own.status_code, 200)
        self.assertFalse(own.data["profile_complete"])

        with patch("accountants.views.geocode_query") as mock_geocode:
            mock_geocode.return_value = {
                "latitude": 42.3601,
                "longitude": -71.0589,
                "display_name": "Boston, MA",
            }
            resp = self.client.post(
                reverse("create_accountant"),
                {
                    "first_name": "Casey",
                    "last_name": "Taxes",
                    "bio": "Now complete.",
                    "credentials": "CPA",
                    "years_experience": 6,
                    "firm_name": "Casey CPA",
                    "location": "Boston, MA",
                    "service_name": "Tax planning",
                },
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(AccountantProfile.objects.filter(user=empty).count(), 1)
        empty.accountant_profile.refresh_from_db()
        self.assertEqual(empty.accountant_profile.bio, "Now complete.")
        self.assertEqual(empty.accountant_profile.firm_name, "Casey CPA")
        self.assertTrue(empty.accountant_profile.is_complete)
        self.assertEqual(Service.objects.filter(accountant=empty).count(), 1)

    def test_complete_profile_get_returns_existing_without_creating_another(self):
        self.client.force_authenticate(user=self.listed)
        before = AccountantProfile.objects.count()
        resp = self.client.get(reverse("my-accountant-profile"))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["user_id"], self.listed.id)
        self.assertEqual(AccountantProfile.objects.count(), before)


class MapDiscoveryDirectoryTest(TestCase):
    """Fixed-radius directory filter + map eligibility (ADR 001)."""

    # Center: City Hall, Philadelphia
    PHILLY_LAT = 39.9526
    PHILLY_LNG = -75.1652

    @classmethod
    def setUpTestData(cls):
        cls.near = User.objects.create_user(
            email="near-philly@test.com",
            password="password123",
            is_verified=True,
            first_name="Near",
            last_name="Philly",
        )
        AccountantProfile.objects.create(
            user=cls.near,
            credentials="CPA",
            bio="Near City Hall",
            firm_name="Near Tax",
            location="Philadelphia, PA",
            latitude=39.9500,
            longitude=-75.1600,
            service_scope=AccountantProfile.ServiceScope.LOCAL,
        )
        Service.objects.create(
            accountant=cls.near,
            name="Returns",
            description="1040",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            is_active=True,
        )

        cls.far = User.objects.create_user(
            email="far-la@test.com",
            password="password123",
            is_verified=True,
            first_name="Far",
            last_name="LA",
        )
        AccountantProfile.objects.create(
            user=cls.far,
            credentials="EA",
            bio="Los Angeles based",
            firm_name="LA Tax",
            location="Los Angeles, CA",
            latitude=34.0522,
            longitude=-118.2437,
            service_scope=AccountantProfile.ServiceScope.NATIONWIDE,
        )
        Service.objects.create(
            accountant=cls.far,
            name="Business",
            description="Biz",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            is_active=True,
        )

        cls.no_coords = User.objects.create_user(
            email="no-coords@test.com",
            password="password123",
            is_verified=True,
            first_name="No",
            last_name="Coords",
        )
        AccountantProfile.objects.create(
            user=cls.no_coords,
            credentials="CPA",
            bio="Complete but no map pin",
            firm_name="Text Only Tax",
            location="Philadelphia, PA",
            latitude=None,
            longitude=None,
            service_scope=AccountantProfile.ServiceScope.REMOTE,
        )
        Service.objects.create(
            accountant=cls.no_coords,
            name="Remote consult",
            description="Zoom",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            is_active=True,
        )

        cls.incomplete = User.objects.create_user(
            email="incomplete-map@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(
            user=cls.incomplete,
            credentials="CPA",
            bio="Has coords but incomplete (no service)",
            latitude=39.95,
            longitude=-75.16,
        )

    def setUp(self):
        self.client = APIClient()
        self.url = reverse("accountant-directory")

    def test_flat_directory_includes_complete_without_coordinates(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        ids = {row["user_id"] for row in resp.data}
        self.assertIn(self.near.id, ids)
        self.assertIn(self.far.id, ids)
        self.assertIn(self.no_coords.id, ids)
        self.assertNotIn(self.incomplete.id, ids)

        no_coords_row = next(r for r in resp.data if r["user_id"] == self.no_coords.id)
        self.assertIsNone(no_coords_row["latitude"])
        self.assertIsNone(no_coords_row["longitude"])
        self.assertFalse(no_coords_row["map_eligible"])
        self.assertEqual(no_coords_row["service_scope"], "remote")

        far_row = next(r for r in resp.data if r["user_id"] == self.far.id)
        self.assertTrue(far_row["map_eligible"])
        self.assertEqual(far_row["service_scope"], "nationwide")

    def test_geo_search_returns_only_in_radius_map_eligible(self):
        resp = self.client.get(
            self.url,
            {
                "latitude": self.PHILLY_LAT,
                "longitude": self.PHILLY_LNG,
                "radius_miles": 25,
            },
        )
        self.assertEqual(resp.status_code, 200)
        ids = [row["user_id"] for row in resp.data]
        self.assertEqual(ids, [self.near.id])
        self.assertNotIn(self.far.id, ids)
        self.assertNotIn(self.no_coords.id, ids)
        self.assertNotIn(self.incomplete.id, ids)

    def test_geo_search_excludes_outside_radius(self):
        distance = haversine_miles(
            self.PHILLY_LAT, self.PHILLY_LNG, 34.0522, -118.2437
        )
        self.assertGreater(distance, DEFAULT_RADIUS_MILES)
        resp = self.client.get(
            self.url,
            {
                "latitude": self.PHILLY_LAT,
                "longitude": self.PHILLY_LNG,
                "radius_miles": DEFAULT_RADIUS_MILES,
            },
        )
        ids = [row["user_id"] for row in resp.data]
        self.assertNotIn(self.far.id, ids)

    def test_geo_search_boundary_includes_point_at_exact_radius(self):
        # ~10 miles east of center
        point_lat = 39.9526
        point_lng = -74.9750
        dist = haversine_miles(self.PHILLY_LAT, self.PHILLY_LNG, point_lat, point_lng)
        self.assertLess(dist, 15)
        self.assertGreater(dist, 5)

        edge_user = User.objects.create_user(
            email="edge@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(
            user=edge_user,
            credentials="CPA",
            bio="Edge",
            latitude=point_lat,
            longitude=point_lng,
        )
        Service.objects.create(
            accountant=edge_user,
            name="Edge svc",
            description="x",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            is_active=True,
        )

        inside = self.client.get(
            self.url,
            {
                "latitude": self.PHILLY_LAT,
                "longitude": self.PHILLY_LNG,
                "radius_miles": dist + 0.5,
            },
        )
        outside = self.client.get(
            self.url,
            {
                "latitude": self.PHILLY_LAT,
                "longitude": self.PHILLY_LNG,
                "radius_miles": max(1, dist - 0.5),
            },
        )
        self.assertIn(edge_user.id, [r["user_id"] for r in inside.data])
        self.assertNotIn(edge_user.id, [r["user_id"] for r in outside.data])

    def test_geo_search_requires_both_coordinates(self):
        resp = self.client.get(self.url, {"latitude": self.PHILLY_LAT})
        self.assertEqual(resp.status_code, 400)

    def test_geo_search_rejects_invalid_latitude(self):
        resp = self.client.get(
            self.url,
            {"latitude": 999, "longitude": self.PHILLY_LNG, "radius_miles": 10},
        )
        self.assertEqual(resp.status_code, 400)

    def test_geo_search_rejects_invalid_radius(self):
        resp = self.client.get(
            self.url,
            {
                "latitude": self.PHILLY_LAT,
                "longitude": self.PHILLY_LNG,
                "radius_miles": 0,
            },
        )
        self.assertEqual(resp.status_code, 400)

    @patch("accountants.views.geocode_query")
    def test_profile_save_stores_coordinates_from_location(self, mock_geocode):
        mock_geocode.return_value = {
            "latitude": 39.9526,
            "longitude": -75.1652,
            "display_name": "Philadelphia, PA",
        }
        user = User.objects.create_user(
            email="geocode-save@test.com",
            password="password123",
            is_verified=True,
        )
        self.client.force_authenticate(user=user)
        resp = self.client.post(
            reverse("create_accountant"),
            {
                "bio": "Bio",
                "credentials": "CPA",
                "location": "Philadelphia, PA",
                "service_scope": "remote",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        profile = AccountantProfile.objects.get(user=user)
        self.assertAlmostEqual(float(profile.latitude), 39.9526, places=4)
        self.assertAlmostEqual(float(profile.longitude), -75.1652, places=4)
        self.assertEqual(profile.service_scope, "remote")
        self.assertTrue(resp.data["map_eligible"])
        mock_geocode.assert_called()

    @patch("accountants.views.geocode_query")
    def test_blank_location_clears_coordinates(self, mock_geocode):
        user = User.objects.create_user(
            email="clear-coords@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(
            user=user,
            credentials="CPA",
            bio="Bio",
            location="Philadelphia, PA",
            latitude=39.95,
            longitude=-75.16,
        )
        self.client.force_authenticate(user=user)
        resp = self.client.post(
            reverse("create_accountant"),
            {
                "bio": "Bio",
                "credentials": "CPA",
                "location": "",
                "service_scope": "local",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        user.accountant_profile.refresh_from_db()
        self.assertIsNone(user.accountant_profile.latitude)
        self.assertIsNone(user.accountant_profile.longitude)
        mock_geocode.assert_not_called()

    @patch("accountants.views.geocode_query")
    def test_geocode_endpoint_returns_coordinates(self, mock_geocode):
        mock_geocode.return_value = {
            "latitude": 39.9526,
            "longitude": -75.1652,
            "display_name": "Philadelphia, Pennsylvania, USA",
        }
        resp = self.client.get(reverse("accountant-geocode"), {"q": "Philadelphia, PA"})
        self.assertEqual(resp.status_code, 200)
        self.assertAlmostEqual(resp.data["latitude"], 39.9526, places=4)
        self.assertEqual(resp.data["display_name"], "Philadelphia, Pennsylvania, USA")

    def test_geocode_endpoint_requires_query(self):
        resp = self.client.get(reverse("accountant-geocode"))
        self.assertEqual(resp.status_code, 400)

    @patch("accountants.views.geocode_query")
    def test_onboarding_with_boston_location_mocked(self, mock_geocode):
        """Regression: resume save with location does not require live Nominatim."""
        mock_geocode.return_value = {
            "latitude": 42.3601,
            "longitude": -71.0589,
            "display_name": "Boston, MA",
        }
        empty = User.objects.create_user(
            email="resume-geo@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(user=empty, credentials="", bio="")
        self.client.force_authenticate(user=empty)
        resp = self.client.post(
            reverse("create_accountant"),
            {
                "bio": "Now complete.",
                "credentials": "CPA",
                "location": "Boston, MA",
                "service_name": "Tax planning",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        empty.accountant_profile.refresh_from_db()
        self.assertIsNotNone(empty.accountant_profile.latitude)

