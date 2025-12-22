from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# --- ROUTER (Otomatik CRUD İşlemleri) ---
router = DefaultRouter()
router.register(r'hatlar', views.HatViewSet)
router.register(r'duraklar', views.DurakViewSet)
router.register(r'talep-verisi', views.TalepVerisiViewSet)

urlpatterns = [
    # 1. Router Linkleri (Hatlar, Duraklar vb.)
    path('', include(router.urls)),

    # 2. Operasyonel: Kapasite Analizi (HatYonetimi.jsx Tablosu)
    path('analiz/kapasite/<str:hat_no>/', views.CapacityAnalysisView.as_view(), name='kapasite-analiz'),

    # 3. Harita: Canlı Araç Takibi (Harita.jsx Otobüsleri)
    path('simulasyon/aktif-otobusler/', views.aktif_otobusler, name='aktif_otobusler'),

    # 4. Yapay Zeka: Talep ve Süre Tahmini
    path('talep-tahmin/<str:hat_no>/', views.PredictDemandView.as_view(), name='talep-tahmin'),
    path('sure-tahmin/', views.PredictTravelTimeView.as_view(), name='sure-tahmin'),

    # 5. Diğerleri
    path('detayli-analiz/<str:hat_no>/', views.DetayliAnalizView.as_view(), name='detayli-analiz'),
]