from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_delete
from django.dispatch import receiver
from datetime import date
from decimal import Decimal


class Cliente(models.Model):
    """Cliente / propietario de obra (independiente del módulo inmobiliario)."""
    user = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='perfil_cliente'
    )
    nombre = models.CharField(max_length=100)
    dni = models.CharField(max_length=20, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    domicilio = models.CharField(max_length=300, blank=True)
    puede_ver_portal = models.BooleanField(default=True, verbose_name="¿Ve avances en el portal?")

    class Meta:
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"

    def __str__(self):
        return self.nombre


class _PropiedadProxy:
    """Compatibilidad con templates que usan obra.propiedad.direccion"""
    def __init__(self, obra):
        self.direccion = obra.direccion_obra or "Sin dirección"
        self.tipo = obra.tipo_inmueble or "Obra"
        self.propietario = obra.cliente


class RubroObra(models.Model):
    nombre = models.CharField(max_length=50, unique=True)

    class Meta:
        verbose_name_plural = "Rubros de Obra"

    def __str__(self):
        return self.nombre


class ProyectoObra(models.Model):
    ESTADOS = [
        ('PLAN', 'En Planificación'),
        ('CURSO', 'En Curso / Ejecución'),
        ('FINALIZADO', 'Obra Finalizada'),
        ('SUSPENDIDO', 'Suspendido'),
    ]
    TIPOS_HONORARIOS = [
        ('PORCENTAJE', 'Porcentaje sobre cada gasto'),
        ('FIJO_TICKET', 'Monto fijo por cada ticket cargado'),
        ('FIJO_TOTAL', 'Monto fijo total (Independiente de tickets)'),
        ('SEMANAL', 'Monto Fijo Semanal'),
    ]

    nombre = models.CharField(max_length=200, verbose_name="Nombre del Proyecto")
    cliente = models.ForeignKey(
        Cliente, on_delete=models.SET_NULL, null=True, blank=True, related_name='obras'
    )
    direccion_obra = models.CharField(max_length=300, verbose_name="Dirección de la obra")
    tipo_inmueble = models.CharField(max_length=50, default='Casa', blank=True)

    fecha_inicio = models.DateField(default=date.today)
    plazo_meses = models.IntegerField(default=1)
    encargado = models.CharField(max_length=150, blank=True, null=True)
    porcentaje_contingencia = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)

    presupuesto_estimado = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    porcentaje_comision_direccion = models.FloatField(default=10.0)
    tipo_honorario = models.CharField(max_length=20, choices=TIPOS_HONORARIOS, default='PORCENTAJE')
    valor_honorario = models.DecimalField(max_digits=12, decimal_places=2, default=10.00)

    estado = models.CharField(max_length=15, choices=ESTADOS, default='PLAN')
    notas = models.TextField(blank=True, null=True)

    @property
    def propietario(self):
        return self.cliente

    @property
    def propiedad(self):
        return _PropiedadProxy(self)

    @property
    def porcentaje_avance(self):
        tareas = self.tareas.all()
        if not tareas.exists():
            return 0
        terminadas = tareas.filter(completada=True).count()
        return int((terminadas / tareas.count()) * 100)

    def __str__(self):
        return f"{self.nombre} - {self.direccion_obra}"


class Tarea(models.Model):
    TIPO_CHOICES = [
        ('propietario', 'DEFINICIONES DEL PROPIETARIO'),
        ('operativa', 'TAREA NUESTRA / INTERNA'),
    ]

    proyecto = models.ForeignKey(ProyectoObra, on_delete=models.CASCADE, related_name='tareas')
    titulo = models.CharField(max_length=255)
    contenido = models.TextField(blank=True)
    completada = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_limite = models.DateField(null=True, blank=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='operativa')
    presupuesto_mano_obra = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    presupuesto_materiales = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    class Meta:
        verbose_name = "Tarea"
        verbose_name_plural = "Tareas"

    def __str__(self):
        return f"{self.titulo} - {self.proyecto.nombre}"


class GastoObra(models.Model):
    proyecto = models.ForeignKey(ProyectoObra, on_delete=models.CASCADE, related_name='gastos_globales')
    tarea_rubro = models.ForeignKey(RubroObra, on_delete=models.SET_NULL, null=True, blank=True, related_name='gastos')

    TIPO_COMPONENTE_CHOICES = [
        ('MATERIALES', 'Materiales / Corralón'),
        ('MANO_OBRA', 'Mano de Obra / Gremio'),
    ]
    tipo_componente = models.CharField(max_length=20, choices=TIPO_COMPONENTE_CHOICES, default='MATERIALES')

    fecha = models.DateField(default=date.today)
    detalle = models.CharField(max_length=250)
    monto_ticket = models.DecimalField(max_digits=12, decimal_places=2)
    comprobante = models.ImageField(upload_to='obras/tickets/', null=True, blank=True)
    ganancia_direccion = models.DecimalField(max_digits=12, decimal_places=2, default=0, editable=False)
    cuenta_ingreso = models.ForeignKey(
        'CuentaBancaria', on_delete=models.SET_NULL, null=True, blank=True
    )

    def save(self, *args, **kwargs):
        proyecto = self.proyecto
        if proyecto.tipo_honorario == 'PORCENTAJE':
            porce = Decimal(str(proyecto.valor_honorario)) / Decimal('100')
            self.ganancia_direccion = (self.monto_ticket * porce).quantize(Decimal('0.01'))
        elif proyecto.tipo_honorario == 'FIJO_TICKET':
            self.ganancia_direccion = proyecto.valor_honorario
        else:
            self.ganancia_direccion = Decimal('0.00')
        super().save(*args, **kwargs)

    def __str__(self):
        rubro = self.tarea_rubro.nombre if self.tarea_rubro else "Sin Rubro"
        return f"{self.proyecto.nombre} - {rubro} - ${self.monto_ticket}"


class ContratistaObra(models.Model):
    proyecto = models.ForeignKey(ProyectoObra, on_delete=models.CASCADE, related_name='contratistas')
    nombre_proveedor = models.CharField(max_length=150)
    rubro = models.ForeignKey(RubroObra, on_delete=models.SET_NULL, null=True)
    monto_contrato = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_pagado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    porcentaje_avance_rubro = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)

    @property
    def saldo_pendiente(self):
        return self.monto_contrato - self.total_pagado

    def __str__(self):
        return f"{self.nombre_proveedor} - {self.rubro} ({self.proyecto.nombre})"


class RemitoMaterial(models.Model):
    proyecto = models.ForeignKey(ProyectoObra, on_delete=models.CASCADE, related_name='remitos')
    fecha = models.DateField(default=date.today)
    proveedor_corralon = models.CharField(max_length=150)
    material_detalle = models.CharField(max_length=255)
    cantidad = models.CharField(max_length=50, blank=True, null=True)
    critico_faltante = models.BooleanField(default=False)
    recibido = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.fecha} - {self.proveedor_corralon} ({self.proyecto.nombre})"


class CajaChicaObra(models.Model):
    TIPOS_MOVIMIENTO = [
        ('FONDO', 'Asignación de Fondo'),
        ('GASTO', 'Rendición de Gasto Menor'),
    ]
    proyecto = models.ForeignKey(ProyectoObra, on_delete=models.CASCADE, related_name='cajas_chicas')
    fecha = models.DateField(default=date.today)
    tipo = models.CharField(max_length=10, choices=TIPOS_MOVIMIENTO, default='GASTO')
    detalle = models.CharField(max_length=250)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    rendido_y_aprobado = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.get_tipo_display()} - ${self.monto} ({self.proyecto.nombre})"


class CuentaBancaria(models.Model):
    nombre = models.CharField(max_length=100)
    moneda = models.CharField(max_length=5, choices=[('ARS', 'Pesos'), ('USD', 'Dólares')], default='ARS')
    saldo_inicial = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.nombre} ({self.moneda})"


class MovimientoCaja(models.Model):
    TIPOS = (('INGRESO', 'Ingreso'), ('EGRESO', 'Egreso'))
    fecha = models.DateField(default=date.today)
    tipo = models.CharField(max_length=10, choices=TIPOS)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    cuenta = models.ForeignKey(CuentaBancaria, on_delete=models.CASCADE, related_name='movimientos')
    descripcion = models.CharField(max_length=255)
    referencia_id = models.CharField(max_length=100, blank=True, null=True, unique=True)

    def __str__(self):
        return f"{self.fecha} - {self.tipo} - {self.monto}"


class ProyectoRubro(models.Model):
    proyecto = models.ForeignKey(ProyectoObra, on_delete=models.CASCADE, related_name='rubros_progreso')
    nombre = models.CharField(max_length=100)
    porcentaje_avance = models.IntegerField(default=0)
    monto_gasto = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    def __str__(self):
        return f"{self.nombre} - {self.proyecto.nombre} ({self.porcentaje_avance}%)"


class FotoAvance(models.Model):
    proyecto = models.ForeignKey(ProyectoObra, on_delete=models.CASCADE, related_name='fotos_avance')
    fecha_avance = models.DateField()
    descripcion = models.CharField(max_length=200)
    imagen = models.ImageField(upload_to='avances_obra/')
    fecha_carga = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_avance']


@receiver(post_delete, sender=GastoObra)
def eliminar_movimiento_caja_obra(sender, instance, **kwargs):
    MovimientoCaja.objects.filter(referencia_id=f"OBRA-{instance.id}").delete()
