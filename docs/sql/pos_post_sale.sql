-- Encaissement + sortie de stock en une seule opération (idempotent par vente)
CREATE OR REPLACE FUNCTION public.pos_post_sale(_sale_id uuid, _session_id uuid, _stock jsonb)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE s public.sales; cs public.cash_sessions; it jsonb; st public.feed_stocks; q numeric; reason text;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = _sale_id;
  IF s.id IS NULL OR NOT (s.user_id = auth.uid() OR public.team_member_has_unit_access(s.user_id, s.unit_id)) THEN
    RAISE EXCEPTION 'Vente inaccessible'; END IF;
  IF s.status = 'cancelled' THEN RAISE EXCEPTION 'Cette vente est annulée'; END IF;
  SELECT * INTO cs FROM public.cash_sessions WHERE id = _session_id FOR UPDATE;
  IF cs.id IS NULL OR cs.unit_id <> s.unit_id THEN RAISE EXCEPTION 'Caisse introuvable pour cette unité'; END IF;
  IF cs.status <> 'open' THEN RAISE EXCEPTION 'Cette caisse est fermée'; END IF;
  -- Verrou par vente : évite deux encaissements simultanés
  PERFORM pg_advisory_xact_lock(hashtext('pos_post_sale:' || _sale_id::text));
  IF EXISTS (SELECT 1 FROM public.cash_movements WHERE sale_id = _sale_id AND type = 'sale') THEN RETURN; END IF;
  INSERT INTO public.cash_movements(session_id, user_id, unit_id, type, amount, payment_method, sale_id, label)
  VALUES (cs.id, s.user_id, s.unit_id, 'sale', s.total_amount, COALESCE(s.payment_method, 'Espèces'), s.id,
          COALESCE(s.document_number, s.client_name));
  reason := 'Vente en caisse ' || s.id::text;
  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(_stock, '[]'::jsonb)) LOOP
    q := (it->>'quantity')::numeric;
    IF q IS NULL OR q <= 0 THEN CONTINUE; END IF;
    SELECT * INTO st FROM public.feed_stocks WHERE id = (it->>'stock_id')::uuid FOR UPDATE;
    IF st.id IS NULL OR st.unit_id::text <> s.unit_id OR st.stock_purpose <> 'commercial' THEN
      RAISE EXCEPTION 'Article de stock invalide pour cette vente'; END IF;
    IF st.quantity < q THEN RAISE EXCEPTION 'Stock insuffisant pour %', COALESCE(st.custom_name, st.feed_type); END IF;
    UPDATE public.feed_stocks SET quantity = quantity - q WHERE id = st.id;
    INSERT INTO public.stock_movements(user_id, unit_id, stock_id, type, quantity, quantity_after, reason)
    VALUES (st.user_id, s.unit_id, st.id, 'out', q, st.quantity - q, reason);
  END LOOP;
END $fn$;
GRANT EXECUTE ON FUNCTION public.pos_post_sale(uuid, uuid, jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
