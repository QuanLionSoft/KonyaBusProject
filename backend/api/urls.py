# backend/api/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# --- JWT (Giriş Sistemi) İçin Gerekli İçe Aktarmalar ---
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

router = DefaultRouter()
router.register(r'hatlar', views.HatViewSet)
router.register(r'duraklar', views.DurakViewSet)
router.register(r'talep-verisi', views.TalepVerisiViewSet)

urlpatterns = [
    # 1. Router Linkleri (Hatlar, Duraklar vb.)
    path('', include(router.urls)),

    # --- 2. AUTH (KİMLİK DOĞRULAMA) ENDPOINTLERİ ---
    path('register/', views.RegisterView.as_view(), name='auth_register'),  # Kayıt Ol
    path('login/', views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),  # Token Yenile

    # --- 3. ÖZEL ANALİZ VE TAHMİN ENDPOINTLERİ ---
    path('capacity-analysis/<str:hat_no>/', views.CapacityAnalysisView.as_view(), name='capacity-analysis'),
    path('predict-demand/<str:hat_no>/', views.PredictDemandView.as_view(), name='predict-demand'),

    path('simulasyon/aktif-otobusler/', views.aktif_otobusler, name='aktif_otobusler'),
    path('sure-tahmin/', views.PredictTravelTimeView.as_view(), name='sure-tahmin'),
    path('detayli-analiz/<str:hat_no>/', views.DetayliAnalizView.as_view(), name='detayli-analiz'),
]