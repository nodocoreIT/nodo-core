#!/usr/bin/env bash
# =============================================================================
# PASO 2 — Exportar del SUPABASE VIEJO (schema PUBLIC)
#
# Connection string: Dashboard → Project Settings → Database → URI (rol postgres)
#
#   export LEGACY_DB_URL='postgresql://postgres.[ref]:[PASSWORD]@....pooler.supabase.com:5432/postgres'
#   ./export-legacy-data.sh
# =============================================================================

set -euo pipefail

LEGACY_SCHEMA="${LEGACY_SCHEMA:-public}"
OUT_DIR="${OUT_DIR:-./legacy-export-$(date +%Y%m%d-%H%M%S)}"

# Solo tablas de finanzas — NO dumpeamos todo public (auth, etc.)
FINANZAS_TABLES=(
  rubros
  categorias
  subcategorias
  cuentas
  sueldos
  tarjetas
  prestamos
  planes_ahorro
  cuentas_bancarias
  gastos_fijos
  gastos_diarios
  tarjetas_consumos
  movimientos_cuenta
  cuotas_programadas
  cuotas_planes_ahorro
  configuracion_usuario
  cotizaciones_dolar
)

if [[ -z "${LEGACY_DB_URL:-}" ]]; then
  echo "Error: definí LEGACY_DB_URL con la connection string del Supabase viejo."
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "Exportando tablas de finanzas desde schema: $LEGACY_SCHEMA"
echo "Destino: $OUT_DIR"
echo ""

# ── SQL dump (INSERTs, conserva UUIDs) ───────────────────────────────────────
DUMP_FILE="$OUT_DIR/public_finanzas_data.sql"
TABLE_ARGS=()
for t in "${FINANZAS_TABLES[@]}"; do
  TABLE_ARGS+=(--table="${LEGACY_SCHEMA}.${t}")
done

pg_dump "$LEGACY_DB_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --column-inserts \
  "${TABLE_ARGS[@]}" \
  --file="$DUMP_FILE"

echo "✓ Dump SQL: $DUMP_FILE"

# ── CSV por tabla ───────────────────────────────────────────────────────────
for table in "${FINANZAS_TABLES[@]}"; do
  if psql "$LEGACY_DB_URL" -tAc \
    "select 1 from information_schema.tables where table_schema='$LEGACY_SCHEMA' and table_name='$table'" \
    | grep -q 1; then
    psql "$LEGACY_DB_URL" -c \
      "\copy (select * from ${LEGACY_SCHEMA}.${table}) to '${OUT_DIR}/${table}.csv' with csv header"
    echo "✓ CSV: ${table}.csv"
  else
    echo "⊘ Tabla omitida (no existe): ${LEGACY_SCHEMA}.${table}"
  fi
done

echo ""
echo "Listo."
echo "El dump tiene INSERT INTO public.* — el paso 3 lo transforma a"
echo "nodo_finanzas_personales.* con tu user_id en nodocore."
