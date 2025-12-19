from django.shortcuts import render
from django.http import HttpResponse

# Create your views here.

from .models import User

def index(request):
    latest_user_list = User.objects.all()[:3]
    output = "".join(user.email for user in latest_user_list)
    return HttpResponse(output)