-- La réouverture reprend toujours la DERNIÈRE clôture de la caisse (même nom, même unité),
-- donc le solde cumulé de toutes les journées précédentes.
CREATE OR REPLACE FUNCTION public.reopen_cash_register(_session_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s public.cash_sessions; latest public.cash_sessions; new_id uuid; open_id uuid;
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
  SELECT * INTO latest FROM public.cash_sessions
    WHERE unit_id = s.unit_id AND user_id = s.user_id AND status = 'closed' AND lower(coalesce(name,'')) = lower(coalesce(s.name,''))
    ORDER BY coalesce(closed_at, opened_at) DESC LIMIT 1;
  IF latest.id IS NULL THEN latest := s; END IF;
  INSERT INTO public.cash_sessions (user_id, unit_id, opened_by, opening_amount, name, cashier_ids, status)
  VALUES (latest.user_id, latest.unit_id, auth.uid(), COALESCE(latest.counted_amount, latest.expected_amount, 0), latest.name, latest.cashier_ids, 'open')
  RETURNING id INTO new_id;
  RETURN new_id;
END $function$;
