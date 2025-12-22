from rest_framework import serializers
from .models import Hat, Durak, HatDurak, TalepVerisi, DurakVaris, HatGuzergah, HatTarife, EkSefer, Otobus


# 1. Temel Serializerlar
class HatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hat
        fields = '__all__'


class DurakSerializer(serializers.ModelSerializer):
    class Meta:
        model = Durak
        fields = '__all__'


# 2. İlişkili (Nested) Serializerlar
class HatDurakSerializer(serializers.ModelSerializer):
    # ÖNEMLİ: Durak bilgisini ID olarak değil, tüm detaylarıyla (Enlem/Boylam) getir
    durak = DurakSerializer(read_only=True)

    class Meta:
        model = HatDurak
        fields = '__all__'


class TalepVerisiSerializer(serializers.ModelSerializer):
    class Meta:
        model = TalepVerisi
        fields = '__all__'


class OtobusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Otobus
        fields = '__all__'