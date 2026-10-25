-- Historical application backend only. Additive: existing unit histories remain unchanged.
ALTER TABLE public.treasury_accounts ADD COLUMN IF NOT EXISTS unit_ids text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.treasury_accounts ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS treasury_account_id uuid REFERENCES public.treasury_accounts(id);

CREATE OR REPLACE FUNCTION public.treasury_account_covers(_account public.treasury_accounts, _unit text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT _account.unit_id = _unit OR _unit = ANY(_account.unit_ids)
$$;

CREATE OR REPLACE FUNCTION public.guard_treasury_unit_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u text;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.unit_ids IS NOT DISTINCT FROM OLD.unit_ids THEN RETURN NEW; END IF;
 IF cardinality(NEW.unit_ids) > 0 AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'Seul le propriétaire peut rattacher plusieurs unités'; END IF;
 FOREACH u IN ARRAY NEW.unit_ids LOOP
   IF NOT EXISTS (SELECT 1 FROM public.production_units WHERE id::text=u AND user_id=NEW.user_id) THEN
     RAISE EXCEPTION 'Unité rattachée inaccessible'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER guard_treasury_unit_links BEFORE INSERT OR UPDATE ON public.treasury_accounts
FOR EACH ROW EXECUTE FUNCTION public.guard_treasury_unit_links();

CREATE OR REPLACE FUNCTION public.guard_cashier_ids()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.treasury_accounts;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.user_id <> OLD.user_id OR NEW.unit_id <> OLD.unit_id THEN RAISE EXCEPTION 'La caisse ne peut pas changer d’unité'; END IF;
   IF (NEW.cashier_ids IS DISTINCT FROM OLD.cashier_ids OR NEW.treasury_account_id IS DISTINCT FROM OLD.treasury_account_id)
      AND OLD.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Seul le propriétaire peut modifier les rattachements'; END IF;
 END IF;
 IF NEW.treasury_account_id IS NOT NULL THEN
   SELECT * INTO a FROM public.treasury_accounts WHERE id=NEW.treasury_account_id;
   IF a.id IS NULL OR a.user_id <> NEW.user_id OR a.kind <> 'cash' OR a.archived_at IS NOT NULL
      OR NOT public.treasury_account_covers(a,NEW.unit_id) THEN RAISE EXCEPTION 'Compte de caisse inaccessible pour cette unité'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER guard_cashier_ids BEFORE INSERT OR UPDATE ON public.cash_sessions
FOR EACH ROW EXECUTE FUNCTION public.guard_cashier_ids();

CREATE OR REPLACE FUNCTION public.create_linked_cash_register(_unit_ids text[], _name text, _opening numeric, _account_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u text; a public.treasury_accounts; first_id uuid; new_id uuid;
BEGIN
 IF auth.uid() IS NULL OR cardinality(_unit_ids) IS NULL OR cardinality(_unit_ids)=0 OR length(trim(_name))=0
    OR _opening IS NULL OR _opening<0 THEN RAISE EXCEPTION 'Unités, nom et fond de caisse obligatoires'; END IF;
 IF cardinality(_unit_ids)>1 AND _opening>0 THEN RAISE EXCEPTION 'Pour plusieurs unités, initialisez le fond dans chaque caisse séparément'; END IF;
 FOREACH u IN ARRAY _unit_ids LOOP
   IF NOT EXISTS (SELECT 1 FROM public.production_units WHERE id::text=u AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Unité inaccessible'; END IF;
 END LOOP;
 IF _account_id IS NOT NULL THEN
   SELECT * INTO a FROM public.treasury_accounts WHERE id=_account_id FOR UPDATE;
   IF a.id IS NULL OR a.user_id<>auth.uid() OR a.kind<>'cash' OR a.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Compte de caisse inaccessible'; END IF;
   UPDATE public.treasury_accounts SET unit_ids=ARRAY(SELECT DISTINCT unnest(a.unit_ids || _unit_ids || ARRAY[a.unit_id])) WHERE id=a.id;
 END IF;
 FOR u IN SELECT DISTINCT unnest(_unit_ids) LOOP
   INSERT INTO public.cash_sessions(user_id,unit_id,name,opening_amount,opened_by,treasury_account_id)
   VALUES(auth.uid(),u,trim(_name),_opening,auth.uid(),_account_id) RETURNING id INTO new_id;
   IF first_id IS NULL THEN first_id:=new_id; END IF;
 END LOOP;
 RETURN first_id;
END $$;
REVOKE ALL ON FUNCTION public.create_linked_cash_register(text[],text,numeric,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_linked_cash_register(text[],text,numeric,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_linked_treasury_account(_unit_ids text[],_name text,_kind text,_code text,_currency text,_opening numeric,_counterpart text,_date date)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a uuid;
BEGIN
 IF cardinality(_unit_ids) IS NULL OR cardinality(_unit_ids)=0 THEN RAISE EXCEPTION 'Choisissez au moins une unité'; END IF;
 a:=public.create_treasury_account(_unit_ids[1],_name,_kind,_code,_currency,_opening,_counterpart,_date);
 UPDATE public.treasury_accounts SET unit_ids=_unit_ids WHERE id=a;
 RETURN a;
END $$;
GRANT UPDATE(unit_ids) ON public.treasury_accounts TO authenticated;
CREATE POLICY treasury_accounts_owner_links ON public.treasury_accounts FOR UPDATE TO authenticated
 USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS treasury_accounts_read ON public.treasury_accounts;
CREATE POLICY treasury_accounts_read ON public.treasury_accounts FOR SELECT TO authenticated
 USING(user_id=auth.uid() OR public.team_member_has_unit_access(user_id,unit_id) OR EXISTS
   (SELECT 1 FROM unnest(unit_ids) u WHERE public.team_member_has_unit_access(user_id,u)));
REVOKE ALL ON FUNCTION public.create_linked_treasury_account(text[],text,text,text,text,numeric,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_linked_treasury_account(text[],text,text,text,text,numeric,text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_treasury_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.treasury_accounts; d public.treasury_accounts; bal numeric; debit_code text; credit_code text;
BEGIN
 PERFORM 1 FROM public.treasury_accounts WHERE id IN(NEW.source_id,NEW.destination_id) ORDER BY id FOR UPDATE;
 IF NEW.source_id IS NOT NULL THEN
   SELECT * INTO s FROM public.treasury_accounts WHERE id=NEW.source_id;
   IF s.id IS NULL OR NOT public.treasury_account_covers(s,NEW.unit_id) OR s.user_id<>NEW.user_id THEN RAISE EXCEPTION 'Compte source inaccessible pour cette unité'; END IF;
   SELECT COALESCE(sum(CASE WHEN destination_id=s.id THEN amount ELSE -amount END),0) INTO bal FROM public.treasury_movements WHERE source_id=s.id OR destination_id=s.id;
   IF NEW.amount>bal THEN RAISE EXCEPTION 'Solde insuffisant sur le compte source'; END IF;
 END IF;
 IF NEW.destination_id IS NOT NULL THEN
   SELECT * INTO d FROM public.treasury_accounts WHERE id=NEW.destination_id;
   IF d.id IS NULL OR NOT public.treasury_account_covers(d,NEW.unit_id) OR d.user_id<>NEW.user_id THEN RAISE EXCEPTION 'Compte destinataire inaccessible pour cette unité'; END IF;
 END IF;
 IF NEW.kind='transfer' AND s.currency<>d.currency THEN RAISE EXCEPTION 'Les comptes doivent utiliser la même devise'; END IF;
 IF NEW.kind='opening' AND EXISTS(SELECT 1 FROM public.treasury_movements WHERE source_id=d.id OR destination_id=d.id) THEN RAISE EXCEPTION 'Les fonds initiaux ne peuvent être enregistrés qu’avant tout mouvement'; END IF;
 debit_code:=NEW.lines->0->>'account'; credit_code:=NEW.lines->1->>'account';
 IF NEW.kind IN('opening','receipt','transfer') THEN debit_code:=d.account_code; END IF;
 IF NEW.kind IN('payment','transfer') THEN credit_code:=s.account_code; END IF;
 IF debit_code IS NULL OR credit_code IS NULL OR debit_code !~ '^[1-8][0-9]{2,7}$' OR credit_code !~ '^[1-8][0-9]{2,7}$' OR debit_code=credit_code THEN RAISE EXCEPTION 'Contrepartie comptable invalide'; END IF;
 IF NEW.kind<>'transfer' AND (CASE WHEN NEW.kind='payment' THEN debit_code ELSE credit_code END) ~ '^5' THEN RAISE EXCEPTION 'Utilisez un transfert pour déplacer des fonds entre comptes'; END IF;
 NEW.lines:=jsonb_build_array(jsonb_build_object('account',debit_code,'debit',NEW.amount,'credit',0),jsonb_build_object('account',credit_code,'debit',0,'credit',NEW.amount));
 NEW.journal:=CASE WHEN NEW.kind='opening' THEN 'AN' WHEN COALESCE(s.kind,d.kind)='cash' THEN 'CA' ELSE 'BQ' END;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.post_sale_to_linked_treasury(_sale_id uuid,_session_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.sales; cs public.cash_sessions; a public.treasury_accounts; bank boolean; existing uuid;
BEGIN
 SELECT * INTO s FROM public.sales WHERE id=_sale_id;
 IF s.id IS NULL OR auth.uid() IS NULL OR NOT(s.user_id=auth.uid() OR public.team_member_has_unit_access(s.user_id,s.unit_id)) THEN RAISE EXCEPTION 'Vente inaccessible'; END IF;
 IF s.status='cancelled' OR s.status NOT IN('paid','confirmed','delivered') OR s.total_amount<=0 THEN RAISE EXCEPTION 'Vente non encaissée'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('treasury-sale:'||s.id::text));
 SELECT id INTO existing FROM public.treasury_movements WHERE request_id=s.id;
 IF existing IS NOT NULL THEN RETURN existing; END IF;
 IF _session_id IS NOT NULL THEN
   SELECT * INTO cs FROM public.cash_sessions WHERE id=_session_id;
   IF cs.id IS NULL OR cs.unit_id<>s.unit_id OR cs.user_id<>s.user_id OR NOT public.is_cashier_of(cs.id) THEN RAISE EXCEPTION 'Caisse inaccessible'; END IF;
 ELSE
   SELECT c.* INTO cs FROM public.cash_sessions c JOIN public.cash_movements m ON m.session_id=c.id
   WHERE m.sale_id=s.id AND m.type='sale' LIMIT 1;
 END IF;
 bank:=COALESCE(s.payment_method,'') ~* 'virement|carte|ch[eè]que|banc';
 IF NOT bank AND cs.treasury_account_id IS NOT NULL THEN
   SELECT * INTO a FROM public.treasury_accounts WHERE id=cs.treasury_account_id;
   IF a.archived_at IS NOT NULL OR a.kind<>'cash' OR a.user_id<>s.user_id OR NOT public.treasury_account_covers(a,s.unit_id) THEN RAISE EXCEPTION 'Rattachement de trésorerie invalide'; END IF;
 ELSE
   SELECT * INTO a FROM public.treasury_accounts t WHERE t.user_id=s.user_id AND public.treasury_account_covers(t,s.unit_id)
     AND t.archived_at IS NULL AND t.kind=CASE WHEN bank THEN 'bank' ELSE 'cash' END
     AND (bank OR lower(trim(t.name))=lower(trim(cs.name)) OR lower(t.name) LIKE '%vente%' OR
       (SELECT count(*) FROM public.treasury_accounts x WHERE x.user_id=s.user_id AND public.treasury_account_covers(x,s.unit_id) AND x.kind='cash' AND x.archived_at IS NULL)=1)
     ORDER BY (lower(trim(t.name))=lower(trim(cs.name))) DESC NULLS LAST,(lower(t.name) LIKE '%vente%') DESC,t.created_at LIMIT 1;
 END IF;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Aucun compte de trésorerie rattaché pour ce paiement'; END IF;
 INSERT INTO public.treasury_movements(request_id,user_id,unit_id,kind,destination_id,amount,date,label,journal,lines)
 VALUES(s.id,s.user_id,s.unit_id,'receipt',a.id,s.total_amount,s.date,
   'Vente '||COALESCE(s.document_number,s.client_name,'')||' · '||s.id::text,CASE WHEN bank THEN 'BQ' ELSE 'CA' END,
   jsonb_build_array(jsonb_build_object('account',a.account_code),jsonb_build_object('account','411'))) RETURNING id INTO existing;
 RETURN existing;
END $$;
REVOKE ALL ON FUNCTION public.post_sale_to_linked_treasury(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.post_sale_to_linked_treasury(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.guard_cashier_ids(),public.guard_treasury_unit_links(),public.validate_treasury_movement() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';