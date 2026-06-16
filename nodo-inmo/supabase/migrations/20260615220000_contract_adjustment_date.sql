-- Migration to automatically set next_adjustment_date on contracts

-- 1. Backfill existing contracts where next_adjustment_date is null
UPDATE nodo_inmo.contracts
SET next_adjustment_date = (start_date + (adjustment_period_months || ' months')::interval)::date
WHERE next_adjustment_date IS NULL
  AND start_date IS NOT NULL
  AND adjustment_period_months IS NOT NULL;

-- 2. Create trigger function to auto-set it on new contracts
CREATE OR REPLACE FUNCTION nodo_inmo.handle_contract_next_adjustment_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.next_adjustment_date IS NULL AND NEW.start_date IS NOT NULL AND NEW.adjustment_period_months IS NOT NULL THEN
    NEW.next_adjustment_date := (NEW.start_date + (NEW.adjustment_period_months || ' months')::interval)::date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS set_contract_next_adjustment_date ON nodo_inmo.contracts;
CREATE TRIGGER set_contract_next_adjustment_date
  BEFORE INSERT ON nodo_inmo.contracts
  FOR EACH ROW
  EXECUTE FUNCTION nodo_inmo.handle_contract_next_adjustment_date();
