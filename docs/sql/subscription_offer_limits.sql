-- Apply only to the historical application backend. Does not change purchased subscriptions.
CREATE OR REPLACE FUNCTION public.guard_unit_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE allowed text[]; s public.subscriptions; lim integer;
BEGIN
 IF public.has_role(auth.uid(),'admin'::public.app_role) THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('unit-limit:'||NEW.user_id::text));
 SELECT * INTO s FROM public.subscriptions WHERE user_id=NEW.user_id
 ORDER BY CASE WHEN status='active' AND start_date<=CURRENT_DATE AND end_date>=CURRENT_DATE THEN 0
 WHEN status='trial' AND start_date<=CURRENT_DATE AND end_date>=CURRENT_DATE THEN 1 ELSE 2 END,end_date DESC LIMIT 1;
 IF s.id IS NOT NULL THEN
   IF s.status NOT IN('active','trial') OR s.start_date>CURRENT_DATE OR s.end_date<CURRENT_DATE THEN
     IF TG_OP='UPDATE' AND NEW.type IS NOT DISTINCT FROM OLD.type AND NOT NEW.is_active THEN RETURN NEW; END IF;
     RAISE EXCEPTION 'Votre essai ou abonnement est terminé. Vos données sont conservées.' USING ERRCODE='42501';
   END IF;
   IF s.status='trial' THEN RETURN NEW; END IF;
   lim:=CASE WHEN s.plan IN('annual_basic','standard') THEN 1 WHEN s.plan IN('annual_pro','professional') THEN 3 ELSE NULL END;
   IF TG_OP='INSERT' AND lim IS NOT NULL AND (SELECT count(*) FROM public.production_units WHERE user_id=NEW.user_id)>=lim THEN
     RAISE EXCEPTION 'Votre abonnement couvre % unité(s). Choisissez une offre supérieure.',lim USING ERRCODE='42501'; END IF;
   IF s.plan IN('annual_enterprise','enterprise') THEN RETURN NEW; END IF;
 END IF;
 SELECT production_units INTO allowed FROM public.profiles WHERE id=NEW.user_id;
 IF cardinality(allowed)>0 AND NOT NEW.type=ANY(allowed) THEN RAISE EXCEPTION 'Type d’unité non couvert par votre abonnement' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER trg_guard_unit_type BEFORE INSERT OR UPDATE OF type,is_active ON public.production_units
FOR EACH ROW EXECUTE FUNCTION public.guard_unit_type();
REVOKE ALL ON FUNCTION public.guard_unit_type() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';