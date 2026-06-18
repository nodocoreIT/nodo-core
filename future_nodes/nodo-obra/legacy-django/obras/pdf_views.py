import os
from datetime import datetime
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

from .models import ProyectoObra, GastoObra


@login_required
def generar_reporte_obra_pdf(request, proyecto_id):
    proyecto = get_object_or_404(ProyectoObra, id=proyecto_id)
    gastos = GastoObra.objects.filter(proyecto=proyecto).order_by('fecha')

    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="Reporte_{proyecto.nombre}.pdf"'

    c = canvas.Canvas(response, pagesize=A4)
    width, height = A4
    VERDE = colors.HexColor("#003300")
    GRIS_FONDO = colors.HexColor("#F8F9FA")

    logo_path = os.path.join(settings.BASE_DIR, 'obras', 'static', 'logo1.png')
    if os.path.exists(logo_path):
        c.drawImage(logo_path, 1.2*cm, height - 3.4*cm, width=3.2*cm, height=2.8*cm, preserveAspectRatio=True, mask='auto')
        x_texto = 4.8*cm
    else:
        x_texto = 1.5*cm

    c.setFillColor(VERDE)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(x_texto, height - 1.8*cm, "NODO OBRA")
    c.setFont("Helvetica", 12)
    c.drawString(x_texto, height - 2.4*cm, "DIRECCIÓN DE OBRAS")

    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - 1.5*cm, height - 1.8*cm, "REPORTE DE OBRA")
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 1.5*cm, height - 2.4*cm, f"Fecha: {datetime.now().strftime('%d/%m/%Y')}")

    c.setStrokeColor(VERDE)
    c.setLineWidth(0.5)
    c.line(1.5*cm, height - 3.8*cm, width - 1.5*cm, height - 3.8*cm)

    y = height - 5.5*cm
    c.setFillColor(GRIS_FONDO)
    c.rect(1.5*cm, y - 1.8*cm, width - 3*cm, 2.2*cm, fill=1, stroke=0)

    cliente_nombre = proyecto.cliente.nombre if proyecto.cliente else "—"
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(2*cm, y, f"PROYECTO: {proyecto.nombre.upper()}")
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, y - 0.6*cm, f"DIRECCIÓN: {proyecto.direccion_obra}")
    c.drawString(2*cm, y - 1.2*cm, f"CLIENTE: {cliente_nombre}")

    dict_rubros = {}
    for g in gastos:
        nombre = str(g.tarea_rubro.nombre).strip().upper() if g.tarea_rubro else "GENERAL"
        dict_rubros.setdefault(nombre, []).append(g)

    y -= 3.2*cm
    total_general = 0
    total_honorarios = 0

    for nombre_rubro, lista_tickets in dict_rubros.items():
        if y < 5*cm:
            c.showPage()
            y = height - 3*cm

        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(VERDE)
        c.drawString(1.5*cm, y, f"RUBRO: {nombre_rubro}")
        y -= 0.8*cm

        c.setFont("Helvetica", 8)
        c.setFillColor(colors.black)
        subtotal_rubro = 0
        for g in lista_tickets:
            if y < 3*cm:
                c.showPage()
                y = height - 3*cm
            c.drawString(1.5*cm, y, g.fecha.strftime('%d/%m/%Y'))
            detalle = (g.detalle[:55] + '..') if len(g.detalle) > 55 else g.detalle
            c.drawString(3.5*cm, y, detalle)
            if g.tipo_componente == 'MANO_OBRA':
                c.drawRightString(16*cm, y, f"$ {g.monto_ticket:,.2f}")
            else:
                c.drawRightString(19*cm, y, f"$ {g.monto_ticket:,.2f}")
            subtotal_rubro += g.monto_ticket
            total_honorarios += (g.ganancia_direccion or 0)
            y -= 0.45*cm

        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(19*cm, y, f"$ {subtotal_rubro:,.2f}")
        total_general += subtotal_rubro
        y -= 1.2*cm

    if y < 6*cm:
        c.showPage()
        y = height - 3*cm

    y -= 0.5*cm
    c.setFont("Helvetica", 11)
    c.drawString(10.5*cm, y, "TOTAL GASTOS:")
    c.drawRightString(19*cm, y, f"$ {total_general:,.2f}")

    y -= 1*cm
    c.setFillColor(VERDE)
    c.rect(10*cm, y - 0.4*cm, width - 11.5*cm, 1*cm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(10.5*cm, y, "TOTAL A RENDIR:")
    c.drawRightString(19*cm, y, f"$ {total_general + total_honorarios:,.2f}")

    c.save()
    return response
