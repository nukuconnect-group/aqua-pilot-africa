-- À déployer sur la base effectivement utilisée par l'application.
-- Une opération atomique : enregistrements, prélèvements, retours, mortalités et comptabilité.
ALTER TABLE public.feeding_records ADD COLUMN IF NOT EXISTS feeding_sheet_id uuid;
ALTER TABLE public.feeding_records ADD COLUMN IF NOT EXISTS taken_quantity numeric;
ALTER TABLE public.feeding_records ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS feeding_record_request_infra ON public.feeding_records(request_id, infrastructure_id);
CREATE OR REPLACE FUNCTION public.record_sheet_feeding(_sheet_id uuid, _request_id uuid, _date date, _time time, _period text, _lines jsonb, _behavior text, _notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
 s public.feeding_sheets%ROWTYPE; st public.feed_stocks%ROWTYPE;
 line jsonb; ci record; b record; iid uuid; infra_name text;
 taken numeric; served numeric; returned numeric; total_taken numeric:=0; total_served numeric:=0;
 outstanding numeric; allocated numeric; net numeric; amount numeric:=0; dead integer; remaining_dead integer; lost integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
 IF _request_id IS NULL THEN RAISE EXCEPTION 'Référence requise'; END IF;
 -- Serialize retries before checking the request marker.
 PERFORM pg_advisory_xact_lock(hashtextextended(_request_id::text,0));
 IF EXISTS(SELECT 1 FROM public.feeding_records WHERE request_id=_request_id) THEN RETURN jsonb_build_object('status','already_saved'); END IF;
 SELECT * INTO s FROM public.feeding_sheets WHERE id=_sheet_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Fiche inaccessible'; END IF;
 IF NOT (s.user_id=auth.uid() OR public.team_member_has_unit_access(s.user_id,s.unit_id)) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
 IF _date IS NULL OR _time IS NULL OR _period NOT IN ('matin','midi','soir') THEN RAISE EXCEPTION 'Date, heure et période requises'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(s.period_times,jsonb_build_array(jsonb_build_object('period',s.period)))) p WHERE p->>'period'=_period) THEN RAISE EXCEPTION 'Période non prévue sur cette fiche'; END IF;
 IF jsonb_typeof(_lines)<>'array' OR jsonb_array_length(_lines)=0 THEN RAISE EXCEPTION 'Infrastructure requise'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(_lines)) <> (SELECT count(DISTINCT l->>'infrastructure_id') FROM jsonb_array_elements(_lines) l) THEN RAISE EXCEPTION 'Infrastructure répétée'; END IF;
 FOR line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
   iid:=(line->>'infrastructure_id')::uuid;
   IF NOT EXISTS(SELECT 1 FROM public.unit_infrastructures WHERE id=iid AND unit_id=s.unit_id) THEN RAISE EXCEPTION 'Infrastructure étrangère à cette unité'; END IF;
   IF cardinality(COALESCE(s.infrastructure_ids,ARRAY[s.infrastructure_id]))>0 AND NOT iid=ANY(COALESCE(s.infrastructure_ids,ARRAY[s.infrastructure_id])) THEN RAISE EXCEPTION 'Infrastructure non rattachée à cette fiche'; END IF;
   taken:=(line->>'taken')::numeric; served:=(line->>'served')::numeric; dead:=(line->>'mortality')::integer;
   IF taken IS NULL OR served IS NULL OR dead IS NULL OR taken<0 OR served<0 OR served>taken OR dead<0 THEN RAISE EXCEPTION 'Quantités ou mortalité invalides'; END IF;
   total_taken:=total_taken+taken; total_served:=total_served+served;
 END LOOP;
 IF total_taken<=0 THEN RAISE EXCEPTION 'Quantité prélevée requise'; END IF;
 outstanding:=total_taken;
 -- FIFO stable order; all stocks are locked, preventing concurrent overselling.
 FOR st IN SELECT * FROM public.feed_stocks WHERE unit_id=s.unit_id AND
   COALESCE(stock_purpose,CASE WHEN notes LIKE '[Stock commercial]%' THEN 'commercial' ELSE 'production' END)='production' AND
   (lower(trim(feed_type))=lower(trim(s.feed_type)) OR lower(trim(custom_name))=lower(trim(s.feed_type))) AND unit=s.unit AND quantity>0 ORDER BY created_at,id FOR UPDATE LOOP
   allocated:=LEAST(st.quantity,outstanding); IF allocated<=0 THEN EXIT; END IF;
   -- Serve first, return the unused part of the remaining allocation.
   net:=LEAST(allocated,GREATEST(total_served-(total_taken-outstanding),0));
   UPDATE public.feed_stocks SET quantity=quantity-net WHERE id=st.id AND unit_id=s.unit_id;
   INSERT INTO public.stock_movements(user_id,unit_id,stock_id,type,quantity,quantity_after,reason)
   VALUES(st.user_id,s.unit_id,st.id,'out',allocated,st.quantity-allocated,'Prélèvement nourrissage '||_period||' '||_time||' — '||s.title||' ['||_request_id||']');
   IF allocated>net THEN
     INSERT INTO public.stock_movements(user_id,unit_id,stock_id,type,quantity,quantity_after,reason)
     VALUES(st.user_id,s.unit_id,st.id,'in',allocated-net,st.quantity-net,'Retour non servi — '||s.title||' ['||_request_id||']');
   END IF;
   amount:=amount+net*COALESCE(st.cost,0); outstanding:=outstanding-allocated;
 END LOOP;
 IF outstanding>0 THEN RAISE EXCEPTION 'Stock de production insuffisant ou unité de mesure différente'; END IF;
 FOR line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
   iid:=(line->>'infrastructure_id')::uuid; taken:=(line->>'taken')::numeric; served:=(line->>'served')::numeric;
   dead:=(line->>'mortality')::integer; returned:=taken-served;
   INSERT INTO public.feeding_records(user_id,unit_id,feeding_sheet_id,request_id,infrastructure_id,date,time,feed_type,quantity,session_type,feeder_name,prescribed_quantity,taken_quantity,actual_quantity,remaining_quantity,mortality,behavior,notes)
   VALUES(s.user_id,s.unit_id,s.id,_request_id,iid,_date,_time,s.feed_type,served,_period,s.responsible_name,s.quantity,taken,served,returned,dead,_behavior,_notes);
   SELECT name INTO infra_name FROM public.unit_infrastructures WHERE id=iid AND unit_id=s.unit_id;
   remaining_dead:=dead;
   FOR ci IN SELECT c.* FROM public.cycle_infrastructures c JOIN public.production_cycles p ON p.id=c.cycle_id WHERE p.unit_id=s.unit_id AND p.status='active' AND lower(trim(c.infrastructure_name))=lower(trim(infra_name)) ORDER BY c.id FOR UPDATE OF c LOOP
     EXIT WHEN remaining_dead<=0;
     IF ci.livestock_batch_id IS NOT NULL THEN
       SELECT * INTO b FROM public.livestock_batches WHERE id=ci.livestock_batch_id AND unit_id=s.unit_id AND status NOT IN ('sold','harvested') FOR UPDATE;
       IF NOT FOUND THEN CONTINUE; END IF;
       lost:=LEAST(remaining_dead,GREATEST(b.quantity,0));
       UPDATE public.livestock_batches SET quantity=quantity-lost WHERE id=b.id;
     ELSE lost:=LEAST(remaining_dead,GREATEST(COALESCE(ci.current_quantity,0),0)); END IF;
     UPDATE public.cycle_infrastructures SET current_quantity=GREATEST(COALESCE(current_quantity,0)-lost,0) WHERE id=ci.id;
     remaining_dead:=remaining_dead-lost;
   END LOOP;
   IF remaining_dead>0 THEN RAISE EXCEPTION 'Mortalité supérieure aux effectifs disponibles de %',infra_name; END IF;
 END LOOP;
 IF amount>0 THEN
   INSERT INTO public.accounting_manual_entries(user_id,unit_id,date,journal,label,lines)
   VALUES(s.user_id,s.unit_id,_date,'OD','Consommation nourrissage — '||s.title||' ['||_request_id||']',jsonb_build_array(jsonb_build_object('account','6032','debit',round(amount,2),'credit',0),jsonb_build_object('account','321','debit',0,'credit',round(amount,2))));
 END IF;
 RETURN jsonb_build_object('status','ok','taken',total_taken,'served',total_served,'returned',total_taken-total_served);
END $$;
REVOKE ALL ON FUNCTION public.record_sheet_feeding(uuid,uuid,date,time,text,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sheet_feeding(uuid,uuid,date,time,text,jsonb,text,text) TO authenticated;
