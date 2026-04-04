from django.core import signing 
from django.core.mail import send_mail
from django.conf import settings 


def generate_email_verification_token(user):
    return signing.dumps(
        {"user_id": user.id, "email": user.email},
        salt="email-verify"
    )

def verify_email_token(token, max_age=60 * 60 * 24):
    return signing.loads(token, salt="email-verify", max_age=max_age)


def send_verification_email(user):
    token = generate_email_verification_token(user)
    verify_url = f"{settings.BACKEND_URL}/users/auth/verify-email?token={token}"
    print("the verify url right now is", verify_url )


    send_mail(
        subject="Verify your email",
        message=f"Click this link to verify your email: {verify_url}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )