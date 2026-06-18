# Generated manually for nodo-obra initial setup

import datetime
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Cliente',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=100)),
                ('dni', models.CharField(blank=True, max_length=20)),
                ('telefono', models.CharField(blank=True, max_length=50)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('domicilio', models.CharField(blank=True, max_length=300)),
                ('puede_ver_portal', models.BooleanField(default=True, verbose_name='¿Ve avances en el portal?')),
                ('user', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='perfil_cliente', to=settings.AUTH_USER_MODEL)),
            ],
            options={'verbose_name': 'Cliente', 'verbose_name_plural': 'Clientes'},
        ),
        migrations.CreateModel(
            name='CuentaBancaria',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=100)),
                ('moneda', models.CharField(choices=[('ARS', 'Pesos'), ('USD', 'Dólares')], default='ARS', max_length=5)),
                ('saldo_inicial', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
            ],
        ),
        migrations.CreateModel(
            name='RubroObra',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=50, unique=True)),
            ],
            options={'verbose_name_plural': 'Rubros de Obra'},
        ),
        migrations.CreateModel(
            name='ProyectoObra',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=200, verbose_name='Nombre del Proyecto')),
                ('direccion_obra', models.CharField(max_length=300, verbose_name='Dirección de la obra')),
                ('tipo_inmueble', models.CharField(blank=True, default='Casa', max_length=50)),
                ('fecha_inicio', models.DateField(default=datetime.date.today)),
                ('plazo_meses', models.IntegerField(default=1)),
                ('encargado', models.CharField(blank=True, max_length=150, null=True)),
                ('porcentaje_contingencia', models.DecimalField(decimal_places=2, default=10.0, max_digits=5)),
                ('presupuesto_estimado', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('porcentaje_comision_direccion', models.FloatField(default=10.0)),
                ('tipo_honorario', models.CharField(choices=[('PORCENTAJE', 'Porcentaje sobre cada gasto'), ('FIJO_TICKET', 'Monto fijo por cada ticket cargado'), ('FIJO_TOTAL', 'Monto fijo total (Independiente de tickets)'), ('SEMANAL', 'Monto Fijo Semanal')], default='PORCENTAJE', max_length=20)),
                ('valor_honorario', models.DecimalField(decimal_places=2, default=10.0, max_digits=12)),
                ('estado', models.CharField(choices=[('PLAN', 'En Planificación'), ('CURSO', 'En Curso / Ejecución'), ('FINALIZADO', 'Obra Finalizada'), ('SUSPENDIDO', 'Suspendido')], default='PLAN', max_length=15)),
                ('notas', models.TextField(blank=True, null=True)),
                ('cliente', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='obras', to='obras.cliente')),
            ],
        ),
        migrations.CreateModel(
            name='MovimientoCaja',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fecha', models.DateField(default=datetime.date.today)),
                ('tipo', models.CharField(choices=[('INGRESO', 'Ingreso'), ('EGRESO', 'Egreso')], max_length=10)),
                ('monto', models.DecimalField(decimal_places=2, max_digits=12)),
                ('descripcion', models.CharField(max_length=255)),
                ('referencia_id', models.CharField(blank=True, max_length=100, null=True, unique=True)),
                ('cuenta', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='movimientos', to='obras.cuentabancaria')),
            ],
        ),
        migrations.CreateModel(
            name='GastoObra',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo_componente', models.CharField(choices=[('MATERIALES', 'Materiales / Corralón'), ('MANO_OBRA', 'Mano de Obra / Gremio')], default='MATERIALES', max_length=20)),
                ('fecha', models.DateField(default=datetime.date.today)),
                ('detalle', models.CharField(max_length=250)),
                ('monto_ticket', models.DecimalField(decimal_places=2, max_digits=12)),
                ('comprobante', models.ImageField(blank=True, null=True, upload_to='obras/tickets/')),
                ('ganancia_direccion', models.DecimalField(decimal_places=2, default=0, editable=False, max_digits=12)),
                ('cuenta_ingreso', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='obras.cuentabancaria')),
                ('proyecto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='gastos_globales', to='obras.proyectoobra')),
                ('tarea_rubro', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='gastos', to='obras.rubroobra')),
            ],
        ),
        migrations.CreateModel(
            name='FotoAvance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fecha_avance', models.DateField()),
                ('descripcion', models.CharField(max_length=200)),
                ('imagen', models.ImageField(upload_to='avances_obra/')),
                ('fecha_carga', models.DateTimeField(auto_now_add=True)),
                ('proyecto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fotos_avance', to='obras.proyectoobra')),
            ],
            options={'ordering': ['-fecha_avance']},
        ),
        migrations.CreateModel(
            name='ContratistaObra',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre_proveedor', models.CharField(max_length=150)),
                ('monto_contrato', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_pagado', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('porcentaje_avance_rubro', models.DecimalField(decimal_places=2, default=0.0, max_digits=5)),
                ('proyecto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contratistas', to='obras.proyectoobra')),
                ('rubro', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='obras.rubroobra')),
            ],
        ),
        migrations.CreateModel(
            name='CajaChicaObra',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fecha', models.DateField(default=datetime.date.today)),
                ('tipo', models.CharField(choices=[('FONDO', 'Asignación de Fondo'), ('GASTO', 'Rendición de Gasto Menor')], default='GASTO', max_length=10)),
                ('detalle', models.CharField(max_length=250)),
                ('monto', models.DecimalField(decimal_places=2, max_digits=12)),
                ('rendido_y_aprobado', models.BooleanField(default=False)),
                ('proyecto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cajas_chicas', to='obras.proyectoobra')),
            ],
        ),
        migrations.CreateModel(
            name='ProyectoRubro',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=100)),
                ('porcentaje_avance', models.IntegerField(default=0)),
                ('monto_gasto', models.DecimalField(decimal_places=2, default=0.0, max_digits=12)),
                ('proyecto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rubros_progreso', to='obras.proyectoobra')),
            ],
        ),
        migrations.CreateModel(
            name='RemitoMaterial',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fecha', models.DateField(default=datetime.date.today)),
                ('proveedor_corralon', models.CharField(max_length=150)),
                ('material_detalle', models.CharField(max_length=255)),
                ('cantidad', models.CharField(blank=True, max_length=50, null=True)),
                ('critico_faltante', models.BooleanField(default=False)),
                ('recibido', models.BooleanField(default=True)),
                ('proyecto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='remitos', to='obras.proyectoobra')),
            ],
        ),
        migrations.CreateModel(
            name='Tarea',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titulo', models.CharField(max_length=255)),
                ('contenido', models.TextField(blank=True)),
                ('completada', models.BooleanField(default=False)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('fecha_limite', models.DateField(blank=True, null=True)),
                ('tipo', models.CharField(choices=[('propietario', 'DEFINICIONES DEL PROPIETARIO'), ('operativa', 'TAREA NUESTRA / INTERNA')], default='operativa', max_length=20)),
                ('presupuesto_mano_obra', models.DecimalField(decimal_places=2, default=0.0, max_digits=12)),
                ('presupuesto_materiales', models.DecimalField(decimal_places=2, default=0.0, max_digits=12)),
                ('proyecto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tareas', to='obras.proyectoobra')),
            ],
            options={'verbose_name': 'Tarea', 'verbose_name_plural': 'Tareas'},
        ),
    ]
