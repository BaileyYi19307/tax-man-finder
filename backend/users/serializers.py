
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
        fields =["id", "email", "password","is_accountant"]


class SignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields=["email","password","is_accountant","id"]
        #remove password from being included in the response
        extra_kwargs = {"password": {'write_only':True}}

    def create(self,validated_data):
        #pop the password from validated data
        password = validated_data.pop("password")
        email = validated_data["email"]
        is_accountant = validated_data['is_accountant']
        #create user with the data
        user = User(username=email,email=email,is_accountant= is_accountant)

        user.set_password(password)
        user.save()

        if user.is_accountant:
            print("Creating an accountant profile now")
            AccountantProfile.objects.create(user=user)

        # user["id"]=user.id
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
