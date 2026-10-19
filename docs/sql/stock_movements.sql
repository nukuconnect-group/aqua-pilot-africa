-- AquaPilote — Historique des mouvements de stock (à exécuter une fois sur le serveur)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id text NOT NULL,
  stock_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('in','out','adjust')),
  quantity numeric NOT NULL,
  quantity_after numeric NOT NULL,
  reason text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements read" ON public.stock_movements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));
CREATE POLICY "stock_movements insert" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));
