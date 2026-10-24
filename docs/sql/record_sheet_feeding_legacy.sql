-- Nourrissage depuis une fiche, en UNE transaction serveur, pour la base de l'application
-- (schéma historique : feeding_sheets.infrastructure_id, feeding_records.notes, stock_movements, cycle_infrastructures).
-- Tout réussit ou rien n'est écrit : prélèvement, retour du non-servi, relevé, mortalité.
-- Idempotent : une même référence de saisie (_request_id) n'est jamais enregistrée deux fois.
-- Signature identique à l'appel de src/lib/recordSheetFeeding.ts.

CREATE OR REPLACE FUNCTION public.record_sheet_feeding(
  _sheet_id uuid, _request_id text, _date date, _time text, _period text,
  _lines jsonb, _behavior text, _notes text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER            -- les règles d'accès (RLS) de l'utilisateur s'appliquent
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  sh public.feeding_sheets;
  ln jsonb;
  v_infra text; v_infra_name text;
  v_taken numeric; v_served numeric; v_returned numeric; v_mort int;
  v_ref text := '[ref:' || _request_id || ']';
  v_left_take numeric; v_left_cons numeric;
  st record; v_take numeric; v_cons numeric; v_avail numeric;
  ci record; b record; v_lost int; v_rem int;
  v_label text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501'; END IF;
  IF _period NOT IN ('matin','midi','soir') THEN RAISE EXCEPTION 'Période invalide'; END IF;

  SELECT * INTO sh FROM public.feeding_sheets WHERE id = _sheet_id;
  IF sh.id IS NULL THEN RAISE EXCEPTION 'Fiche inaccessible'; END IF;

  -- Verrou par saisie puis contrôle de doublon.
  PERFORM pg_advisory_xact_lock(hashtext('sheet_feeding:' || _request_id));
  IF EXISTS (SELECT 1 FROM public.feeding_records WHERE unit_id::text = sh.unit_id::text AND notes LIKE '%' || v_ref || '%') THEN
    RETURN jsonb_build_object('status','already_saved');
  END IF;

  IF jsonb_array_length(COALESCE(_lines,'[]'::jsonb)) <> 1 THEN RAISE EXCEPTION 'Une fiche nourrit une seule infrastructure'; END IF;
  ln := _lines->0;
  v_infra := ln->>'infrastructure_id';
  v_taken := COALESCE((ln->>'taken')::numeric,0);
  v_served := COALESCE((ln->>'served')::numeric,0);
  v_mort := COALESCE((ln->>'mortality')::int,0);
  v_returned := v_taken - v_served;
  IF v_taken < 0 OR v_served < 0 OR v_mort < 0 OR v_served > v_taken THEN RAISE EXCEPTION 'Quantités invalides : la quantité servie ne peut dépasser la quantité prélevée'; END IF;

  SELECT name INTO v_infra_name FROM public.unit_infrastructures
   WHERE id::text = v_infra AND unit_id::text = sh.unit_id::text;
  IF v_infra_name IS NULL THEN RAISE EXCEPTION 'Infrastructure non rattachée à cette unité'; END IF;
  IF sh.infrastructure_id IS NOT NULL AND sh.infrastructure_id::text <> v_infra THEN RAISE EXCEPTION 'Cette infrastructure n''est pas celle de la fiche'; END IF;
  IF sh.infrastructure_id IS NULL THEN UPDATE public.feeding_sheets SET infrastructure_id = v_infra::uuid WHERE id = sh.id; END IF;

  v_label := _period || ' ' || _time || ' — ' || sh.title || ' — ' || v_infra_name;

  -- Prélèvement FIFO dans le stock de production de l'unité, lignes verrouillées.
  v_left_take := v_taken; v_left_cons := v_served;
  FOR st IN
    SELECT id, quantity FROM public.feed_stocks
     WHERE unit_id::text = sh.unit_id::text AND quantity > 0 AND unit = sh.unit
       AND COALESCE(stock_purpose,'production') = 'production'
       AND (lower(trim(feed_type)) = lower(trim(sh.feed_type)) OR lower(trim(COALESCE(custom_name,''))) = lower(trim(sh.feed_type)))
     ORDER BY created_at
     FOR UPDATE
  LOOP
    EXIT WHEN v_left_take <= 0;
    v_avail := st.quantity;
    v_take := LEAST(v_left_take, v_avail);
    v_cons := LEAST(v_left_cons, v_take);
    UPDATE public.feed_stocks SET quantity = v_avail - v_cons WHERE id = st.id;
    INSERT INTO public.stock_movements(user_id, unit_id, stock_id, type, quantity, quantity_after, reason)
      VALUES (v_uid, sh.unit_id, st.id, 'out', v_take, v_avail - v_take, 'Prélèvement nourrissage ' || v_label || ' ' || v_ref);
    IF v_take - v_cons > 0 THEN
      INSERT INTO public.stock_movements(user_id, unit_id, stock_id, type, quantity, quantity_after, reason)
        VALUES (v_uid, sh.unit_id, st.id, 'in', v_take - v_cons, v_avail - v_cons, 'Retour non servi ' || v_label || ' ' || v_ref);
    END IF;
    v_left_take := v_left_take - v_take; v_left_cons := v_left_cons - v_cons;
  END LOOP;
  IF v_left_take > 0 THEN RAISE EXCEPTION 'Stock de production insuffisant pour « % » : il manque % %', sh.feed_type, v_left_take, sh.unit; END IF;

  INSERT INTO public.feeding_records(user_id, unit_id, infrastructure_id, date, time, feed_type, quantity, session_type, feeder_name,
     prescribed_quantity, actual_quantity, remaining_quantity, mortality, behavior, notes)
  VALUES (v_uid, sh.unit_id, v_infra::uuid, _date, _time::time, sh.feed_type, v_served, _period, sh.responsible_name,
     COALESCE((ln->>'prescribed')::numeric, sh.quantity), v_served, v_returned, v_mort, _behavior,
     concat_ws(' · ', 'Prélevé ' || v_taken || ' ' || sh.unit, NULLIF(trim(COALESCE(_notes,'')),''), v_ref));

  -- Mortalité appliquée aux lots / effectifs des cycles actifs de cette infrastructure.
  v_rem := v_mort;
  FOR ci IN
    SELECT c.* FROM public.cycle_infrastructures c JOIN public.production_cycles p ON p.id = c.cycle_id
     WHERE p.unit_id::text = sh.unit_id::text AND p.status = 'active'
       AND lower(trim(c.infrastructure_name)) = lower(trim(v_infra_name))
     FOR UPDATE OF c
  LOOP
    EXIT WHEN v_rem <= 0;
    v_lost := LEAST(v_rem, GREATEST(0, COALESCE(ci.current_quantity,0))::int);
    IF ci.livestock_batch_id IS NOT NULL THEN
      SELECT id, quantity, status INTO b FROM public.livestock_batches WHERE id = ci.livestock_batch_id FOR UPDATE;
      IF b.id IS NOT NULL AND b.status NOT IN ('sold','harvested') THEN
        v_lost := LEAST(v_rem, GREATEST(0, COALESCE(b.quantity,0))::int);
        UPDATE public.livestock_batches SET quantity = GREATEST(0, quantity - v_lost) WHERE id = b.id;
      END IF;
    END IF;
    IF v_lost > 0 THEN UPDATE public.cycle_infrastructures SET current_quantity = GREATEST(0, COALESCE(current_quantity,0) - v_lost) WHERE id = ci.id; END IF;
    v_rem := v_rem - v_lost;
  END LOOP;

  RETURN jsonb_build_object('status','ok','returned',v_returned);
END $$;

REVOKE ALL ON FUNCTION public.record_sheet_feeding(uuid,text,date,text,text,jsonb,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sheet_feeding(uuid,text,date,text,text,jsonb,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
