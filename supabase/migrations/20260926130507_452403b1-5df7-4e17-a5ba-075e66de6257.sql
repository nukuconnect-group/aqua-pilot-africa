CREATE TABLE public.cycle_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  unit_id text NOT NULL,
  cycle_id uuid NOT NULL,
  lines jsonb NOT NULL DEFAULT '{}'::jsonb,
  initial_cash numeric NOT NULL DEFAULT 0,
  discount_rate numeric NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cycle_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cycle_budgets TO authenticated;
GRANT ALL ON public.cycle_budgets TO service_role;
ALTER TABLE public.cycle_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own cycle budgets" ON public.cycle_budgets FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_team_member_of(user_id))
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_cycle_budgets_updated_at BEFORE UPDATE ON public.cycle_budgets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();