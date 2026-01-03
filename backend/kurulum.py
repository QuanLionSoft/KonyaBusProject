import os
import sys
import django
from django.conf import settings



def temizlik_yap():
    print("1. Migration temizliği yapılıyor...")

    mig_path = os.path.join('api', 'migrations')
    if os.path.exists(mig_path):
        for f in os.listdir(mig_path):
            if f != '__init__.py' and f != '__pycache__' and f.endswith('.py'):
                try:
                    os.remove(os.path.join(mig_path, f))
                except Exception as e:
                    print(f"   - Uyarı: {f} silinemedi: {e}")
        print("   - Eski migration dosyaları temizlendi.")
    return True


if __name__ == "__main__":
    if not os.path.exists('manage.py'):
        print("HATA: Bu dosyayı 'manage.py' ile aynı klasörde çalıştırmalısınız!")
        sys.exit(1)

    if not temizlik_yap():
        sys.exit(1)


    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    django.setup()

    from django.core.management import call_command
    from django.contrib.auth import get_user_model

    try:
        print("\n2. MySQL Veritabanı tabloları oluşturuluyor...")

        call_command('makemigrations', 'api')
        call_command('migrate')

        print("\n3. CSV Verileri yükleniyor (Bu işlem 1-2 dakika sürebilir)...")

        call_command('veri_yukle')

        print("\n4. Yeni Admin Kullanıcısı oluşturuluyor...")
        User = get_user_model()

        if User.objects.filter(username='admin').exists():
            user = User.objects.get(username='admin')
            user.set_password('admin')
            user.save()
            print("   - Mevcut admin kullanıcısının şifresi 'admin' olarak güncellendi.")
        else:
            User.objects.create_superuser('admin', 'admin@example.com', 'admin')
            print("   - Yeni kullanıcı oluşturuldu.")
            print("   - Kullanıcı Adı: admin")
            print("   - Şifre: admin")

        print("\n===========================================")
        print("   MYSQL GEÇİŞİ VE KURULUM BAŞARILI!  ")
        print("===========================================")

    except Exception as e:
        print(f"\n!!! HATA OLUŞTU:\n{e}")
        print("\nİPUCU: MySQL servisinin açık olduğundan ve settings.py dosyasındaki")
        print("kullanıcı adı/şifrenin doğru olduğundan emin olun.")