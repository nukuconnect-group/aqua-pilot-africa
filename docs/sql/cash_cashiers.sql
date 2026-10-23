-- Caissiers attribués par l'administrateur à chaque caisse
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS cashier_ids uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.is_cashier_of(_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cash_sessions cs
    WHERE cs.id = _session_id
      AND (cs.user_id = auth.uid()
           OR (auth.uid() = ANY (cs.cashier_ids) AND public.team_member_has_unit_access(cs.user_id, cs.unit_id)))
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_cashier_of(uuid) TO authenticated;

-- Seul l'administrateur (propriétaire du compte) modifie la liste des caissiers
CREATE OR REPLACE FUNCTION public.guard_cashier_ids()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.cashier_ids IS DISTINCT FROM OLD.cashier_ids AND OLD.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Seul l’administrateur peut attribuer les caissiers';
  END IF;
  IF NEW.user_id <> OLD.user_id OR NEW.unit_id <> OLD.unit_id THEN
    RAISE EXCEPTION 'La caisse ne peut pas changer d’unité';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_cashier_ids ON public.cash_sessions;
CREATE TRIGGER guard_cashier_ids BEFORE UPDATE ON public.cash_sessions FOR EACH ROW EXECUTE FUNCTION public.guard_cashier_ids();

DROP POLICY IF EXISTS "cash_sessions owner or team" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions owner" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions cashier read" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions cashier update" ON public.cash_sessions;
CREATE POLICY "cash_sessions owner" ON public.cash_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "cash_sessions cashier read" ON public.cash_sessions FOR SELECT TO authenticated
  USING (auth.uid() = ANY (cashier_ids) AND public.team_member_has_unit_access(user_id, unit_id));
CREATE POLICY "cash_sessions cashier update" ON public.cash_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = ANY (cashier_ids) AND public.team_member_has_unit_access(user_id, unit_id))
  WITH CHECK (auth.uid() = ANY (cashier_ids) AND public.team_member_has_unit_access(user_id, unit_id));

DROP POLICY IF EXISTS "cash_movements owner or team insert" ON public.cash_movements;
DROP POLICY IF EXISTS "cash_movements owner or team read" ON public.cash_movements;
DROP POLICY IF EXISTS "cash_movements cashier insert" ON public.cash_movements;
DROP POLICY IF EXISTS "cash_movements cashier read" ON public.cash_movements;
CREATE POLICY "cash_movements cashier insert" ON public.cash_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_cashier_of(session_id));
CREATE POLICY "cash_movements cashier read" ON public.cash_movements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_cashier_of(session_id));

NOTIFY pgrst, 'reload schema';
