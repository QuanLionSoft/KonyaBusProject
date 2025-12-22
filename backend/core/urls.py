from django.contrib import admin
from django.urls import path, include  # include'u eklemeyi unutma!

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')), # <-- Bu satırı ekle
]