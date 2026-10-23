-- Rouvre une caisse clôturée : nouvelle session avec le même nom, la même unité,
-- les mêmes caissiers et le solde compté à la clôture. Autorisé au propriétaire
-- et aux caissiers encore affectés à cette caisse.
CREATE OR REPLACE FUNCTION public.reopen_cash_register(_session_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.cash_sessions; new_id uuid; open_id uuid;
BEGIN
  SELECT * INTO s FROM public.cash_sessions WHERE id = _session_id;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Caisse introuvable'; END IF;
  IF NOT (s.user_id = auth.uid() OR (auth.uid() = ANY (s.cashier_ids) AND public.team_member_has_unit_access(s.user_id, s.unit_id))) THEN
    RAISE EXCEPTION 'Vous n’êtes pas affecté(e) à cette caisse';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(s.unit_id || lower(coalesce(s.name, ''))));
  SELECT id INTO open_id FROM public.cash_sessions
    WHERE unit_id = s.unit_id AND user_id = s.user_id AND status = 'open' AND lower(coalesce(name,'')) = lower(coalesce(s.name,'')) LIMIT 1;
  IF open_id IS NOT NULL THEN RETURN open_id; END IF;
  INSERT INTO public.cash_sessions (user_id, unit_id, opened_by, opening_amount, name, cashier_ids, status)
  VALUES (s.user_id, s.unit_id, auth.uid(), COALESCE(s.counted_amount, s.expected_amount, 0), s.name, s.cashier_ids, 'open')
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.reopen_cash_register(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reopen_cash_register(uuid) TO authenticated;
