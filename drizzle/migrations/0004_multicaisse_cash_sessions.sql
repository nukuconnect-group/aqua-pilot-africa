ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS name text;
DROP INDEX IF EXISTS public.cash_sessions_one_open_per_unit;
CREATE INDEX IF NOT EXISTS cash_sessions_unit_open ON public.cash_sessions (unit_id) WHERE status = 'open';