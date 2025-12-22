from rest_framework import serializers
from .models import Hat, Durak, HatDurak, TalepVerisi, EkSefer, Otobus


class HatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hat
        fields = ['id', 'ana_hat_no', 'ana_hat_adi', 'alt_hat_no', 'alt_hat_adi']


class DurakSerializer(serializers.ModelSerializer):
    class Meta:
        model = Durak
        fields = ['id', 'durak_no', 'durak_adi', 'enlem', 'boylam']


class HatDurakSerializer(serializers.ModelSerializer):
    durak = DurakSerializer()

    class Meta:
        model = HatDurak
        # 'istikamet' alanını buraya ekledik ki frontend alabilsin
        fields = ['id', 'sira', 'durak', 'istikamet']


class TalepVerisiSerializer(serializers.ModelSerializer):
    class Meta:
        model = TalepVerisi
        fields = '__all__'


class OtobusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Otobus
        fields = '__all__'