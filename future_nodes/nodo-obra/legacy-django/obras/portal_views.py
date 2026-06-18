from decimal import Decimal
from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Q
from django.shortcuts import get_object_or_404, redirect, render

from .models import Cliente, ProyectoObra, GastoObra, Tarea


@login_required
def cliente_dashboard(request):
    cliente = getattr(request.user, 'perfil_cliente', None)
    if not cliente:
        if request.user.is_staff:
            return redirect('dashboard_obras')
        return redirect('login')

    if not cliente.puede_ver_portal:
        return redirect('login')

    mis_obras = ProyectoObra.objects.filter(cliente=cliente).exclude(estado='FINALIZADO')
    return render(request, 'obras/cliente_dashboard.html', {
        'cliente': cliente,
        'mis_obras': mis_obras,
    })


@login_required
def detalle_obra_cliente(request, obra_id):
    obra = get_object_or_404(ProyectoObra, id=obra_id)
    cliente = getattr(request.user, 'perfil_cliente', None)

    if cliente and obra.cliente_id != cliente.id and not request.user.is_staff:
        return redirect('cliente_dashboard')

    if cliente and not cliente.puede_ver_portal:
        return redirect('login')

    gastos = GastoObra.objects.filter(proyecto=obra).order_by('tarea_rubro__nombre', '-id')
    trabajos_ejecutados = Tarea.objects.filter(
        proyecto=obra, completada=True
    ).exclude(tipo='propietario').order_by('-id')[:5]
    pendientes = Tarea.objects.filter(
        proyecto=obra, tipo='propietario', completada=False
    ).order_by('fecha_limite', '-id')

    rubros = obra.rubros_progreso.all()
    if rubros.exists():
        porcentaje_avance = round(sum(r.porcentaje_avance for r in rubros) / rubros.count())
    else:
        porcentaje_avance = obra.porcentaje_avance

    gastos_adm = gastos.filter(
        Q(detalle__icontains='direccion') |
        Q(tarea_rubro__nombre__icontains='direccion')
    )
    total_honorarios = gastos_adm.aggregate(Sum('monto_ticket'))['monto_ticket__sum'] or Decimal('0.00')
    mo = gastos.filter(tipo_componente='MANO_OBRA').exclude(
        id__in=gastos_adm.values_list('id', flat=True)
    ).aggregate(Sum('monto_ticket'))['monto_ticket__sum'] or Decimal('0.00')
    total_materiales = gastos.filter(tipo_componente='MATERIALES').exclude(
        id__in=gastos_adm.values_list('id', flat=True)
    ).aggregate(Sum('monto_ticket'))['monto_ticket__sum'] or Decimal('0.00')
    total_general = gastos.aggregate(Sum('monto_ticket'))['monto_ticket__sum'] or Decimal('0.00')

    presupuesto = obra.presupuesto_estimado or Decimal('0.00')
    porcentaje_caja = int((total_general / presupuesto) * 100) if presupuesto > 0 else 0

    return render(request, 'obras/detalle_obra_propietario.html', {
        'obra': obra,
        'gastos': gastos,
        'trabajos_ejecutados': trabajos_ejecutados,
        'pendientes_propietario': pendientes,
        'porcentaje_avance_real': porcentaje_avance,
        'porcentaje_caja': porcentaje_caja,
        'caja_excedida': total_general > presupuesto,
        'total_mano_obra': mo + total_honorarios,
        'total_materiales': total_materiales,
        'total_honorarios': total_honorarios,
        'total_a_rendir': total_general,
        'total_acumulado': total_general,
    })
