
from rest_framework import serializers
from users.models import User
from django.contrib.auth import authenticate
from accountants.models import AccountantProfile

#ModelSerializer classes are shortcut for creating
#serializer classses -> automatically determined set of fields
# simple default implementations for create() and update() methods

# class UserSerializer(serializers.Serializer):
#     id = serializers.IntegerField(read_only=True)
#     email = serializers.CharField()
#     is_accountant = serializers.BooleanField(default=False)

#     def create(self, validated_data):
#         #create and return a new 'User' instance, given the validated data
#         return User.objects.create(**validated_data)
    
#     def update(self, instance, validated_data):
#         #update and return an existing 'User' instance, given the validated data
#         instance.email=validated_data.get("email", instance.email)
#         instance.is_accountant = validated_data.get("is_accountant", instance.is_accountant)
#         instance.save()
#         return instance
    
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields =["id", "email"]


class SignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields=["email","password","id"]
        #remove password from being included in the response
        extra_kwargs = {"password": {'write_only':True}}
        #field may be used when updating or creating an instance, but is not included when serializing the representation

    def create(self,validated_data):
        #pop the password from validated data
        password = validated_data.pop("password")

        #create a user
        user = User.objects.create_user(password = password,is_verified=False, is_accountant=False,**validated_data)
   
        if user.is_accountant:
            print("Creating an accountant profile now")
            AccountantProfile.objects.create(user=user)

        return user

class LoginSerializer(serializers.Serializer):
    email=serializers.EmailField()
    password=serializers.CharField(write_only=True)

    def validate(self,data):
        """
        Check that the user exists based on email and password
        """

        email=data['email']
        password=data['password']

        user = authenticate(username=email, password=password)

        if not user:
            raise serializers.ValidationError("Invalid Credentials")
        
        data['user']=user
        return data
