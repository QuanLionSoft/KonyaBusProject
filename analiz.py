import pandas as pd
import os


DATA_PATH = 'veri_seti'


def veri_analizi_yap():
    print("--- Veri Analizi Başlıyor ---\n")


    try:

        tarifeler_path = os.path.join(DATA_PATH, 'tarifeler.xlsx - Sheet1.csv')
        df_tarifeler = pd.read_csv(tarifeler_path, sep=',')


        toplam_hat = df_tarifeler['Hat No'].nunique()
        hatlar = df_tarifeler['Hat No'].unique()

        print(f"✅ SORUNUN CEVABI: Tarifeler dosyasında toplam {toplam_hat} adet hat bulunmaktadır.")
        print(f"Hat Listesi (İlk 10): {hatlar[:10]} ...\n")
    except Exception as e:
        print(f"❌ Tarifeler dosyası okunurken hata: {e}\n")


    dosyalar = [
        ('hatbilgisi.csv', ';'),
        ('guzergah.csv', ';'),
        ('hatdurak.csv', ';'),
        ('elkartbinis2021.csv', ';'),
        ('otobusdurakvaris01.csv', ';')
    ]

    for dosya_adi, ayirici in dosyalar:
        try:
            path = os.path.join(DATA_PATH, dosya_adi)
            df = pd.read_csv(path, sep=ayirici, nrows=5)  # Sadece ilk 5 satırı oku
            print(f"📄 {dosya_adi} başarıyla okundu. Sütunlar:")
            print(list(df.columns))
            print("-" * 30)
        except Exception as e:
            print(f"❌ {dosya_adi} okunurken hata: {e}")


if __name__ == "__main__":
    veri_analizi_yap()