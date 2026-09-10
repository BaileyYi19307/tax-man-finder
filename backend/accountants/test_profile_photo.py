"""Accountant profile photo upload, validation, and payload URL tests."""

import io
import tempfile
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from accountants.models import AccountantProfile
from services.models import Service, ServiceCategory
from users.models import User

MEDIA_ROOT = tempfile.mkdtemp()


def _image_bytes(fmt="JPEG", size=(40, 40), color=(20, 80, 40)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format=fmt)
    return buf.getvalue()


def _upload(name="photo.jpg", fmt="JPEG", content_type="image/jpeg", size=(40, 40)):
    return SimpleUploadedFile(
        name,
        _image_bytes(fmt=fmt, size=size),
        content_type=content_type,
    )


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class AccountantProfilePhotoApiTest(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user(
            email="photo-owner@test.com",
            password="password123",
            is_verified=True,
            first_name="Pat",
            last_name="Pro",
        )
        self.api.force_authenticate(self.user)
        self.url = reverse("create_accountant")
        self.category = ServiceCategory.objects.filter(is_active=True).first()

    def _ready_profile(self):
        profile = AccountantProfile.objects.create(
            user=self.user,
            bio="Helps with taxes",
            credentials="CPA",
            location="Austin, TX",
            languages=["English"],
            offers_remote=True,
            publication_status=AccountantProfile.PublicationStatus.PUBLISHED,
        )
        Service.objects.create(
            accountant=self.user,
            name="Returns",
            description="Filing",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.category,
            is_active=True,
        )
        return profile

    def test_upload_jpeg_returns_profile_photo_url(self):
        resp = self.api.post(
            self.url,
            {"bio": "Draft bio", "profile_photo": _upload()},
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        url = resp.data.get("profile_photo_url")
        self.assertTrue(url)
        self.assertIn("/media/", url)
        self.assertNotIn(str(Path(MEDIA_ROOT)), url)
        profile = AccountantProfile.objects.get(user=self.user)
        self.assertTrue(profile.profile_photo)

    def test_png_and_webp_accepted(self):
        for name, fmt, ctype in (
            ("a.png", "PNG", "image/png"),
            ("b.webp", "WEBP", "image/webp"),
        ):
            with self.subTest(name=name):
                resp = self.api.post(
                    self.url,
                    {
                        "bio": "Draft",
                        "profile_photo": _upload(name=name, fmt=fmt, content_type=ctype),
                    },
                    format="multipart",
                )
                self.assertIn(resp.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
                self.assertTrue(resp.data.get("profile_photo_url"))

    def test_rejects_invalid_type_and_non_image(self):
        bad = SimpleUploadedFile("x.gif", b"GIF89a", content_type="image/gif")
        resp = self.api.post(self.url, {"profile_photo": bad}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("profile_photo", resp.data)

        fake = SimpleUploadedFile(
            "x.jpg", b"not-an-image", content_type="image/jpeg"
        )
        resp = self.api.post(self.url, {"profile_photo": fake}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("profile_photo", resp.data)

    def test_rejects_oversized_image(self):
        huge = SimpleUploadedFile(
            "big.jpg",
            _image_bytes(size=(2000, 2000)),
            content_type="image/jpeg",
        )
        # Force size check by wrapping with oversized reported size via content.
        # Create a file larger than 5MB of JPEG-ish bytes.
        payload = b"\xff\xd8\xff" + (b"0" * (5 * 1024 * 1024 + 10))
        huge = SimpleUploadedFile("big.jpg", payload, content_type="image/jpeg")
        resp = self.api.post(self.url, {"profile_photo": huge}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("profile_photo", resp.data)

    def test_replace_and_remove_photo(self):
        first = self.api.post(
            self.url,
            {"bio": "One", "profile_photo": _upload(name="one.jpg")},
            format="multipart",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        first_url = first.data["profile_photo_url"]

        second = self.api.post(
            self.url,
            {
                "bio": "Two",
                "profile_photo": _upload(name="two.jpg", size=(48, 48)),
            },
            format="multipart",
        )
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertTrue(second.data["profile_photo_url"])
        self.assertNotEqual(second.data["profile_photo_url"], first_url)

        removed = self.api.post(
            self.url,
            {"bio": "Three", "remove_profile_photo": "true"},
            format="multipart",
        )
        self.assertEqual(removed.status_code, status.HTTP_200_OK)
        self.assertIsNone(removed.data.get("profile_photo_url"))

    def test_json_partial_update_without_photo_remains_compatible(self):
        self.api.post(
            self.url,
            {"bio": "Draft", "profile_photo": _upload()},
            format="multipart",
        )
        resp = self.api.post(
            self.url,
            {"bio": "Updated only", "headline": "Hello"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["bio"], "Updated only")
        self.assertEqual(resp.data["headline"], "Hello")
        self.assertTrue(resp.data.get("profile_photo_url"))

    def test_publish_ready_without_photo(self):
        profile = self._ready_profile()
        self.assertTrue(profile.is_publish_ready)
        self.assertNotIn("profile_photo", profile.publish_readiness_errors())
        publish = self.api.post(reverse("publish-accountant-profile"))
        self.assertEqual(publish.status_code, status.HTTP_200_OK)
        self.assertTrue(publish.data["is_public"])
        self.assertIsNone(publish.data.get("profile_photo_url"))

    def test_public_and_directory_include_photo_url(self):
        profile = self._ready_profile()
        upload = self.api.post(
            self.url,
            {"profile_photo": _upload(name="pub.jpg")},
            format="multipart",
        )
        self.assertEqual(upload.status_code, status.HTTP_200_OK)
        photo_url = upload.data["profile_photo_url"]
        self.assertTrue(photo_url)

        public = self.api.get(
            reverse("public-accountant-profile", args=[self.user.id])
        )
        self.assertEqual(public.status_code, status.HTTP_200_OK)
        self.assertEqual(public.data["profile_photo_url"], photo_url)
        self.assertNotIn("publish_readiness_errors", public.data)

        directory = self.api.get(reverse("accountant-directory"))
        self.assertEqual(directory.status_code, status.HTTP_200_OK)
        row = next(r for r in directory.data if r["user_id"] == self.user.id)
        self.assertEqual(row["profile_photo_url"], photo_url)

        preview = self.api.get(reverse("preview-accountant-profile"))
        self.assertEqual(preview.status_code, status.HTTP_200_OK)
        self.assertEqual(preview.data["profile_photo_url"], photo_url)
