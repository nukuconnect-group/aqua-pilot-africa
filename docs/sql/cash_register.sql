-- AquaPilote — Caisse (sessions et mouvements)
-- À exécuter une fois dans l'éditeur SQL du serveur de l'application.

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id text NOT NULL,
  opened_by uuid NOT NULL DEFAULT auth.uid(),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_amount numeric NOT NULL DEFAULT 0,
  closed_at timestamptz,
  expected_amount numeric,
  counted_amount numeric,
  difference numeric,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_per_unit
  ON public.cash_sessions (user_id, unit_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  unit_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('sale','cash_in','cash_out')),
  amount numeric NOT NULL CHECK (amount >= 0),
  payment_method text NOT NULL DEFAULT 'Espèces',
  sale_id uuid,
  label text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.cash_sessions TO authenticated;
GRANT SELECT, INSERT ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_sessions, public.cash_movements TO service_role;

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_sessions owner or team" ON public.cash_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id))
  WITH CHECK (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));

CREATE POLICY "cash_movements owner or team read" ON public.cash_movements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));
CREATE POLICY "cash_movements owner or team insert" ON public.cash_movements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_sessions, public.cash_movements;
