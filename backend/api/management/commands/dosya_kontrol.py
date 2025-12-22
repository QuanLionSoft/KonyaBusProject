import os

klasor_yolu = r"C:\Users\Quantum\PycharmProjects\KonyaBusProject\veri_seti"

print(f"\n--- KONTROL EDİLEN KLASÖR: {klasor_yolu} ---")

if os.path.exists(klasor_yolu):
    print("✅ Klasör bulundu. İçindeki dosyalar listeleniyor:")
    dosyalar = os.listdir(klasor_yolu)

    if not dosyalar:
        print("❌ KLASÖR BOŞ!")
    else:
        for dosya in dosyalar:
            print(f"   📂 {dosya}")

    print("-" * 30)

    # Aradığımız dosyalar var mı?
    gerekli = ["durak.csv", "hatdurak.csv"]
    eksik = [f for f in gerekli if f not in dosyalar]

    if eksik:
        print(f"❌ EKSİK DOSYALAR: {eksik}")
        print("Lütfen dosya isimlerinin BİREBİR aynı olduğundan (küçük/büyük harf dahil) emin olun.")
    else:
        print("✅ Gerekli tüm dosyalar mevcut. Sorun kodda olabilir.")
else:
    print("❌ KLASÖR BULUNAMADI! Yol yanlış.")