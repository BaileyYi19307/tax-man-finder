
from rest_framework import serializers
from users.models import User

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
        fields=["email","password"]
        #remove password from being included in the response
        extra_kwargs = {"password": {'write_only':True}}

    def create(self,validated_data):
        #pop the password from validated data
        password = validated_data.pop("password")
        #create user with the data
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return 
