import re
import unicodedata

from django import forms
from django.contrib import admin
from django.contrib.auth.models import User
from django.urls import path
from django.utils.html import format_html

from . import views
from .pdf_views import generar_reporte_obra_pdf
from .models import (
    Cliente, RubroObra, ProyectoObra, Tarea, GastoObra,
    CuentaBancaria, MovimientoCaja, ProyectoRubro, FotoAvance,
)


class TareaInline(admin.TabularInline):
    model = Tarea
    extra = 1
    fields = ['titulo', 'completada']


class GastoObraInline(admin.TabularInline):
    model = GastoObra
    extra = 1
    fields = ['fecha', 'detalle', 'monto_ticket', 'imprimir_remito_btn']
    readonly_fields = ['imprimir_remito_btn']

    def imprimir_remito_btn(self, obj):
        if obj.id and obj.tipo_componente == 'MANO_OBRA':
            url = f"/admin/obras/gastoobra/imprimir-remito/{obj.id}/"
            return format_html(
                '<a href="{}" target="_blank" class="button" '
                'style="padding:2px 6px; background:#264b5d; color:white; border-radius:4px;">🖨️ Remito</a>',
                url,
            )
        return "-"
    imprimir_remito_btn.short_description = "Firma"


def _slug_username(texto: str) -> str:
    base = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')
    base = re.sub(r'[^a-zA-Z0-9]+', '_', base.lower()).strip('_')
    return base[:30] or 'cliente'


class ClienteAdminForm(forms.ModelForm):
    portal_username = forms.CharField(
        required=False,
        label='Usuario del portal',
        help_text='Nombre de usuario para que el cliente ingrese en /login/',
    )
    portal_password = forms.CharField(
        required=False,
        label='Contraseña del portal',
        widget=forms.PasswordInput(render_value=True),
        help_text='Completá usuario y contraseña para crear o actualizar el acceso.',
    )

    class Meta:
        model = Cliente
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk and self.instance.user:
            self.fields['portal_username'].initial = self.instance.user.username
        elif self.instance and self.instance.nombre and not self.data:
            self.fields['portal_username'].help_text = (
                f'Sugerencia: {_slug_username(self.instance.nombre)}'
            )

    def clean(self):
        cleaned = super().clean()
        usuario = (cleaned.get('portal_username') or '').strip()
        clave = cleaned.get('portal_password') or ''
        if usuario and not clave and not (self.instance and self.instance.user):
            raise forms.ValidationError(
                'Si definís un usuario nuevo, también tenés que indicar una contraseña.'
            )
        if clave and not usuario:
            raise forms.ValidationError('Indicá el nombre de usuario del portal.')
        return cleaned


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    form = ClienteAdminForm
    list_display = ('nombre', 'telefono', 'email', 'estado_portal', 'puede_ver_portal', 'cant_obras')
    list_filter = ('puede_ver_portal',)
    search_fields = ('nombre', 'dni', 'email', 'user__username')
    readonly_fields = ('estado_portal_detalle',)
    fieldsets = (
        ('Datos del cliente', {
            'fields': ('nombre', 'dni', 'telefono', 'email', 'domicilio'),
        }),
        ('Portal de avances de obra', {
            'fields': (
                'puede_ver_portal',
                'estado_portal_detalle',
                'portal_username',
                'portal_password',
                'user',
            ),
            'description': (
                'El cliente entra en /login/ con su usuario y ve sus obras en /mi-cuenta/. '
                'Desmarcá "puede ver portal" para bloquear el acceso aunque tenga usuario.'
            ),
        }),
    )

    def cant_obras(self, obj):
        return obj.obras.count()
    cant_obras.short_description = 'Obras'

    def estado_portal(self, obj):
        if not obj.puede_ver_portal:
            return 'Bloqueado'
        if obj.user:
            return format_html('<span style="color:#16a34a;font-weight:600;">Activo</span>')
        return format_html('<span style="color:#da5a0e;">Sin usuario</span>')
    estado_portal.short_description = 'Portal'

    def estado_portal_detalle(self, obj):
        if not obj.pk:
            return 'Guardá el cliente primero.'
        if not obj.puede_ver_portal:
            return 'Acceso al portal deshabilitado.'
        if obj.user:
            return f'Usuario vinculado: {obj.user.username} → /mi-cuenta/'
        return 'Sin usuario. Completá usuario y contraseña abajo.'

    estado_portal_detalle.short_description = 'Estado'

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)

        usuario = (form.cleaned_data.get('portal_username') or '').strip()
        clave = form.cleaned_data.get('portal_password') or ''

        if obj.user and not usuario:
            if not obj.puede_ver_portal:
                obj.user.is_active = False
                obj.user.save(update_fields=['is_active'])
            return

        if not usuario:
            return

        if obj.user:
            user = obj.user
            user.username = usuario
            if clave:
                user.set_password(clave)
            if obj.email:
                user.email = obj.email
            user.is_staff = False
            user.is_active = obj.puede_ver_portal
            user.save()
        else:
            user = User.objects.create_user(
                username=usuario,
                email=obj.email or '',
                password=clave,
            )
            user.is_staff = False
            user.is_active = obj.puede_ver_portal
            user.save()
            obj.user = user
            obj.save(update_fields=['user'])


@admin.register(RubroObra)
class RubroObraAdmin(admin.ModelAdmin):
    list_display = ('nombre',)


@admin.register(ProyectoObra)
class ProyectoObraAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'direccion_obra', 'cliente', 'get_avance', 'estado', 'boton_carga_rapida')
    list_filter = ('estado',)
    inlines = [TareaInline, GastoObraInline]
    readonly_fields = ('get_avance', 'boton_reporte')
    fieldsets = (
        ('Información General', {
            'fields': ('nombre', 'cliente', 'direccion_obra', 'tipo_inmueble', 'estado', 'fecha_inicio', 'get_avance'),
        }),
        ('Finanzas', {
            'fields': ('presupuesto_estimado', 'tipo_honorario', 'valor_honorario', 'encargado', 'notas'),
        }),
        ('Acciones', {'fields': ('boton_reporte',)}),
    )

    def get_avance(self, obj):
        return format_html('<b style="color:#28a745;">{}%</b>', obj.porcentaje_avance)
    get_avance.short_description = 'Avance'

    def boton_carga_rapida(self, obj):
        return format_html(
            '<a class="button" href="/obra/{}/carga-rapida/" '
            'style="background:#28a745;color:white;padding:4px 8px;border-radius:4px;text-decoration:none;">⚡ Carga</a>',
            obj.id,
        )
    boton_carga_rapida.short_description = "Celular"

    def boton_reporte(self, obj):
        if obj.id:
            return format_html(
                '<a class="button" href="/admin/obras/proyectoobra/imprimir-reporte/{}/" target="_blank" '
                'style="background:#417690;color:white;padding:10px 15px;text-decoration:none;border-radius:4px;">📄 Reporte PDF</a>',
                obj.id,
            )
        return "Guarde el proyecto primero."

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                'imprimir-reporte/<int:proyecto_id>/',
                self.admin_site.admin_view(generar_reporte_obra_pdf),
                name='proyecto-reporte-pdf',
            ),
        ]
        return custom + urls


@admin.register(GastoObra)
class GastoObraAdmin(admin.ModelAdmin):
    list_display = ('detalle', 'proyecto', 'tarea_rubro', 'tipo_componente', 'monto_ticket', 'ganancia_direccion')
    list_filter = ('proyecto', 'tarea_rubro', 'tipo_componente')

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                'imprimir-remito/<int:gasto_id>/',
                self.admin_site.admin_view(views.generar_remito_gasto_pdf),
                name='remito-firma',
            ),
        ]
        return custom + urls


@admin.register(Tarea)
class TareaAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'proyecto', 'tipo', 'completada')
    list_filter = ('proyecto', 'tipo', 'completada')


@admin.register(CuentaBancaria)
class CuentaBancariaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'moneda', 'saldo_inicial')


@admin.register(MovimientoCaja)
class MovimientoCajaAdmin(admin.ModelAdmin):
    list_display = ('fecha', 'tipo', 'monto', 'cuenta', 'descripcion')
    list_filter = ('tipo', 'cuenta')


admin.site.site_header = "Nodo Obra — Administración"
admin.site.site_title = "Nodo Obra"
