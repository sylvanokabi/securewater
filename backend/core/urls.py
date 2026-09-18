from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView


urlpatterns = [
    path("admin/", admin.site.urls),

   # Auth JWT globale (refresh token)
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
   
       # Applications
       path("api/", include("utilisateurs.urls")),
       path("api/", include("reservoirs.urls")),
       path("api/",include("capteurs.urls")),
       path("api/", include("alertes.urls")),
   ]
