from django.core.management.base import BaseCommand
from obras.models import RubroObra

RUBROS_BASE = [
    'Direccion de Obra', 'Albañileria', 'Electricidad', 'Plomeria',
    'Pintura', 'Carpinteria', 'Herrería', 'Yesería', 'Pisos',
]


class Command(BaseCommand):
    help = 'Carga los rubros base para nuevas obras'

    def handle(self, *args, **options):
        for nombre in RUBROS_BASE:
            RubroObra.objects.get_or_create(nombre=nombre)
        self.stdout.write(self.style.SUCCESS('Rubros base cargados.'))
