from django.db import models
from users import User

# Create your models here.
class Conversation(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE,
                               related_name='from_user')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE,
                                  related_name='to_user')
    text = models.TextField()
    #file 
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


