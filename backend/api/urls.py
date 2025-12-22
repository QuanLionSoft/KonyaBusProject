# backend/api/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'hatlar', views.HatViewSet)
router.register(r'duraklar', views.DurakViewSet)
router.register(r'talep-verisi', views.TalepVerisiViewSet)

urlpatterns = [
    path('', include(router.urls)),

    # DÜZELTME 1: Kapasite Analizi (Dashboard ile uyumlu)
    path('capacity-analysis/<str:hat_no>/', views.CapacityAnalysisView.as_view(), name='capacity-analysis'),

    # DÜZELTME 2: Talep Tahmini (Dashboard ile uyumlu - İngilizce URL)
    path('predict-demand/<str:hat_no>/', views.PredictDemandView.as_view(), name='predict-demand'),

    # Diğerleri
    path('simulasyon/aktif-otobusler/', views.aktif_otobusler, name='aktif_otobusler'),
    path('sure-tahmin/', views.PredictTravelTimeView.as_view(), name='sure-tahmin'),
    path('detayli-analiz/<str:hat_no>/', views.DetayliAnalizView.as_view(), name='detayli-analiz'),
]