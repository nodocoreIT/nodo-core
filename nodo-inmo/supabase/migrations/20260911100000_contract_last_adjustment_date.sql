-- Track when the last rent adjustment (IPC/ICL) was actually applied to a
-- contract, so the "Aplicar aumento por IPC" flow can compute the cumulative
-- index % since that date. Defaults to start_date (the contract's baseline)
-- for contracts that have never had an adjustment applied.

ALTER TABLE nodo_inmo.contracts
  ADD COLUMN last_adjustment_date date;

-- 1. Backfill existing contracts
UPDATE nodo_inmo.contracts
SET last_adjustment_date = start_date
WHERE last_adjustment_date IS NULL
  AND start_date IS NOT NULL;

-- 2. Create trigger function to auto-set it on new contracts
CREATE OR REPLACE FUNCTION nodo_inmo.handle_contract_last_adjustment_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_adjustment_date IS NULL AND NEW.start_date IS NOT NULL THEN
    NEW.last_adjustment_date := NEW.start_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS set_contract_last_adjustment_date ON nodo_inmo.contracts;
CREATE TRIGGER set_contract_last_adjustment_date
  BEFORE INSERT ON nodo_inmo.contracts
  FOR EACH ROW
  EXECUTE FUNCTION nodo_inmo.handle_contract_last_adjustment_date();
