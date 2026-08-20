"""
URL configuration for config project.
"""

from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("api/", include("api.urls")),
    path("users/", include("users.urls")),
    path("bookings/", include("bookings.urls")),
    path("accountants/", include("accountants.urls")),
    path("services/", include("services.urls")),
    path("api/inquiries/", include("inquiries.urls")),
    path("api/chats", include("chats.urls")),
    path("admin/", admin.site.urls),
]

# Local media for development FileField storage. Private documents are still
# downloaded through authorization-checked inquiry attachment endpoints.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
