#!/usr/bin/env bash
# =============================================================================
# PASO 3 — Preparar dump del viejo para importar en NODOCORE
#
# Transforma:
#   INSERT INTO public.cuentas ...  →  INSERT INTO nodo_finanzas_personales.cuentas (..., user_id) ...
#
# Uso:
#   export TARGET_USER_ID='uuid-del-usuario-en-nodocore-auth'
#   ./prepare-import-for-nodocore.sh ./legacy-export-XXXX/public_finanzas_data.sql
#
# Luego ejecutá el .sql generado en el Supabase de nodocore (SQL Editor o psql).
# =============================================================================

set -euo pipefail

INPUT="${1:-}"
TARGET_USER_ID="${TARGET_USER_ID:-}"

if [[ -z "$INPUT" || ! -f "$INPUT" ]]; then
  echo "Uso: TARGET_USER_ID=<uuid> $0 <public_finanzas_data.sql>"
  exit 1
fi

if [[ -z "$TARGET_USER_ID" ]]; then
  echo "Error: definí TARGET_USER_ID (Authentication → Users → id en nodocore)"
  exit 1
fi

OUT="${INPUT%.sql}_nodocore_ready.sql"

# Tablas que llevan user_id en nodocore (cotizaciones_dolar es compartida)
TENANT_TABLES=(
  rubros categorias subcategorias cuentas sueldos tarjetas prestamos planes_ahorro
  cuentas_bancarias gastos_fijos gastos_diarios tarjetas_consumos movimientos_cuenta
  cuotas_programadas cuotas_planes_ahorro configuracion_usuario
)

{
  echo "-- Import generado desde legacy public → nodo_finanzas_personales"
  echo "-- user_id: $TARGET_USER_ID"
  echo "-- NOTA: si tenés subcategorias, aplicá antes 005_subcategorias.sql en nodocore"
  echo "begin;"
  echo ""
} > "$OUT"

# Reemplazo schema public → nodo_finanzas_personales
sed 's/INSERT INTO public\./INSERT INTO nodo_finanzas_personales./g' "$INPUT" >> "$OUT"

# Agregar user_id a INSERTs de tablas tenant (sed por tabla)
for table in "${TENANT_TABLES[@]}"; do
  # INSERT INTO nodo_finanzas_personales.rubros (col1, col2) VALUES (...);
  # → INSERT INTO ... (col1, col2, user_id) VALUES (..., 'uuid');
  perl -i -pe "
    if (/^INSERT INTO nodo_finanzas_personales\\.${table} \\(([^)]+)\\) VALUES \\((.+\\));\\s*\$/) {
      \$_ = \"INSERT INTO nodo_finanzas_personales.${table} (\$1, user_id) VALUES (\$2, '${TARGET_USER_ID}');\\n\";
    }
  " "$OUT" 2>/dev/null || true
done

{
  echo ""
  echo "commit;"
} >> "$OUT"

echo "✓ Archivo listo: $OUT"
echo ""
echo "Revisá el archivo y ejecutalo en el Supabase de nodocore."
echo "Si perl no aplicó user_id en alguna tabla, avisame y lo ajustamos."
