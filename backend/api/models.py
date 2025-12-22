from django.db import models

# 1. HATLAR
class Hat(models.Model):
    ana_hat_no = models.CharField(max_length=10, verbose_name="Ana Hat No")
    alt_hat_no = models.CharField(max_length=10, verbose_name="Alt Hat No")
    ana_hat_adi = models.CharField(max_length=255, verbose_name="Ana Hat Adı", null=True, blank=True)
    alt_hat_adi = models.CharField(max_length=255, verbose_name="Alt Hat Adı", null=True, blank=True)
    durak_sayisi = models.IntegerField(default=0, null=True, blank=True)
    uzunluk_km = models.FloatField(default=0.0, null=True, blank=True)

    class Meta:
        verbose_name = "Hat"
        verbose_name_plural = "Hatlar"

    def __str__(self):
        return f"{self.ana_hat_no}-{self.alt_hat_no}: {self.ana_hat_adi}"

# 2. DURAKLAR
class Durak(models.Model):
    durak_no = models.CharField(max_length=50, unique=True, verbose_name="Durak Numarası")
    durak_adi = models.CharField(max_length=255, null=True, blank=True, verbose_name="Durak Adı")
    enlem = models.FloatField(default=0.0)
    boylam = models.FloatField(default=0.0)

    def __str__(self):
        return f"{self.durak_no} - {self.durak_adi}"

# 3. HAT-DURAK İLİŞKİSİ
class HatDurak(models.Model):
    hat = models.ForeignKey(Hat, on_delete=models.CASCADE, related_name='duraklar')
    durak = models.ForeignKey(Durak, on_delete=models.CASCADE, related_name='hatlar')
    sira = models.IntegerField(verbose_name="Sıra No")
    istikamet = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        ordering = ['hat', 'sira']
        unique_together = ('hat', 'durak', 'sira')

# 4. DURAK VARIŞ/SEFER VERİSİ
class DurakVaris(models.Model):
    hat = models.ForeignKey(Hat, on_delete=models.CASCADE, null=True, blank=True)
    baslangic_durak = models.ForeignKey(Durak, on_delete=models.CASCADE, related_name='kalkis_yapanlar', null=True)
    bitis_durak = models.ForeignKey(Durak, on_delete=models.CASCADE, related_name='varis_yapanlar', null=True)
    cikis_zaman = models.DateTimeField(null=True, blank=True)
    varis_zaman = models.DateTimeField(null=True, blank=True)
    gecen_sure_saniye = models.IntegerField(default=0)
    arac_no = models.CharField(max_length=50, null=True, blank=True)

    def __str__(self):
        return f"{self.hat} - {self.cikis_zaman}"

# 5. TALEP VERİSİ (Elkart Biniş Verileri İçin)
class TalepVerisi(models.Model):
    tarih_saat = models.DateTimeField()
    hat = models.ForeignKey(Hat, on_delete=models.CASCADE)
    durak = models.ForeignKey(Durak, on_delete=models.CASCADE, null=True, blank=True)
    yolcu_sayisi = models.IntegerField(default=1)

    class Meta:
        indexes = [
            models.Index(fields=['hat', 'tarih_saat']),
        ]

# 6. HAT TARİFE
class HatTarife(models.Model):
    hat = models.ForeignKey(Hat, on_delete=models.CASCADE, related_name='tarifeler')
    yon = models.CharField(max_length=50, blank=True)
    kalkis_saati = models.TimeField()
    tarife_tipi = models.CharField(max_length=50, default="Hafta İçi")

    def __str__(self):
        return f"{self.hat.ana_hat_no} - {self.kalkis_saati}"

# 7. HAT GÜZERGAH NOKTALARI
class HatGuzergah(models.Model):
    hat = models.ForeignKey(Hat, on_delete=models.CASCADE, related_name='guzergah_noktalari')
    sira = models.IntegerField()
    enlem = models.FloatField()
    boylam = models.FloatField()

    class Meta:
        ordering = ['hat', 'sira']

# 8. EK SEFERLER
class EkSefer(models.Model):
    hat = models.ForeignKey(Hat, on_delete=models.CASCADE, related_name='ek_seferler')
    kalkis_saati = models.TimeField(verbose_name="Ek Sefer Saati")
    tarih = models.DateField(auto_now_add=True, verbose_name="Sefer Tarihi")
    arac_no = models.CharField(max_length=20, verbose_name="Atanan Araç No", default="Belirsiz")
    aktif = models.BooleanField(default=True)
    olusturulma_zamani = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.hat.ana_hat_no} - {self.kalkis_saati} ({self.arac_no})"

# 9. OTOBÜS (EKSİK OLAN KISIM BURASIYDI)
class Otobus(models.Model):
    plaka = models.CharField(max_length=50, unique=True, verbose_name="Plaka / Araç No")
    durum = models.CharField(max_length=20, default='BOSTA', verbose_name="Durum")

    class Meta:
        verbose_name = "Otobüs"
        verbose_name_plural = "Otobüsler"

    def __str__(self):
        return f"{self.plaka} - {self.durum}"