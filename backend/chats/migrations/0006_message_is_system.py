from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chats", "0005_attachment_and_blank_message_content"),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="is_system",
            field=models.BooleanField(default=False),
        ),
    ]
