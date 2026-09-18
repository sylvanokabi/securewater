from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth JWT globale (refresh token)
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
   
    # Documentation API
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),

    # Applications avec leurs préfixes distincts
    path("api/", include("utilisateurs.urls")),
    path("api/reservoirs/", include("reservoirs.urls")),
    path("api/capteurs/", include("capteurs.urls")),
    path("api/alertes/", include("alertes.urls")),
]
