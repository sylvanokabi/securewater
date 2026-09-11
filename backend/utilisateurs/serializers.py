from django.contrib.auth.password_validation import validate_password

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Utilisateur


class UtilisateurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "actif",
            "date_creation",
            "date_modification",
            "derniere_connexion",
        ]
        read_only_fields = [
            "id",
            "actif",
            "date_creation",
            "date_modification",
            "derniere_connexion",
        ]


class InscriptionSerializer(serializers.ModelSerializer):
        
    """Inscription publique — crée un compte observateur par défaut."""

    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = Utilisateur
        fields = [
            "username",
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Les mots de passe ne correspondent pas."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = Utilisateur(**validated_data)
        user.role = Utilisateur.Role.OBSERVATEUR  # forcé à l'inscription
        user.set_password(password)
        user.save()
        return user
    




class ProfilSerializer(serializers.ModelSerializer):

    class Meta:
        model = Utilisateur
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "actif",
            "date_creation",
            "date_modification",
            "derniere_connexion",
        ]
        read_only_fields = [
            "id",
            "username",
            "role",
            "actif",
            "date_creation",
            "date_modification",
            "derniere_connexion",
        ]


class GestionUtilisateurSerializer(serializers.ModelSerializer):

    class Meta:
        model = Utilisateur
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "actif",
            "is_active",
            "date_creation",
            "date_modification",
            "derniere_connexion",
        ]
        read_only_fields = [
            "id",
            "date_creation",
            "date_modification",
            "derniere_connexion",
        ]


class ConnexionSerializer(TokenObtainPairSerializer):
    """Login JWT enrichi : on ajoute le rôle et le nom dans le token."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token["username"] = user.username
        token["email"] = user.email
        token["role"] = user.role

        return token


    def validate(self, attrs):
        data = super().validate(attrs)
        data["utilisateur"] = UtilisateurSerializer(self.user).data
        return data