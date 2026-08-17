from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accountants", "0003_accountantprofile_created_at_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="accountantprofile",
            name="firm_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="accountantprofile",
            name="location",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
