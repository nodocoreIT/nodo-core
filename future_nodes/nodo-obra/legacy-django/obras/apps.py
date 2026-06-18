from django.apps import AppConfig


class ObrasConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'obras'
    verbose_name = 'Dirección de Obras'

    def ready(self):
        import obras.signals  # noqa: F401
