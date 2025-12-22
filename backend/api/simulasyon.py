import os
import time
import json
import random
from rest_framework.response import Response
from rest_framework.decorators import api_view
from .models import Hat, HatGuzergah, HatDurak

# JSON dosyasını bir kez yüklemek için global değişken
ARAC_HAVUZU = None


def arac_havuzunu_yukle():
    global ARAC_HAVUZU
    json_path = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti\hat_arac_listesi.json"
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                ARAC_HAVUZU = json.load(f)
        except:
            ARAC_HAVUZU = {}
    else:
        ARAC_HAVUZU = {}


@api_view(['GET'])
def aktif_otobusler(request):
    """
    Gerçek operasyonel verilerden (CSV) alınan araç numaralarıyla simülasyon.
    """
    if ARAC_HAVUZU is None:
        arac_havuzunu_yukle()

    hat_id = request.GET.get('hat_id')
    if not hat_id: return Response([])

    try:
        # Hız Çarpanı (Daha hızlı)
        HIZ_CARPANI = 0.5

        hat = Hat.objects.get(id=hat_id)
        rota = list(HatGuzergah.objects.filter(hat=hat).order_by('sira').values_list('enlem', 'boylam'))

        if not rota: return Response([])

        duraklar = list(HatDurak.objects.filter(hat=hat).order_by('sira'))

        # --- GERÇEK ARAÇ SEÇİMİ ---
        # Bu hat için CSV'de kayıtlı gerçek araçları bul
        # Hat numarası string olarak eşleşmeli (örn: "10")
        ana_hat_no = str(hat.ana_hat_no).strip()
        gercek_araclar = ARAC_HAVUZU.get(ana_hat_no, [])

        # Eğer bu hat için gerçek veri yoksa veya azsa, yedek format kullan
        if len(gercek_araclar) < 3:
            kullanilacak_araclar = [f"{ana_hat_no}-BUS-{i + 100}" for i in range(3)]
        else:
            # Gerçek listeden rastgele 3-5 tane seç (Her seferinde aynıları gelmesin diye karıştırabilirsin)
            # Ama sabit kalmaları simülasyon sürekliliği için daha iyi.
            # Şimdilik listenin başındaki 3 taneyi alalım.
            kullanilacak_araclar = gercek_araclar[:5] if len(gercek_araclar) > 5 else gercek_araclar

        otobus_listesi = []
        now = time.time()

        # Araçları rotaya dağıt
        for i, arac_no in enumerate(kullanilacak_araclar):
            # Her aracı rotanın farklı bir yerine koy
            baslangic_farki = (len(rota) // len(kullanilacak_araclar)) * i

            # Formül: (Şimdiki Zaman * Hız + Fark) % Toplam Yol
            current_index = int((now * HIZ_CARPANI + baslangic_farki)) % len(rota)
            lat, lng = rota[current_index]

            # Hedef Durak Tahmini
            hedef_index = (current_index + 50) % len(duraklar) if duraklar else 0
            hedef_durak = duraklar[hedef_index].durak.durak_adi if duraklar else "Merkez"

            otobus_listesi.append({
                "id": f"{hat.id}-{arac_no}",  # Unique ID
                "arac_no": str(arac_no),  # Gerçek Araç No (Örn: 96, 696)
                "enlem": lat,
                "boylam": lng,
                "kalan_sure": random.randint(1, 15),
                "hedef_durak": hedef_durak
            })

        return Response(otobus_listesi)

    except Exception as e:
        print(f"Hata: {e}")
        return Response([])