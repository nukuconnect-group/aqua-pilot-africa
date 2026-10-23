-- Transfert de fonds entre comptes de deux unités différentes du même propriétaire.
-- Deux mouvements atomiques passant par le compte de liaison 185 (SYSCOHADA) :
--   unité source      : débit 185 / crédit compte source
--   unité destination : débit compte destination / crédit 185
CREATE OR REPLACE FUNCTION public.transfer_between_units(_request_id uuid, _source_id uuid, _destination_id uuid, _amount numeric, _date date, _label text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE s public.treasury_accounts; d public.treasury_accounts; ref text;
BEGIN
 IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
 IF length(trim(coalesce(_label,''))) = 0 THEN RAISE EXCEPTION 'Libellé obligatoire'; END IF;
 SELECT * INTO s FROM public.treasury_accounts WHERE id = _source_id;
 SELECT * INTO d FROM public.treasury_accounts WHERE id = _destination_id;
 IF s.id IS NULL OR d.id IS NULL OR s.id = d.id THEN RAISE EXCEPTION 'Comptes invalides'; END IF;
 IF s.user_id <> d.user_id OR s.user_id <> auth.uid() THEN RAISE EXCEPTION 'Seul le propriétaire peut transférer entre ses unités'; END IF;
 IF s.currency <> d.currency THEN RAISE EXCEPTION 'Les comptes doivent utiliser la même devise'; END IF;
 IF EXISTS (SELECT 1 FROM public.treasury_movements WHERE request_id = _request_id) THEN RETURN; END IF;
 ref := ' [inter-unités ' || _request_id::text || ']';
 INSERT INTO public.treasury_movements(user_id,unit_id,request_id,kind,source_id,amount,date,label,journal,lines)
 VALUES (s.user_id, s.unit_id, _request_id, 'payment', s.id, _amount, _date, 'Transfert sortant — ' || trim(_label) || ref, 'CA',
   jsonb_build_array(jsonb_build_object('account','185'), jsonb_build_object('account', s.account_code)));
 INSERT INTO public.treasury_movements(user_id,unit_id,request_id,kind,destination_id,amount,date,label,journal,lines)
 VALUES (d.user_id, d.unit_id, gen_random_uuid(), 'receipt', d.id, _amount, _date, 'Transfert entrant — ' || trim(_label) || ref, 'CA',
   jsonb_build_array(jsonb_build_object('account', d.account_code), jsonb_build_object('account','185')));
END $$;
REVOKE ALL ON FUNCTION public.transfer_between_units(uuid,uuid,uuid,numeric,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_between_units(uuid,uuid,uuid,numeric,date,text) TO authenticated;
