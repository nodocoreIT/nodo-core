# BACKUP & RECOVERY AUDIT — Nodo Clínica

**Fecha:** 2026-08-29 · **Modo:** read-only. Proyecto `iprrlgmhpsxzyrejabtu` (NodoCore), Postgres 17, región us-west-2, estado ACTIVE_HEALTHY.

> **Limitación de esta pasada:** el tier del proyecto y el estado de PITR/backups automáticos NO son visibles vía las herramientas MCP disponibles; se deben confirmar en el dashboard de Supabase (Settings → Database → Backups). Este documento marca lo verificable y lo que queda por confirmar.

## Pregunta central

> Si mañana alguien elimina accidentalmente historias clínicas, recetas, estudios o documentos, ¿cómo se recuperan?

### Base de datos (Postgres)

- **Depende del tier + PITR (a confirmar).** Free: sin backups gestionados. Pro: backups diarios (retención ~7 días). PITR: add-on pago que permite restaurar a un punto en el tiempo.
- **Agravante `DM-001`:** los datos clínicos tienen FKs `ON DELETE CASCADE`. Un borrado de professional/patient elimina en cascada historia clínica, recetas, estudios y SOAP. Sin PITR o backup reciente, es **pérdida irreversible**.
- **Agravante `DM-002`:** el schema no está versionado en migraciones (tablas base aplicadas a mano). Recrear un entorno limpio o validar la estructura post-restore es manual y propenso a error.

### Supabase Storage (PDFs, comprobantes, documentos de pacientes)

- **NO está cubierto por los backups de la base de datos.** Los backups de Postgres respaldan filas/metadatos, NO los objetos de Storage. Un borrado de un objeto de Storage (o del bucket) no se recupera desde un backup de DB.
- No se detectó una estrategia de backup de Storage (versioning de bucket, réplica externa) en el repo.

## Hallazgos

```
ID: BAK-001
SEVERIDAD: P1
AREA: DR / recuperación de datos clínicos
ARCHIVO: config Supabase (a confirmar) + DM-001 + DM-002
DESCRIPCION: La capacidad de recuperar historia clínica ante un borrado accidental no está confirmada (PITR/backup depende del tier, no verificable por MCP), y está degradada por la cascada destructiva (DM-001) y el schema no versionado (DM-002).
IMPACTO: Riesgo de pérdida irreversible de documentación médica de retención legal (Ley 26.529, 10 años).
PROBABILIDAD: media
RECOMENDACION: Confirmar/activar PITR en producción; documentar RPO/RTO; quitar cascadas destructivas + soft-delete; versionar el schema.
```

```
ID: BAK-002
SEVERIDAD: P1
AREA: DR / Supabase Storage sin backup
ARCHIVO: estrategia de Storage (no detectada)
DESCRIPCION: Los objetos de Storage (recetas/estudios/informes/comprobantes en PDF, documentos subidos por pacientes) no están cubiertos por los backups de la DB y no se detectó estrategia de respaldo propia.
IMPACTO: Un borrado accidental de objetos/bucket es irrecuperable; los PDFs firmados de documentos clínicos se perderían.
PROBABILIDAD: media
RECOMENDACION: Habilitar versioning del bucket y/o réplica periódica a almacenamiento externo; restringir permisos de borrado de Storage.
```

## RPO / RTO objetivo (propuesto)

| Métrica | Objetivo propuesto | Estado actual |
| ------- | ------------------ | ------------- |
| RPO (DB) | ≤ 5 min (con PITR) | ❓ a confirmar |
| RTO (DB) | ≤ 1 h | ❓ a confirmar |
| RPO (Storage) | ≤ 24 h | ❌ sin estrategia |
| RTO (Storage) | ≤ 4 h | ❌ sin estrategia |

## Acción pendiente (para cerrar el doc)

- Confirmar en el dashboard: tier, backups automáticos, retención y PITR.
- Ejecutar un **restore de prueba** (a un proyecto/branch aislado) para medir RTO real. No probar contra producción.
