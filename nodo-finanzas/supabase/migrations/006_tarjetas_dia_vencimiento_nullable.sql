-- Legacy tarjetas may omit dia_vencimiento (nullable in source app).
ALTER TABLE nodo_finanzas_personales.tarjetas
  ALTER COLUMN dia_vencimiento DROP NOT NULL;
