from django.contrib import admin
from .models import Hat, Durak, HatDurak, TalepVerisi, DurakVaris

@admin.register(Hat)
class HatAdmin(admin.ModelAdmin):
    list_display = ('ana_hat_no', 'alt_hat_no', 'ana_hat_adi', 'alt_hat_adi', 'durak_sayisi', 'uzunluk_km')
    search_fields = ('ana_hat_no', 'ana_hat_adi')
    list_filter = ('durak_sayisi',)

@admin.register(Durak)
class DurakAdmin(admin.ModelAdmin):
    list_display = ('durak_no', 'durak_adi', 'enlem', 'boylam')
    search_fields = ('durak_no', 'durak_adi')

@admin.register(HatDurak)
class HatDurakAdmin(admin.ModelAdmin):
    list_display = ('hat', 'durak', 'sira', 'istikamet')
    list_filter = ('hat',)
    search_fields = ('hat__ana_hat_adi', 'durak__durak_adi')

@admin.register(TalepVerisi)
class TalepVerisiAdmin(admin.ModelAdmin):
    list_display = ('tarih_saat', 'hat', 'durak', 'yolcu_sayisi')
    list_filter = ('tarih_saat', 'hat')

@admin.register(DurakVaris)
class DurakVarisAdmin(admin.ModelAdmin):
    list_display = ('hat', 'baslangic_durak', 'bitis_durak', 'cikis_zaman', 'varis_zaman', 'arac_no')
    list_filter = ('hat', 'arac_no')