import json
import os
from decimal import Decimal, InvalidOperation
from datetime import datetime, date
from django.conf import settings
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponse 
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Q, F
from django.db import models
from .configuracion import CONFIG_OBRAS, CONFIG_PLATAFORMA
from django.db.models.signals import post_save
from obras.models import (
    ProyectoObra, GastoObra, Tarea, RubroObra, 
    CuentaBancaria, MovimientoCaja, Cliente, FotoAvance,
    ProyectoRubro
    )
from obras.pdf_views import generar_reporte_obra_pdf
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

from django.utils import timezone
from django.contrib import messages




@login_required
def home_router(request):
    if hasattr(request.user, 'perfil_cliente') and request.user.perfil_cliente and not request.user.is_staff:
        return redirect('cliente_dashboard')
    return redirect('dashboard_obras')

@login_required
def generar_remito_gasto_pdf(request, gasto_id):
    gasto = get_object_or_404(GastoObra, id=gasto_id)
    
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="Remito_{gasto.id}.pdf"'

    c = canvas.Canvas(response, pagesize=A4)
    width, height = A4
    VERDE_INMO = colors.HexColor("#003300")

    # --- ENCABEZADO ---
    logo_path = os.path.join(settings.BASE_DIR, 'obras', 'static', 'logo1.png')
    logo_existe = os.path.exists(logo_path)

    if logo_existe:
        c.drawImage(logo_path, 1.2*cm, height - 3.4*cm, width=3.2*cm, height=2.8*cm, preserveAspectRatio=True, mask='auto')
        x_texto = 4.8*cm
    else:
        x_texto = 1.5*cm

    c.setFillColor(VERDE_INMO)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(x_texto, height - 1.8*cm, "MILTON LÓPEZ")
    c.setFont("Helvetica", 12)
    c.drawString(x_texto, height - 2.4*cm, "SERVICIOS INMOBILIARIOS")
    
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - 1.5*cm, height - 1.8*cm, "REMITO DE PAGO / COMPROBANTE")
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 1.5*cm, height - 2.4*cm, f"N° Ref: {gasto.id} | Fecha: {gasto.fecha.strftime('%d/%m/%Y')}")

    # Línea divisoria
    c.setStrokeColor(VERDE_INMO)
    c.setLineWidth(0.5)
    c.line(1.5*cm, height - 3.8*cm, width - 1.5*cm, height - 3.8*cm)

    # --- CUERPO ---
    y = height - 5.5*cm
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1.5*cm, y, "DETALLE DEL PAGO:")
    
    y -= 1.2*cm
    data = [
        ["PROYECTO:", str(gasto.proyecto.nombre).upper()],
        ["CONCEPTO/RUBRO:", str(gasto.tarea_rubro.nombre if gasto.tarea_rubro else "GENERAL").upper()],
        ["DETALLE:", gasto.detalle],
        ["MONTO:", f"$ {gasto.monto_ticket:,.2f}"],
    ]

    for label, value in data:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2*cm, y, label)
        c.setFont("Helvetica", 10)
        c.drawString(6*cm, y, str(value))
        y -= 0.8*cm

    # --- FIRMAS ---
    y -= 3*cm
    c.setStrokeColor(colors.black)
    c.setDash(1, 2)
    c.line(1.5*cm, y, 8*cm, y)
    c.line(11*cm, y, 18.5*cm, y)
    
    c.setDash([], 0) 
    c.setFont("Helvetica", 8)
    c.drawString(2.5*cm, y - 0.4*cm, "Firma del Receptor")
    c.drawString(12.5*cm, y - 0.4*cm, "Firma Dirección de Obra")

    c.save()
    return response

@login_required
def dashboard_obras(request):
    # Verificación del módulo activo
    if not CONFIG_OBRAS["modulo_activo"]:
        return render(request, "obras/modulo_desactivado.html")

    if request.method == 'POST':
        # A) PROCESA EL BOTÓN DE "ALERTA URGENTE"
        if 'registrar_alerta_urgente' in request.POST:
            proyecto_id = request.POST.get('proyecto_id')
            titulo_alerta = request.POST.get('titulo_alerta')
            if proyecto_id and titulo_alerta:
                obra_obj = get_object_or_404(ProyectoObra, id=proyecto_id)
                Tarea.objects.create(
                    proyecto=obra_obj,
                    titulo=f"🚨 URGENTE: {titulo_alerta}",
                    completada=False,
                    tipo='agenda'
                )
            return redirect('dashboard_obras')

        # B) PROCESA LOS BOTONES "+" RAPIDOS (AGENDA, LOGÍSTICA Y CAJAS)
        elif 'agregar_tarea_rapida' in request.POST:
            proyecto_id = request.POST.get('proyecto_id')
            titulo = request.POST.get('titulo')
            tipo_tarea = request.POST.get('tipo_tarea') # 'agenda', 'logistica' o 'caja'
            es_critica = request.POST.get('critica') == 'on'
            fecha_hora_raw = request.POST.get('fecha_hora') # Captura 'YYYY-MM-DDTHH:MM' del HTML
            
            if proyecto_id and titulo and tipo_tarea:
                obra_obj = get_object_or_404(ProyectoObra, id=proyecto_id)
                
                # Si es logística y marcaron crítica
                if es_critica:
                    titulo = f"🚨 {titulo}"
                
                # Si es agenda y pusieron una fecha/hora, la formateamos lindo para el título
                if tipo_tarea == 'agenda' and fecha_hora_raw:
                    try:
                        # De '2026-05-17T18:30' pasamos a '17/05 18:30'
                        fecha_partes = fecha_hora_raw.split('T')
                        fecha_arr = fecha_partes[0].split('-')
                        anio, mes, dia = fecha_arr[0], fecha_arr[1], fecha_arr[2]
                        hora = fecha_partes[1]
                        
                        titulo = f"[{dia}/{mes} {hora}] {titulo}"
                    except Exception:
                        # Por si las dudas falla el split, lo dejamos con el formato crudo
                        titulo = f"[{fecha_hora_raw}] {titulo}"

                # Guardamos solo los campos que existen seguro en tu BD
                Tarea.objects.create(
                    proyecto=obra_obj,
                    titulo=titulo,
                    tipo=tipo_tarea,
                    completada=False
                )
                
            return redirect('dashboard_obras')# Recarga la página limpia y con la alerta cargada

    # ─── TODO EL RESTO DE TU CÓDIGO SIGUE EXACTAMENTE IGUAL ───
    obras_db = ProyectoObra.objects.all()
    lista_obras_reales = []
    
    for obra in obras_db:
        gasto_real = GastoObra.objects.filter(proyecto=obra).aggregate(total=Sum('monto_ticket'))['total'] or 0
        presupuesto = obra.presupuesto_estimado or 0
        porcentaje_gasto = round((gasto_real / presupuesto) * 100, 1) if presupuesto > 0 else 0
        
        porcentaje_avance = obra.porcentaje_avance
        alerta_desvio = (porcentaje_gasto > (porcentaje_avance + 15)) or (gasto_real > presupuesto)

        propiedad_nombre = obra.direccion_obra or "Sin dirección asignada"

        contratistas = obra.contratistas.all()
        remitos = obra.remitos.all()
        cajas = obra.cajas_chicas.all()

        fondos_caja = cajas.filter(tipo='FONDO').aggregate(t=Sum('monto'))['t'] or 0
        gastos_caja = cajas.filter(tipo='GASTO').aggregate(t=Sum('monto'))['t'] or 0
        saldo_caja_chica = fondos_caja - gastos_caja

        lista_obras_reales.append({
            'objeto': obra,
            'nombre': obra.nombre,
            'propiedad_vinculada': propiedad_nombre,
            'gasto_real': gasto_real,
            'presupuesto_estimado': presupuesto,
            'porcentaje_gasto': porcentaje_gasto,
            'porcentaje_avance': porcentaje_avance,
            'alerta_desvio': alerta_desvio,
            'encargado': obra.encargado,
            
            'contratistas': contratistas,
            'remitos_logistica': remitos,
            'faltantes_criticos': remitos.filter(critico_faltante=True),
            'cajas_rendiciones': cajas,
            'saldo_caja_chica': saldo_caja_chica,
        })

    total_obras = len(lista_obras_reales)
    obras_con_desvio = sum(1 for o in lista_obras_reales if o['alerta_desvio'])
    presupuesto_total = sum(o['presupuesto_estimado'] for o in lista_obras_reales)
    gasto_total = sum(o['gasto_real'] for o in lista_obras_reales)
    porcentaje_global = round((gasto_total / presupuesto_total) * 100, 1) if presupuesto_total > 0 else 0

    # Cambiamos aquí para inyectar la lista de proyectos completa en el contexto
    # y que el modal desplegable pueda listar tus obras correctamente
    tareas_db = Tarea.objects.filter(completada=False, proyecto__isnull=False)
    
    contexto = {
        'obras': lista_obras_reales,
        'proyectos': lista_obras_reales, # <--- Agregamos esto para que el select HTML lea las opciones
        'totales': {
            'presupuesto_total': f"{presupuesto_total:,.0f}".replace(",", "."),
            'gasto_total': f"{gasto_total:,.0f}".replace(",", "."),
            'porcentaje_global': porcentaje_global,
        },
        'obras_con_desvio': obras_con_desvio,
        
        'tareas_agenda': tareas_db.filter(tipo='agenda'),
        'tareas_logistica': tareas_db.filter(tipo='logistica'),
        'tareas_caja': tareas_db.filter(tipo='caja'),
    }
    
    return render(request, "obras/dashboard_obras.html", context=contexto)


@login_required
def crear_obra_view(request):
    # Buscamos si viene un ID en la URL (?id=...) para saber si editamos
    obra_id = request.GET.get('id')
    obra_instancia = None
    tareas_dict = {}  # Diccionario para consultar montos precargados en el HTML
    
    if obra_id:
        obra_instancia = get_object_or_404(ProyectoObra, id=obra_id)
        # Traemos sus tareas actuales mapeadas por su título para usarlas en el HTML
        for t in Tarea.objects.filter(proyecto=obra_instancia):
            mo = getattr(t, 'presupuesto_mano_obra', 0) or getattr(t, 'monto_mano_obra', 0) or 0
            mat = getattr(t, 'presupuesto_materiales', 0) or getattr(t, 'monto_materiales', 0) or 0
            
            # Guardamos indexando por el nombre del rubro para cruzarlo en el script del HTML
            tareas_dict[t.titulo] = {
                'mo': float(mo), 
                'mat': float(mat), 
                'activa': True
            }

    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        plazo = request.POST.get('plazo_meses')
        contingencia = request.POST.get('porcentaje_contingencia')
        rubros_activos = request.POST.getlist('rubros_activos')  # Lista de nombres de rubros tildados
        
        # 1. Cliente
        crear_nuevo_cliente = request.POST.get('crear_nuevo_propietario') == 'true'
        cliente_obj = None

        if crear_nuevo_cliente:
            p_nombre = request.POST.get('nuevo_prop_nombre') or ''
            p_apellido = request.POST.get('nuevo_prop_apellido') or ''
            p_dni = request.POST.get('nuevo_prop_dni') or ''
            p_telefono = request.POST.get('nuevo_prop_telefono') or ''
            p_dir = request.POST.get('nuevo_prop_direccion_particular') or ''
            if p_nombre:
                cliente_obj = Cliente.objects.create(
                    nombre=f"{p_nombre} {p_apellido}".strip(),
                    dni=p_dni,
                    telefono=p_telefono,
                    domicilio=p_dir,
                )
        else:
            cliente_id = request.POST.get('propietario')
            if cliente_id:
                cliente_obj = get_object_or_404(Cliente, id=cliente_id)

        # 2. Dirección de obra
        crear_nueva_dir = request.POST.get('crear_nueva_propiedad') == 'true'
        direccion_obra = ''
        tipo_inmueble = 'Casa'

        if crear_nueva_dir:
            direccion_obra = request.POST.get('nueva_prop_direccion') or ''
            tipo_inmueble = request.POST.get('nueva_prop_tipo') or 'Casa'
        else:
            obra_ref_id = request.POST.get('propiedad')
            if obra_ref_id:
                ref = get_object_or_404(ProyectoObra, id=obra_ref_id)
                direccion_obra = ref.direccion_obra
                tipo_inmueble = ref.tipo_inmueble
            elif obra_instancia:
                direccion_obra = obra_instancia.direccion_obra
                tipo_inmueble = obra_instancia.tipo_inmueble

        if not direccion_obra:
            direccion_obra = request.POST.get('nueva_prop_direccion') or (obra_instancia.direccion_obra if obra_instancia else 'Sin dirección')

        # 3. Guardar proyecto
        if nombre:
            if obra_instancia:
                obra_instancia.nombre = nombre
                obra_instancia.cliente = cliente_obj or obra_instancia.cliente
                obra_instancia.direccion_obra = direccion_obra
                obra_instancia.tipo_inmueble = tipo_inmueble
                obra_instancia.plazo_meses = plazo or 6
                obra_instancia.porcentaje_contingencia = contingencia or 1.00
                obra_instancia.save()
                nueva_obra = obra_instancia
            else:
                nueva_obra = ProyectoObra.objects.create(
                    nombre=nombre,
                    cliente=cliente_obj,
                    direccion_obra=direccion_obra,
                    tipo_inmueble=tipo_inmueble,
                    presupuesto_estimado=0,
                    plazo_meses=plazo or 6,
                    porcentaje_contingencia=contingencia or 1.00,
                )
            
            total_presupuesto_calculado = 0
            
            # 4. CREACIÓN Y PROCESAMIENTO DE RUBROS Y TAREAS
            # Si estamos editando, limpiamos rubros antiguos para refrescar la selección
            if obra_instancia:
                obra_instancia.rubros_progreso.all().delete()

            for rubro in rubros_activos:
                val_mo = request.POST.get(f'mo_{rubro}') or 0
                val_mat = request.POST.get(f'mat_{rubro}') or 0
                
                try:
                    val_mo_float = float(val_mo) if float(val_mo) > 0 else 0
                    val_mat_float = float(val_mat) if float(val_mat) > 0 else 0
                except ValueError:
                    val_mo_float = 0
                    val_mat_float = 0

                total_presupuesto_calculado += (val_mo_float + val_mat_float)
                
                # A. Guardar en TAREA (para la gestión operativa)
                tipo_tab = 'agenda' if rubro.strip().lower() == 'direccion de obra' else 'gremios'
                campos_tarea = {
                    'proyecto': nueva_obra,
                    'titulo': rubro,
                    'tipo': tipo_tab,
                    'completada': False
                }
                if hasattr(Tarea, 'presupuesto_mano_obra'):
                    campos_tarea.update({'presupuesto_mano_obra': val_mo_float, 'presupuesto_materiales': val_mat_float})
                else:
                    campos_tarea.update({'monto_mano_obra': val_mo_float, 'monto_materiales': val_mat_float})
                
                Tarea.objects.create(**campos_tarea)

                # B. CREAR EL RUBRO (Esto es lo que faltaba para que aparezca en la Ficha)
                ProyectoRubro.objects.create(
                    proyecto=nueva_obra,
                    nombre=rubro,
                    porcentaje_avance=0,
                    monto_gasto=0.00
                )

            # Seteamos el acumulado final
            nueva_obra.presupuesto_estimado = total_presupuesto_calculado
            nueva_obra.save()
            
            return redirect('ficha_obra', obra_id=nueva_obra.id)

    # Contexto para la carga inicial (GET)
    obras_existentes = ProyectoObra.objects.all().order_by('-id')
    return render(request, "obras/crear_obra.html", {
        'propiedades': obras_existentes,
        'propietarios': Cliente.objects.all(),
        'obra': obra_instancia,
        'list_of_rubros': RubroObra.objects.all(),
        'tareas_dict': tareas_dict,
        'es_edicion': obra_instancia is not None,
    })


@login_required
@csrf_exempt
def toggle_tarea_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            item_id = data.get('id')
            # Ya no importa si el tipo es 'definicion' o 'tarea', todo vive en Tarea
            completado = data.get('completado')

            # Buscamos en el modelo maestro Tarea
            tarea = get_object_or_404(Tarea, id=item_id)
            tarea.completada = completado
            tarea.save()
            
            return JsonResponse({'status': 'success'})
        except Exception as e:
            # Esto imprimirá el error real en tu consola si algo falla
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    return JsonResponse({'status': 'error'}, status=405)

@login_required
@csrf_exempt
def toggle_definicion_view(request):
    data = json.loads(request.body)
    tarea = get_object_or_404(Tarea, id=data['id'])
    tarea.completada = data['completado']
    tarea.save()
    return JsonResponse({'status': 'success'})


@login_required
def carga_rapida_obra(request, obra_id):
    obra = get_object_or_404(ProyectoObra, id=obra_id)

    if request.method == 'POST':
        try:
            rubro_id = request.POST.get('rubro_id')
            rubro = get_object_or_404(RubroObra, id=rubro_id)
            
            es_mo_switch = request.POST.get('es_mano_obra')
            cuenta_id = request.POST.get('caja_id')
            
            tipo_componente_final = "MANO_OBRA" if es_mo_switch == 'on' else "MATERIALES"
            
            # 1. Creamos el gasto
            gasto = GastoObra.objects.create(
                proyecto=obra,
                tarea_rubro=rubro,
                detalle=request.POST.get('detalle'),
                monto_ticket=Decimal(request.POST.get('monto') or 0),
                fecha=request.POST.get('fecha'),
                tipo_componente=tipo_componente_final,
                cuenta_ingreso_id=cuenta_id if cuenta_id else None,
                comprobante=request.FILES.get('comprobante')
            )
            
            # 2. DISPARAMOS LA SEÑAL MANUALMENTE
            # Esto ejecutará la lógica que hoy solo corre en el Admin
            post_save.send(sender=GastoObra, instance=gasto, created=True)
            
            messages.success(request, "Gasto registrado correctamente.")
            return redirect('carga_rapida_obra', obra_id=obra.id)
            
        except Exception as e:
            messages.error(request, f"Error al guardar: {e}")

    # ... (el resto de tu función sigue igual)

    # 1. Definimos los gastos
    gastos = GastoObra.objects.filter(proyecto=obra).order_by('-fecha', '-id')[:10]

    # 2. Filtrado de rubros basado en tus tipos existentes
    valores_tipo = obra.tareas.values_list('tipo', flat=True).distinct()
    ids_rubros = [int(v) for v in valores_tipo if str(v).isdigit()]
    
    rubros = RubroObra.objects.filter(id__in=ids_rubros).order_by('nombre')
    
    if not rubros.exists():
        rubros = RubroObra.objects.all().order_by('nombre')

    # 3. Renderizamos
    return render(request, 'obras/carga_rapida.html', {
        'obra': obra,
        'gastos': gastos,
        'rubros': rubros, 
        'mis_cajas': CuentaBancaria.objects.all(),
        'today': date.today()
    })


@login_required
def ficha_obra_detalle(request, pk):
    print(f"DEBUG: EJECUTANDO ARCHIVO EN: {__file__}")
    obra = get_object_or_404(ProyectoObra, id=pk)
    
    # 🆕 1. PROCESAR POST DEL MODAL (Pendientes internos)
    if request.method == 'POST' and 'agregar_pendiente_ficha' in request.POST:
        titulo = request.POST.get('titulo')
        tipo = request.POST.get('tipo') or 'operativa' 
        fecha_limite = request.POST.get('fecha_limite') or None
        
        Tarea.objects.create(
            proyecto=obra, 
            titulo=titulo, 
            tipo=tipo, 
            fecha_limite=fecha_limite, 
            completada=False
        )
        return redirect('ficha_obra_detalle', pk=pk)

    # 📊 2. OBTENER GASTOS Y CALCULAR FONDOS
    gastos = GastoObra.objects.filter(proyecto=obra).order_by('-fecha', '-id')
    total_gastado = gastos.aggregate(total=Sum('monto_ticket'))['total'] or Decimal('0.00')

    tareas_totales_obra = Tarea.objects.filter(proyecto=obra)
    res_presupuesto = tareas_totales_obra.aggregate(
        mo_pres=Sum('presupuesto_mano_obra'),
        mat_pres=Sum('presupuesto_materiales'),
        mo_monto=Sum('monto_mano_obra'),
        mat_monto=Sum('monto_materiales')
    )

    presupuesto = (
        (res_presupuesto['mo_pres'] or Decimal('0.00')) + (res_presupuesto['mat_pres'] or Decimal('0.00')) +
        (res_presupuesto['mo_monto'] or Decimal('0.00')) + (res_presupuesto['mat_monto'] or Decimal('0.00'))
    )

    if presupuesto == 0:
        presupuesto = getattr(obra, 'presupuesto_estimado', Decimal('0.00')) or Decimal('0.00')

    saldo_disponible = presupuesto - total_gastado
    porcentaje_consumido = int((total_gastado / presupuesto) * 100) if presupuesto > 0 else 0
    estado_financiero = "en-fecha" if saldo_disponible >= 0 else "excedido"

    # 🛠️ CÁLCULO DE GASTOS POR RUBRO - MODO DEBUG
    rubros_progreso_lista = obra.rubros_progreso.all()
    
    # Obtenemos los totales agrupados por ID para eficiencia
    gastos_query = GastoObra.objects.filter(proyecto=obra)
    
    # DEBUG EXTREMO: Ver qué está pasando realmente en la base de datos
    todos_los_gastos = GastoObra.objects.filter(proyecto=obra)
    print(f"DEBUG: Total de gastos encontrados para la obra: {todos_los_gastos.count()}")
    
    for g in todos_los_gastos:
        # Esto imprimirá en la consola CÓMO se llaman los rubros de tus gastos
        nombre_rubro_gasto = g.tarea_rubro.nombre if g.tarea_rubro else "SIN RUBRO"
        print(f"DEBUG: Gasto ID {g.id} -> Rubro real en BD: '{nombre_rubro_gasto}'")

    # Ahora sí, el cálculo corregido
    for rb in rubros_progreso_lista:
        total_monto = todos_los_gastos.filter(
            tarea_rubro__nombre__iexact=rb.nombre.strip()
        ).aggregate(total=Sum('monto_ticket'))['total'] or Decimal('0.00')
        
        rb.monto_gasto = total_monto

    # =====================================================================
    # 🎯 CONTROL DINÁMICO DE AVANCE
    # =====================================================================
    if rubros_progreso_lista.exists():
        suma_avances = sum([r.porcentaje_avance for r in rubros_progreso_lista])
        valor_avance = round(suma_avances / rubros_progreso_lista.count())
        
        if obra.avance_progreso != valor_avance:
            obra.avance_progreso = valor_avance
            obra.save()
    else:
        valor_avance = getattr(obra, 'avance_progreso', 0) or 0

    # 🛠️ 4. FILTROS DE TAREAS
    tareas_operativas = Tarea.objects.filter(proyecto=obra).exclude(tipo__iexact='propietario').order_by('completada', '-id')
    definiciones_propietario = Tarea.objects.filter(proyecto=obra, tipo__iexact='propietario').order_by('completada', 'fecha_limite')

    context = {
        'obra': obra,
        'gastos': gastos,
        'total_gastado': total_gastado,
        'presupuesto': presupuesto,
        'saldo_disponible': saldo_disponible,
        'porcentaje_consumido': porcentaje_consumido,
        'estado_financiero': estado_financiero,
        'avance_progreso': valor_avance,
        'definiciones_propietario': definiciones_propietario,
        'tareas_operativas': tareas_operativas,
        'rubros_progreso_lista': rubros_progreso_lista,
    }
    return render(request, "obras/ficha_obra.html", context)


# =========================================================================
# CONTROLADOR UNIFICADO DE IMPRESIÓN (REDIRECCIÓN AL REPORTE IMPECABLE)
# =========================================================================
@login_required
def imprimir_reporte_obra(request, obra_id):
    obra = get_object_or_404(ProyectoObra, id=obra_id)
    
    # 🎯 Si viene el parámetro de gasto_id (botón azul), genera el remito individual
    gasto_id = request.GET.get('gasto_id')
    if gasto_id:
        return generar_remito_gasto_pdf(request, gasto_id=gasto_id)
        
    # 🚀 SI ES EL REPORTE GENERAL: Redirigimos directo a la url del Admin que ya anda perfecto
    return generar_reporte_obra_pdf(request, proyecto_id=obra.id)

# ─── 1. ELIMINAR GASTO DESDE EL FRONT (Y DEVOLVER LA PLATA A LA CAJA) ───
@login_required
def eliminar_gasto_rapido(request, gasto_id):
    gasto = get_object_or_404(GastoObra, id=gasto_id)
    obra_id = gasto.proyecto.id
    
    if request.method == 'POST':
        # 🏦 Si el gasto estuvo vinculado a una cuenta, le devolvemos el dinero antes de borrarlo
        # (Ajustá 'cuenta_origen' si tu modelo GastoObra tiene otra clave foránea a CuentaBancaria)
        if hasattr(gasto, 'cuenta_origen') and gasto.cuenta_origen:
            cuenta = gasto.cuenta_origen
            cuenta.saldo += gasto.monto_ticket  # Devolvemos la plata
            cuenta.save()
            
            # Buscamos y borramos el movimiento de caja asociado para que no quede huérfano
            MovimientoCaja.objects.filter(
                cuenta=cuenta, 
                concepto__icontains=f"Gasto Obra: {gasto.detalle}"
            ).delete()
            
        # Borramos el gasto definitivamente
        gasto.delete()
        
    return redirect('carga_rapida_obra', obra_id=obra_id)


# ─── 2. EDITAR GASTO DESDE EL FRONT (MONTO O RUBRO) ───
@login_required
def editar_gasto_rapido(request, gasto_id):
    from django.shortcuts import redirect, get_object_or_404
    from django.http import HttpResponse
    from .models import GastoObra, RubroObra, CuentaBancaria
    from decimal import Decimal
    
    gasto = get_object_or_404(GastoObra, id=gasto_id)
    obra = gasto.proyecto
    rubros = RubroObra.objects.all().order_by('nombre')
    cuentas = CuentaBancaria.objects.all()

    if request.method == 'POST':
        nuevo_detalle = request.POST.get('detalle')
        nuevo_monto_str = request.POST.get('monto_ticket') or '0'
        nuevo_rubro_id = request.POST.get('tarea_rubro')
        nueva_cuenta_id = request.POST.get('cuenta_bancaria')
        nuevo_tipo = request.POST.get('tipo_componente')
        
        # Conversión segura del monto
        nuevo_monto_str = nuevo_monto_str.replace(',', '.')
        try:
            nuevo_monto = Decimal(nuevo_monto_str)
        except:
            nuevo_monto = Decimal('0.00')

        # Actualizar datos del gasto
        gasto.detalle = nuevo_detalle
        gasto.monto_ticket = nuevo_monto
        gasto.tipo_componente = nuevo_tipo
        
        if nuevo_rubro_id:
            gasto.tarea_rubro_id = nuevo_rubro_id
        else:
            gasto.tarea_rubro = None
            
        if nueva_cuenta_id:
            gasto.cuenta_origen_id = nueva_cuenta_id
        else:
            gasto.cuenta_origen = None
        
        # Procesar nueva imagen de ticket si se sube en la edición
        if request.FILES.get('comprobante'):
            gasto.comprobante = request.FILES['comprobante']
        
        gasto.save()
        
        return redirect('carga_rapida_obra', obra_id=obra.id)
        
    # --- RENDERIZADO DEL SELECTOR DE TIPO ---
    es_mo = "selected" if gasto.tipo_componente == "MANO_OBRA" else ""
    es_mat = "selected" if gasto.tipo_componente != "MANO_OBRA" else ""

    opciones_rubros = "".join([f'<option value="{r.id}" {"selected" if gasto.tarea_rubro_id == r.id else ""}>{r.nombre.upper()}</option>' for r in rubros])
    opciones_cuentas = "".join([f'<option value="{c.id}" {"selected" if getattr(gasto, "cuenta_origen_id", None) == c.id else ""}>{c.nombre}</option>' for c in cuentas])

    html_content = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Editar Gasto - SoftInmo</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body class="bg-light">
        <div class="container mt-5" style="max-width: 500px;">
            <div class="card shadow-sm border-0" style="border-radius: 12px;">
                <div class="card-header text-white p-3" style="background-color: #003300; border-radius: 12px 12px 0 0;">
                    <h5 class="mb-0 fw-bold">✏️ Modificar Gasto</h5>
                    <small class="opacity-75">Obra: {obra.nombre}</small>
                </div>
                <div class="card-body p-4">
                    <form method="POST" enctype="multipart/form-data">
                        <input type="hidden" name="csrfmiddlewaretoken" value="{request.META.get('CSRF_COOKIE', '')}">
                        
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Detalle del Gasto</label>
                            <input type="text" name="detalle" class="form-control" value="{gasto.detalle}" required>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Monto ($)</label>
                            <input type="number" name="monto_ticket" step="0.01" class="form-control" value="{gasto.monto_ticket}" required>
                        </div>

                        <div class="mb-3">
                            <label class="form-label small fw-bold">Clasificación del Gasto</label>
                            <select name="tipo_componente" class="form-select" style="font-weight: 600;">
                                <option value="MATERIALES" {es_mat}>📦 Materiales </option>
                                <option value="MANO_OBRA" {es_mo}>👷 Mano de Obra (Habilita Recibo MO)</option>
                            </select>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Asignar al Rubro</label>
                            <select name="tarea_rubro" class="form-select">
                                <option value="">-- Sin Rubro / General --</option>
                                {opciones_rubros}
                            </select>
                        </div>

                        <div class="mb-4">
                            <label class="form-label small fw-bold text-success">Caja / Cuenta Bancaria (Tu Honorario)</label>
                            <select name="cuenta_bancaria" class="form-select">
                                <option value="">-- No afecta caja --</option>
                                {opciones_cuentas}
                            </select>
                        </div>

                        <div class="mb-4">
                            <label class="form-label small fw-bold">Actualizar Ticket/Imagen (Opcional)</label>
                            <input type="file" name="comprobante" class="form-control" accept="image/*">
                        </div>
                        
                        <div class="d-flex justify-content-between">
                            <a href="/obra/{obra.id}/carga-rapida/" class="btn btn-light border px-4">Volver</a>
                            <button type="submit" class="btn text-white px-4" style="background-color: #003300;">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    return HttpResponse(html_content)

@login_required
def eliminar_gasto_rapido(request, gasto_id):
    if request.method == 'POST':
        gasto = get_object_or_404(GastoObra, id=gasto_id)
        obra_id = gasto.proyecto.id
        
        # Al borrar el gasto, tu @receiver(post_delete) en models.py
        # va a limpiar automáticamente el movimiento de caja. ¡Negocio redondo!
        gasto.delete()
        
        return redirect('carga_rapida_obra', obra_id=obra_id)
        
    return redirect('dashboard_obras')

@login_required
def finalizar_obra_view(request, obra_id):
    """ Cambia el estado de la obra a Finalizada """
    from django.shortcuts import get_object_or_404, redirect
    from django.contrib import messages
    from obras.models import ProyectoObra
    
    obra = get_object_or_404(ProyectoObra, id=obra_id)
    obra.estado = 'Finalizada'  # O como se llame tu campo de estado/etiqueta en el modelo
    obra.save()
    
    messages.success(request, f"La obra '{obra.nombre}' ha sido finalizada con éxito.")
    return redirect('dashboard_obras')


@login_required
def eliminar_obra_view(request, obra_id):
    """ Borra físicamente la obra del sistema """
    from django.shortcuts import get_object_or_404, redirect
    from django.contrib import messages
    from obras.models import ProyectoObra
    
    obra = get_object_or_404(ProyectoObra, id=obra_id)
    nombre_obra = obra.nombre
    obra.delete()
    
    messages.warning(request, f"La obra '{nombre_obra}' ha sido eliminada correctamente del sistema.")
    return redirect('dashboard_obras')

import unicodedata

def normalizar_texto(texto):
    """Quita tildes, espacios extra y pasa a mayúsculas."""
    if not texto: return ""
    texto = unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('utf-8')
    return texto.strip().upper()

@login_required
def ficha_obra_view(request, obra_id):
    obra = get_object_or_404(ProyectoObra, id=obra_id)

    # 1. PROCESAR NUEVO REQUERIMIENTO (POST)
    if request.method == 'POST' and 'titulo' in request.POST:
        Tarea.objects.create(
            proyecto=obra,
            titulo=request.POST.get('titulo'),
            tipo=request.POST.get('tipo', 'propietario'),
            fecha_limite=request.POST.get('fecha_limite') or None,
            completada=False
        )
        return redirect('ficha_obra', obra_id=obra_id)

    # 2. OBTENER GASTOS Y FONDOS
    gastos_query = GastoObra.objects.filter(proyecto=obra)
    total_gastado = gastos_query.aggregate(total=Sum('monto_ticket'))['total'] or Decimal('0.00')
    
    # Cálculo de presupuesto
    presupuesto = Decimal('0.00')
    for t in Tarea.objects.filter(proyecto=obra):
        mano = getattr(t, 'presupuesto_mano_obra', getattr(t, 'monto_mano_obra', 0)) or 0
        mat = getattr(t, 'presupuesto_materiales', getattr(t, 'monto_materiales', 0)) or 0
        presupuesto += (Decimal(str(mano)) + Decimal(str(mat)))

    if presupuesto == 0:
        presupuesto = getattr(obra, 'presupuesto_estimado', 0) or 0

    saldo_disponible = presupuesto - total_gastado
    porcentaje_consumido = int((total_gastado / presupuesto) * 100) if presupuesto > 0 else 0
    estado_financiero = "en-fecha" if saldo_disponible >= 0 else "excedido"

    # 3. SUMA DE GASTOS POR RUBRO (Versión Inmortal)
    rubros_progreso_lista = obra.rubros_progreso.all()
    
    # Normalizamos el mapa usando la función auxiliar
    totales_agrupados = gastos_query.values('tarea_rubro__nombre').annotate(total=Sum('monto_ticket'))
    mapa_totales = {
        normalizar_texto(item['tarea_rubro__nombre']): item['total'] 
        for item in totales_agrupados if item['tarea_rubro__nombre']
    }

    for rb in rubros_progreso_lista:
        clave = normalizar_texto(rb.nombre)
        rb.monto_gasto = mapa_totales.get(clave, Decimal('0.00'))

    # Contexto final
    context = {
        'obra': obra,
        'fotos_avance': obra.fotos_avance.all(),
        'gastos': gastos_query.order_by('-fecha', '-id'),
        'total_gastado': total_gastado,
        'presupuesto': presupuesto,
        'saldo_disponible': saldo_disponible,
        'porcentaje_consumido': porcentaje_consumido,
        'estado_financiero': estado_financiero,
        'avance_progreso': getattr(obra, 'avance_progreso', 0),
        'definiciones_propietario': Tarea.objects.filter(proyecto=obra, tipo__iexact='propietario').order_by('completada', 'fecha_limite'),
        'tareas_operativas': Tarea.objects.filter(proyecto=obra).exclude(tipo__iexact='propietario').order_by('completada', '-id'),
        'rubros_progreso_lista': rubros_progreso_lista,
    }
    return render(request, "obras/ficha_obra.html", context)

@csrf_exempt
@login_required
def actualizar_progreso_obra_manual(request):
    """
    Endpoint Ajax para sliders de rubros y avance manual general estático.
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            obra_id = data.get('obra_id')
            rubro_id = data.get('rubro_id')
            nuevo_progreso = int(data.get('porcentaje_avance', 0))
            
            obra = get_object_or_404(ProyectoObra, id=obra_id)
            
            # CASO A: Se movió el slider de un rubro específico
            if rubro_id is not None and rubro_id != "":
                rubro = get_object_or_404(ProyectoRubro, id=rubro_id, proyecto=obra)
                rubro.porcentaje_avance = nuevo_progreso
                rubro.save()
                
                # Recalculamos el promedio físico real basado en las barras configuradas
                rubros_obra = obra.rubros_progreso.all()
                total_rubros = rubros_obra.count()
                
                if total_rubros > 0:
                    suma_avances = sum([r.porcentaje_avance for r in rubros_obra])
                    avance_general = round(suma_avances / total_rubros)
                else:
                    avance_general = nuevo_progreso
            
            # CASO B: Es una actualización estática directa desde el input general (rubro_id es null)
            else:
                avance_general = nuevo_progreso

            # Guardamos definitivamente el valor consolidado en la obra
            obra.avance_progreso = avance_general
            obra.save()
            
            return JsonResponse({
                'status': 'success',
                'nuevo_avance_general': avance_general
            })
            
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': 'ID no encontrado en ninguna tabla'}, status=404)    
    
    return JsonResponse({'status': 'error', 'message': 'Método no permitido'}, status=405)

@csrf_exempt
@login_required
def crear_definicion_propietario(request, obra_id): # Puedes renombrarla a crear_tarea_desde_ficha luego
    if request.method == 'POST':
        # 1. Capturamos los datos
        titulo = request.POST.get('titulo')
        tipo = request.POST.get('tipo') # <--- ESTO ES LO NUEVO: captura el valor del <select>
        obra = get_object_or_404(ProyectoObra, id=obra_id)
        
        # 2. Guardamos en el modelo Tarea (que ahora tiene el campo 'tipo')
        Tarea.objects.create(
            proyecto=obra, 
            titulo=titulo, 
            tipo=tipo,  # <--- Guardamos la elección del usuario
            completada=False
        )
    return redirect('ficha_obra', obra_id=obra_id)

@login_required
def subir_foto_avance(request, obra_id):
    if request.method == 'POST':
        obra = get_object_or_404(ProyectoObra, id=obra_id)
        FotoAvance.objects.create(
            proyecto=obra,
            fecha_avance=request.POST.get('fecha'),
            descripcion=request.POST.get('descripcion'),
            imagen=request.FILES.get('imagen')
        )
    return redirect('ficha_obra', obra_id=obra_id)

@login_required
def carga_rapida_view(request, obra_id):
    # Asegúrate de usar el modelo que corresponde a tu proyecto,
    # si es ProyectoObra o simplemente Obra, cámbialo aquí.
    obra = get_object_or_404(ProyectoObra, id=obra_id)
    return render(request, "obras/carga_rapida.html", {'obra': obra})