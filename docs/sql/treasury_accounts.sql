CREATE TABLE public.treasury_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), unit_id text NOT NULL,
 name text NOT NULL, kind text NOT NULL CHECK (kind IN ('cash','bank')), account_code text NOT NULL,
 currency text NOT NULL DEFAULT 'XOF', created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (length(trim(name)) > 0), CHECK ((kind = 'cash' AND account_code ~ '^57[0-9]+$') OR (kind = 'bank' AND account_code ~ '^52[0-9]+$')),
 UNIQUE (user_id,unit_id,account_code)
);
GRANT SELECT, INSERT ON public.treasury_accounts TO authenticated;
GRANT ALL ON public.treasury_accounts TO service_role;
ALTER TABLE public.treasury_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_accounts_read ON public.treasury_accounts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.team_member_has_unit_access(user_id,unit_id));
CREATE POLICY treasury_accounts_insert ON public.treasury_accounts FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid() OR public.team_member_has_unit_access(user_id,unit_id)) AND EXISTS (SELECT 1 FROM public.production_units u WHERE u.id::text = unit_id AND u.user_id = treasury_accounts.user_id));
CREATE TABLE public.treasury_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), unit_id text NOT NULL,
 request_id uuid NOT NULL UNIQUE, kind text NOT NULL CHECK (kind IN ('opening','receipt','payment','transfer')),
 source_id uuid REFERENCES public.treasury_accounts(id), destination_id uuid REFERENCES public.treasury_accounts(id),
 amount numeric(18,2) NOT NULL CHECK (amount > 0), date date NOT NULL, label text NOT NULL,
 journal text NOT NULL CHECK (journal IN ('AN','CA','BQ')), lines jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (length(trim(label)) > 0), CHECK ((kind IN ('opening','receipt') AND source_id IS NULL AND destination_id IS NOT NULL) OR (kind = 'payment' AND source_id IS NOT NULL AND destination_id IS NULL) OR (kind = 'transfer' AND source_id IS NOT NULL AND destination_id IS NOT NULL AND source_id <> destination_id))
);
GRANT SELECT, INSERT ON public.treasury_movements TO authenticated;
GRANT ALL ON public.treasury_movements TO service_role;
ALTER TABLE public.treasury_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_movements_read ON public.treasury_movements FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.team_member_has_unit_access(user_id,unit_id));
CREATE POLICY treasury_movements_insert ON public.treasury_movements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.team_member_has_unit_access(user_id,unit_id));
CREATE FUNCTION public.validate_treasury_movement() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.treasury_accounts; d public.treasury_accounts; bal numeric; debit_code text; credit_code text;
BEGIN
 PERFORM 1 FROM public.treasury_accounts WHERE id IN (NEW.source_id,NEW.destination_id) ORDER BY id FOR UPDATE;
 IF NEW.source_id IS NOT NULL THEN
  SELECT * INTO s FROM public.treasury_accounts WHERE id = NEW.source_id;
  IF s.id IS NULL OR s.unit_id <> NEW.unit_id OR s.user_id <> NEW.user_id THEN RAISE EXCEPTION 'Compte source inaccessible pour cette unité'; END IF;
  SELECT COALESCE(sum(CASE WHEN destination_id=s.id THEN amount ELSE -amount END),0) INTO bal FROM public.treasury_movements WHERE source_id=s.id OR destination_id=s.id;
  IF NEW.amount > bal THEN RAISE EXCEPTION 'Solde insuffisant sur le compte source'; END IF;
 END IF;
 IF NEW.destination_id IS NOT NULL THEN
  SELECT * INTO d FROM public.treasury_accounts WHERE id = NEW.destination_id;
  IF d.id IS NULL OR d.unit_id <> NEW.unit_id OR d.user_id <> NEW.user_id THEN RAISE EXCEPTION 'Compte destinataire inaccessible pour cette unité'; END IF;
 END IF;
 IF NEW.kind='transfer' AND s.currency<>d.currency THEN RAISE EXCEPTION 'Les comptes doivent utiliser la même devise'; END IF;
 IF NEW.kind='opening' AND EXISTS(SELECT 1 FROM public.treasury_movements WHERE source_id=d.id OR destination_id=d.id) THEN RAISE EXCEPTION 'Les fonds initiaux ne peuvent être enregistrés qu’avant tout mouvement'; END IF;
 debit_code := NEW.lines->0->>'account'; credit_code := NEW.lines->1->>'account';
 IF NEW.kind IN ('opening','receipt','transfer') THEN debit_code := d.account_code; END IF;
 IF NEW.kind IN ('payment','transfer') THEN credit_code := s.account_code; END IF;
 IF debit_code IS NULL OR credit_code IS NULL OR debit_code !~ '^[1-8][0-9]{2,7}$' OR credit_code !~ '^[1-8][0-9]{2,7}$' OR debit_code=credit_code THEN RAISE EXCEPTION 'Contrepartie comptable invalide'; END IF;
 IF NEW.kind<>'transfer' AND (CASE WHEN NEW.kind='payment' THEN debit_code ELSE credit_code END) ~ '^5' THEN RAISE EXCEPTION 'Utilisez un transfert pour déplacer des fonds entre comptes'; END IF;
 NEW.lines := jsonb_build_array(jsonb_build_object('account',debit_code,'debit',NEW.amount,'credit',0),jsonb_build_object('account',credit_code,'debit',0,'credit',NEW.amount));
 NEW.journal := CASE WHEN NEW.kind='opening' THEN 'AN' WHEN COALESCE(s.kind,d.kind)='cash' THEN 'CA' ELSE 'BQ' END;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_treasury_movement BEFORE INSERT ON public.treasury_movements FOR EACH ROW EXECUTE FUNCTION public.validate_treasury_movement();
CREATE FUNCTION public.create_treasury_account(_unit_id text,_name text,_kind text,_code text,_currency text,_opening numeric,_counterpart text,_date date) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE account_id uuid; owner_id uuid;
BEGIN
 SELECT user_id INTO owner_id FROM public.production_units WHERE id::text=_unit_id;
 IF owner_id IS NULL OR NOT (owner_id=auth.uid() OR public.team_member_has_unit_access(owner_id,_unit_id)) THEN RAISE EXCEPTION 'Unité inaccessible'; END IF;
 IF _opening IS NULL OR _opening<0 THEN RAISE EXCEPTION 'Fonds initiaux invalides'; END IF;
 INSERT INTO public.treasury_accounts(user_id,unit_id,name,kind,account_code,currency) VALUES(owner_id,_unit_id,trim(_name),_kind,_code,_currency) RETURNING id INTO account_id;
 IF _opening>0 THEN
  INSERT INTO public.treasury_movements(user_id,unit_id,request_id,kind,destination_id,amount,date,label,journal,lines) VALUES(owner_id,_unit_id,gen_random_uuid(),'opening',account_id,_opening,_date,'Fonds initiaux — '||trim(_name),'AN',jsonb_build_array(jsonb_build_object('account',_code),jsonb_build_object('account',_counterpart)));
 END IF;
 RETURN account_id;
END $$;
REVOKE ALL ON FUNCTION public.create_treasury_account(text,text,text,text,text,numeric,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_treasury_account(text,text,text,text,text,numeric,text,date) TO authenticated;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancelled_at timestamptz, ADD COLUMN IF NOT EXISTS cancellation_reason text, ADD COLUMN IF NOT EXISTS status_before_cancellation text;
CREATE FUNCTION public.guard_sale_cancellation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP='DELETE' AND OLD.status IN ('confirmed','delivered','paid','cancelled') THEN RAISE EXCEPTION 'Annulez la vente au lieu de supprimer son historique'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF OLD.status='cancelled' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Une vente annulée ne peut plus être modifiée'; END IF;
 IF NEW.status='cancelled' AND OLD.status<>'cancelled' THEN
  IF NEW.cancellation_reason IS NULL OR length(trim(NEW.cancellation_reason))=0 THEN RAISE EXCEPTION 'Indiquez le motif de l’annulation'; END IF;
  NEW.status_before_cancellation:=OLD.status; NEW.cancelled_at:=now();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_sale_cancellation BEFORE UPDATE OR DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.guard_sale_cancellation();
CREATE FUNCTION public.cancel_sale(_sale_id uuid,_reason text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE s public.sales; m public.cash_movements; session_uuid uuid;
BEGIN
 SELECT * INTO s FROM public.sales WHERE id=_sale_id FOR UPDATE;
 IF s.id IS NULL OR s.user_id<>auth.uid() THEN RAISE EXCEPTION 'Vente inaccessible'; END IF;
 IF s.status='cancelled' THEN RETURN; END IF;
 IF length(trim(COALESCE(_reason,'')))=0 THEN RAISE EXCEPTION 'Indiquez le motif de l’annulation'; END IF;
 FOR m IN SELECT * FROM public.cash_movements WHERE sale_id=s.id AND type='sale' LOOP
  SELECT id INTO session_uuid FROM public.cash_sessions WHERE unit_id=s.unit_id AND user_id=s.user_id AND status='open' ORDER BY opened_at DESC LIMIT 1;
  IF session_uuid IS NULL THEN RAISE EXCEPTION 'Ouvrez la caisse pour enregistrer le remboursement de cette vente'; END IF;
  INSERT INTO public.cash_movements(session_id,user_id,unit_id,type,amount,payment_method,sale_id,label) VALUES(session_uuid,s.user_id,s.unit_id,'cash_out',m.amount,m.payment_method,s.id,'Annulation — '||trim(_reason));
 END LOOP;
 UPDATE public.sales SET status='cancelled', cancellation_reason=trim(_reason) WHERE id=s.id;
END $$;
REVOKE ALL ON FUNCTION public.cancel_sale(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid,text) TO authenticated;
COMMENT ON TABLE public.treasury_movements IS 'Append-only unit-scoped treasury operations with server-validated balanced journal lines.';