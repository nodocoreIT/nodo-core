from .models import MovimientoCaja
import unicodedata


class CajaService:
    @staticmethod
    def limpiar(texto):
        return "".join(
            c for c in unicodedata.normalize('NFD', str(texto).upper())
            if unicodedata.category(c) != 'Mn'
        ).strip()

    @staticmethod
    def registrar_ingreso_obra(gasto_obra):
        if not gasto_obra.cuenta_ingreso:
            return

        nombre_rubro = CajaService.limpiar(
            gasto_obra.tarea_rubro.nombre if gasto_obra.tarea_rubro else "General"
        )

        if "DIRECCION" in nombre_rubro:
            MovimientoCaja.objects.update_or_create(
                referencia_id=f"OBRA-{gasto_obra.id}",
                defaults={
                    'fecha': gasto_obra.fecha,
                    'tipo': 'INGRESO',
                    'monto': gasto_obra.monto_ticket,
                    'cuenta': gasto_obra.cuenta_ingreso,
                    'descripcion': f"Honorarios Dirección: {gasto_obra.proyecto.nombre} - {gasto_obra.detalle}",
                },
            )
