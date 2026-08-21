"""Deprecated alias — use reset_client_demo_accountants."""

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Alias for reset_client_demo_accountants (DEBUG only)."

    def handle(self, *args, **options):
        call_command("reset_client_demo_accountants")
