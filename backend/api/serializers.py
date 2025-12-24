from .models import Hat, Durak, HatDurak, TalepVerisi, EkSefer, Otobus
from django.contrib.auth.models import User, Group
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


# --- 1. ROL DESTEKLİ JWT TOKEN ---
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        # Token içine kullanıcının rolünü (grubunu) ekle
        roles = self.user.groups.values_list('name', flat=True)
        data['role'] = roles[0] if roles else 'user'
        data['username'] = self.user.username
        return data


# --- 2. KAYIT SERIALIZER (Rol Seçimli) ---
class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    role = serializers.CharField(write_only=True, required=False)  # Frontend'den 'operator' veya 'user' gelecek

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'first_name', 'last_name', 'role')

    def create(self, validated_data):
        role_name = validated_data.pop('role', 'user')  # Varsayılan: user

        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )

        # Grubu Bul veya Oluştur
        group, _ = Group.objects.get_or_create(name=role_name)
        user.groups.add(group)

        return user


# --- 3. DİĞER STANDART SERIALIZERLAR ---
class HatSerializer(serializers.ModelSerializer):
    class Meta: model = Hat; fields = '__all__'


class DurakSerializer(serializers.ModelSerializer):
    class Meta: model = Durak; fields = '__all__'


class HatDurakSerializer(serializers.ModelSerializer):
    durak = DurakSerializer()

    class Meta: model = HatDurak; fields = ['id', 'sira', 'durak', 'istikamet']


class TalepVerisiSerializer(serializers.ModelSerializer):
    class Meta: model = TalepVerisi; fields = '__all__'


class OtobusSerializer(serializers.ModelSerializer):
    class Meta: model = Otobus; fields = '__all__'