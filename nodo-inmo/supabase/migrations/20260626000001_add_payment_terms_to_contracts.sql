ALTER TABLE nodo_inmo.contracts
  ADD COLUMN IF NOT EXISTS payment_due_day integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS daily_interest_rate numeric(5,2) DEFAULT 0;
