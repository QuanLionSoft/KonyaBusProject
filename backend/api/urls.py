from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'hatlar', views.HatViewSet)
router.register(r'duraklar', views.DurakViewSet)
router.register(r'talep-verisi', views.TalepVerisiViewSet)

urlpatterns = [
    # Router URL'leri (hatlar, duraklar vb.)
    path('', include(router.urls)),

    # 1. Simülasyon (Harita İçin)
    path('simulasyon/aktif-otobusler/', views.aktif_otobusler, name='aktif_otobusler'),

    # 2. Yapay Zeka Tahmini (Prophet - Dashboard İçin)
    path('predict-demand/<str:hat_no>/', views.PredictDemandView.as_view(), name='predict-demand'),

    # 3. Kapasite Analizi (Hat Yönetimi İçin - EKSİK OLAN BU)
    path('analiz/kapasite/<str:hat_no>/', views.CapacityAnalysisView.as_view(), name='kapasite-analiz'),

    # 4. Detaylı Analiz (Opsiyonel)
    path('analiz-detay/<str:hat_no>/', views.DetayliAnalizView.as_view(), name='detayli-analiz'),
]