from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import GastoObra
from .services import CajaService


@receiver(post_save, sender=GastoObra)
def trigger_caja_obra(sender, instance, **kwargs):
    CajaService.registrar_ingreso_obra(instance)
