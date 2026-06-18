from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import views as auth_views

from obras import views
from obras import portal_views
from obras.views import toggle_tarea_view, toggle_definicion_view

urlpatterns = [
    path('', views.home_router, name='home_router'),
    path('login/', auth_views.LoginView.as_view(template_name='registration/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('admin/', admin.site.urls),

    # Portal cliente
    path('mi-cuenta/', portal_views.cliente_dashboard, name='cliente_dashboard'),
    path('mi-cuenta/obra/<int:obra_id>/', portal_views.detalle_obra_cliente, name='detalle_obra_cliente'),

    # Dashboard obras
    path('dashboard/obras/', views.dashboard_obras, name='dashboard_obras'),
    path('dashboard/obras/crear/', views.crear_obra_view, name='crear_obra_pantalla'),
    path('dashboard/obras/ficha/<int:obra_id>/', views.ficha_obra_view, name='ficha_obra'),
    path('dashboard/obras/finalizar/<int:obra_id>/', views.finalizar_obra_view, name='finalizar_obra'),
    path('dashboard/obras/eliminar/<int:obra_id>/', views.eliminar_obra_view, name='eliminar_obra'),
    path('dashboard/obras/actualizar-progreso-manual/', views.actualizar_progreso_obra_manual, name='actualizar_progreso_manual'),
    path('dashboard/obras/actualizar-progreso/', views.actualizar_progreso_obra_manual, name='actualizar_progreso_obra_manual'),

    # Carga rápida y gastos
    path('obra/<int:obra_id>/carga-rapida/', views.carga_rapida_obra, name='carga_rapida_obra'),
    path('gasto/<int:gasto_id>/sacar/', views.eliminar_gasto_rapido, name='eliminar_gasto_rapido'),
    path('gasto/editar/<int:gasto_id>/', views.editar_gasto_rapido, name='editar_gasto_rapido'),

    # PDFs
    path('admin/obras/gastoobra/imprimir-remito/<int:gasto_id>/', views.generar_remito_gasto_pdf, name='imprimir_remito_gasto'),
    path('reporte-obra/<int:obra_id>/', views.imprimir_reporte_obra, name='imprimir_reporte_obra'),

    # Tareas y fotos
    path('definicion/crear/<int:obra_id>/', views.crear_definicion_propietario, name='crear_definicion_propietario'),
    path('obra/<int:obra_id>/crear-tarea/', views.crear_definicion_propietario, name='crear_tarea_desde_ficha'),
    path('obra/toggle-tarea/', toggle_tarea_view, name='toggle_tarea'),
    path('gestion/obras/toggle-definicion/', toggle_definicion_view, name='toggle_definicion'),
    path('obra/<int:obra_id>/subir-foto/', views.subir_foto_avance, name='subir_foto_avance'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
