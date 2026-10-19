CREATE TABLE IF NOT EXISTS public.accounting_manual_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  unit_id text NOT NULL,
  date date NOT NULL,
  journal text NOT NULL DEFAULT 'OD' CHECK (journal IN ('AN','OD','CL')),
  label text NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.accounting_entry_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  unit_id text NOT NULL,
  entry_id text NOT NULL,
  account text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('lettrage','rapprochement')),
  code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, entry_id, account, kind)
);
CREATE TABLE IF NOT EXISTS public.accounting_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  unit_id text NOT NULL,
  fiscal_year integer NOT NULL,
  result numeric NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, fiscal_year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_manual_entries, public.accounting_entry_marks, public.accounting_closures TO authenticated;
GRANT ALL ON public.accounting_manual_entries, public.accounting_entry_marks, public.accounting_closures TO service_role;
ALTER TABLE public.accounting_manual_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entry_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manual entries access" ON public.accounting_manual_entries FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id))
  WITH CHECK (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));
CREATE POLICY "entry marks access" ON public.accounting_entry_marks FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id))
  WITH CHECK (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));
CREATE POLICY "closures access" ON public.accounting_closures FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id))
  WITH CHECK (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));