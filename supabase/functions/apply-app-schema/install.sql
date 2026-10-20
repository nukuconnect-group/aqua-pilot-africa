-- Fonctions (créées seulement si absentes : les fonctions existantes ne sont pas remplacées)
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='create_sale_idempotent') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.create_sale_idempotent(_client_request_id text, _unit_id text, _date date, _client_name text, _client_contact text, _total_amount numeric, _status text, _payment_method text, _notes text, _due_date date, _is_credit boolean, _paid_amount numeric, _payment_terms text, _document_type text, _document_number text, _tax_rate numeric, _items jsonb)
 RETURNS TABLE(id uuid, user_id uuid, unit_id text, date date, client_name text, client_contact text, total_amount numeric, status text, payment_method text, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, due_date date, is_credit boolean, paid_amount numeric, payment_terms text, document_type text, document_number text, tax_rate numeric, sale_items jsonb)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $fn$
DECLARE
  v_user_id uuid := auth.uid();
  v_sale_id uuid;
  v_existing_id uuid;
  v_type text := COALESCE(NULLIF(_document_type, ''), 'receipt');
  v_prefix text;
  v_year int := EXTRACT(YEAR FROM COALESCE(_date, CURRENT_DATE))::int;
  v_doc text := NULLIF(_document_number, '');
  v_seq int;
  v_candidate text;
  v_attempt int := 0;
  v_items jsonb := COALESCE(_items, '[]'::jsonb);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF _client_request_id IS NOT NULL THEN
    SELECT s.id INTO v_existing_id
    FROM public.sales s
    WHERE s.user_id = v_user_id
      AND s.client_request_id = _client_request_id
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN QUERY
      SELECT
        s.id, s.user_id, s.unit_id, s.date, s.client_name, s.client_contact,
        s.total_amount, s.status, s.payment_method, s.notes, s.created_at, s.updated_at,
        s.due_date, s.is_credit, s.paid_amount, s.payment_terms, s.document_type,
        s.document_number, s.tax_rate,
        COALESCE(jsonb_agg(to_jsonb(si) ORDER BY si.created_at) FILTER (WHERE si.id IS NOT NULL), '[]'::jsonb) AS sale_items
      FROM public.sales s
      LEFT JOIN public.sale_items si ON si.sale_id = s.id
      WHERE s.id = v_existing_id
      GROUP BY s.id;
      RETURN;
    END IF;
  END IF;

  IF v_type NOT IN ('receipt', 'invoice', 'proforma') THEN
    RAISE EXCEPTION 'invalid document type' USING ERRCODE = '22023';
  END IF;

  v_prefix := CASE v_type WHEN 'invoice' THEN 'FAC' WHEN 'proforma' THEN 'PRO' ELSE 'REC' END;

  LOOP
    BEGIN
      IF v_doc IS NULL OR v_attempt > 0 THEN
        SELECT COALESCE(MAX((regexp_match(s.document_number, ('^' || v_prefix || '-' || v_year || '-([0-9]+)$')))[1]::int), 0) + 1
        INTO v_seq
        FROM public.sales s
        WHERE s.user_id = v_user_id
          AND s.document_type = v_type
          AND s.document_number ~ ('^' || v_prefix || '-' || v_year || '-[0-9]+$');

        v_candidate := v_prefix || '-' || v_year || '-' || lpad((v_seq + v_attempt)::text, 4, '0');
      ELSE
        v_candidate := v_doc;
      END IF;

      INSERT INTO public.sales (
        user_id, unit_id, date, client_name, client_contact, total_amount, status,
        payment_method, notes, due_date, is_credit, paid_amount, payment_terms,
        document_type, document_number, tax_rate, client_request_id
      ) VALUES (
        v_user_id, _unit_id, COALESCE(_date, CURRENT_DATE), _client_name, _client_contact,
        COALESCE(_total_amount, 0), COALESCE(_status, 'confirmed'), _payment_method, _notes,
        _due_date, COALESCE(_is_credit, false), COALESCE(_paid_amount, 0), _payment_terms,
        v_type, v_candidate, COALESCE(_tax_rate, 0), _client_request_id
      )
      RETURNING sales.id INTO v_sale_id;

      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 25 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  INSERT INTO public.sale_items (user_id, sale_id, name, quantity, unit_price, total)
  SELECT
    v_user_id,
    v_sale_id,
    trim(item->>'name'),
    COALESCE((item->>'quantity')::numeric, 0),
    COALESCE((item->>'unitPrice')::numeric, 0),
    COALESCE((item->>'total')::numeric, 0)
  FROM jsonb_array_elements(v_items) AS item
  WHERE trim(COALESCE(item->>'name', '')) <> '';

  RETURN QUERY
  SELECT
    s.id, s.user_id, s.unit_id, s.date, s.client_name, s.client_contact,
    s.total_amount, s.status, s.payment_method, s.notes, s.created_at, s.updated_at,
    s.due_date, s.is_credit, s.paid_amount, s.payment_terms, s.document_type,
    s.document_number, s.tax_rate,
    COALESCE(jsonb_agg(to_jsonb(si) ORDER BY si.created_at) FILTER (WHERE si.id IS NOT NULL), '[]'::jsonb) AS sale_items
  FROM public.sales s
  LEFT JOIN public.sale_items si ON si.sale_id = s.id
  WHERE s.id = v_sale_id
  GROUP BY s.id;
END;
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='handle_updated_at') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='has_role') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='assign_admin_to_first_user') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.assign_admin_to_first_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
BEGIN
  -- Check if this is the first user (no roles exist yet)
  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    -- Assign admin role to the first user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role);
    
    RAISE NOTICE 'Admin role assigned to first user: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_team_member_owner_by_user_id') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.get_team_member_owner_by_user_id(user_uuid uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  SELECT tm.owner_id
  FROM public.team_members tm
  WHERE tm.user_id = user_uuid
    AND tm.status = 'active'
  LIMIT 1
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='is_active_team_member') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.is_active_team_member(user_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.user_id = user_uuid
      AND tm.status = 'active'
  )
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_team_member_owner_id') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.get_team_member_owner_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  SELECT tm.owner_id
  FROM public.team_members tm
  WHERE tm.user_id = auth.uid()
    AND tm.status = 'active'
  LIMIT 1
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='is_team_member_of') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.is_team_member_of(owner_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.owner_id = owner_user_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
  )
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='team_member_has_unit_access') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.team_member_has_unit_access(_owner_id uuid, _unit_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.team_member_units tmu ON tmu.team_member_id = tm.id
    WHERE tm.owner_id = _owner_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tmu.unit_id = _unit_id
  )
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='user_meets_plan') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.user_meets_plan(_user_id uuid, _plan_min text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  SELECT COALESCE((
    SELECT CASE COALESCE(s.plan,'free')
             WHEN 'free' THEN 0 WHEN 'standard' THEN 1
             WHEN 'premium' THEN 2 WHEN 'enterprise' THEN 3 ELSE 0 END
    FROM public.subscriptions s
    WHERE s.user_id = _user_id
      AND s.status IN ('active','trialing')
    ORDER BY 1 DESC
    LIMIT 1
  ), 0) >= CASE COALESCE(_plan_min,'free')
    WHEN 'free' THEN 0 WHEN 'standard' THEN 1
    WHEN 'premium' THEN 2 WHEN 'enterprise' THEN 3 ELSE 99 END;
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_current_subscription') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.get_current_subscription(_user_id uuid)
 RETURNS TABLE(id uuid, plan text, status text, start_date date, end_date date, days_remaining integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
  v_target uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  -- Admins may look up any user's subscription; everyone else is restricted
  -- to their own record. Fixes DEFINER_OR_RPC_BYPASS: rpc_get_subscription.
  IF public.has_role(v_caller, 'admin'::app_role) THEN
    v_target := COALESCE(_user_id, v_caller);
  ELSE
    v_target := v_caller;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.plan,
    s.status,
    s.start_date,
    s.end_date,
    GREATEST(0, (s.end_date - CURRENT_DATE))::integer AS days_remaining
  FROM public.subscriptions s
  WHERE s.user_id = v_target
  ORDER BY
    CASE s.status WHEN 'active' THEN 1 WHEN 'trial' THEN 2 WHEN 'expired' THEN 3 ELSE 4 END,
    s.end_date DESC
  LIMIT 1;
END;
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='expire_outdated_subscriptions') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.expire_outdated_subscriptions()
 RETURNS TABLE(expired_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired', updated_at = now()
  WHERE status IN ('trial', 'active')
    AND end_date < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='extend_subscription') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.extend_subscription(_subscription_id uuid, _days integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can extend subscriptions';
  END IF;
  UPDATE public.subscriptions
  SET end_date = end_date + (_days || ' days')::interval,
      status = CASE WHEN status = 'expired' THEN 'trial' ELSE status END,
      updated_at = now()
  WHERE id = _subscription_id;
END;
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='handle_new_user') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  v_exploitation_type text;
  v_needs_sensors boolean;
  v_full_name text;
  v_company_name text;
  v_company_address text;
  v_phone text;
  v_country text;
  v_country_code text;
  v_production_units text[];
BEGIN
  v_exploitation_type := NEW.raw_user_meta_data->>'exploitation_type';
  IF v_exploitation_type NOT IN ('moyenne','semi_industriel','industriel') THEN
    v_exploitation_type := NULL;
  END IF;
  v_needs_sensors := COALESCE((NEW.raw_user_meta_data->>'needs_sensors')::boolean, false);
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_company_name := NEW.raw_user_meta_data->>'company_name';
  v_company_address := NEW.raw_user_meta_data->>'company_address';
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_country := NEW.raw_user_meta_data->>'country';
  v_country_code := NEW.raw_user_meta_data->>'country_code';
  BEGIN
    v_production_units := ARRAY(SELECT jsonb_array_elements_text(COALESCE(NEW.raw_user_meta_data->'production_units','[]'::jsonb)));
  EXCEPTION WHEN OTHERS THEN
    v_production_units := NULL;
  END;

  INSERT INTO public.profiles (
    id, email, full_name, avatar_url, is_activated, exploitation_type, needs_sensors,
    company_name, company_address, phone, country, country_code, production_units
  )
  VALUES (
    NEW.id, NEW.email, v_full_name,
    NEW.raw_user_meta_data->>'avatar_url',
    true, v_exploitation_type, v_needs_sensors,
    v_company_name, v_company_address, v_phone, v_country, v_country_code, v_production_units
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  INSERT INTO public.subscriptions (user_id, plan, status, start_date, end_date, price, currency, notes)
  VALUES (
    NEW.id, 'trial_discovery', 'trial',
    CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
    0, 'XOF', 'Pack Découverte - Essai gratuit 30 jours'
  );

  RETURN NEW;
END;
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='protect_support_ticket_admin_fields') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.protect_support_ticket_admin_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.admin_response IS DISTINCT FROM OLD.admin_response
     OR NEW.responded_at IS DISTINCT FROM OLD.responded_at
     OR NEW.responded_by IS DISTINCT FROM OLD.responded_by THEN
    RAISE EXCEPTION 'Only admins can modify status, priority, or admin response fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='check_and_send_stock_alert') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.check_and_send_stock_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  project_url TEXT := 'https://drzybwlvbaqrtrpshaue.supabase.co';
  anon_key TEXT := 'sb_publishable_T52gcHMQjGZ1e0jXG2nYXg_UrQiu3-D';
BEGIN
  IF NEW.quantity <= COALESCE(NEW.min_threshold, 50) THEN
    BEGIN
      PERFORM extensions.net.http_post(
        url := project_url || '/functions/v1/send-stock-alert',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key),
        body := jsonb_build_object('stock_id', NEW.id, 'user_id', NEW.user_id)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Stock alert dispatch failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='notify_critical_notification_email') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.notify_critical_notification_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  project_url TEXT := 'https://drzybwlvbaqrtrpshaue.supabase.co';
  anon_key TEXT := 'sb_publishable_T52gcHMQjGZ1e0jXG2nYXg_UrQiu3-D';
BEGIN
  IF NEW.is_critical = true THEN
    BEGIN
      PERFORM extensions.net.http_post(
        url := project_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || anon_key),
        body := jsonb_build_object('kind','critical_alert','user_id', NEW.user_id,'title', NEW.title,'message', NEW.message)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Critical alert email dispatch failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='notify_profile_activated') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.notify_profile_activated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  project_url TEXT := 'https://drzybwlvbaqrtrpshaue.supabase.co';
  anon_key TEXT := 'sb_publishable_T52gcHMQjGZ1e0jXG2nYXg_UrQiu3-D';
BEGIN
  IF NEW.is_activated = true AND (OLD.is_activated IS DISTINCT FROM true) THEN
    BEGIN
      PERFORM extensions.net.http_post(
        url := project_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || anon_key),
        body := jsonb_build_object('kind','account_activated','to', NEW.email,'user_id', NEW.id)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Activation email dispatch failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='owns_unit') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.owns_unit(_unit uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  select exists (select 1 from public.production_units where id = _unit and user_id = auth.uid())
$fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='validate_treasury_movement') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.validate_treasury_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
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
END $fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='create_treasury_account') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.create_treasury_account(_unit_id text, _name text, _kind text, _code text, _currency text, _opening numeric, _counterpart text, _date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $fn$
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
END $fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='guard_sale_cancellation') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.guard_sale_cancellation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $fn$
BEGIN
 IF TG_OP='DELETE' AND OLD.status IN ('confirmed','delivered','paid','cancelled') THEN RAISE EXCEPTION 'Annulez la vente au lieu de supprimer son historique'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF OLD.status='cancelled' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Une vente annulée ne peut plus être modifiée'; END IF;
 IF NEW.status='cancelled' AND OLD.status<>'cancelled' THEN
  IF NEW.cancellation_reason IS NULL OR length(trim(NEW.cancellation_reason))=0 THEN RAISE EXCEPTION 'Indiquez le motif de l’annulation'; END IF;
  NEW.status_before_cancellation:=OLD.status; NEW.cancelled_at:=now();
 END IF;
 RETURN NEW;
END $fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cancel_sale') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $fn$
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
END $fn$$ddl$; END IF; END $do$;
DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='authorize_treasury_movement') THEN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.authorize_treasury_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT (NEW.user_id=auth.uid() OR public.team_member_has_unit_access(NEW.user_id,NEW.unit_id)) THEN RAISE EXCEPTION 'Mouvement non autorisé'; END IF;
 RETURN NEW;
END $fn$$ddl$; END IF; END $do$;
-- Installation idempotente des tables et champs manquants d'AquaPilote
CREATE TABLE IF NOT EXISTS public.accounting_closures (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "unit_id" text NOT NULL,
  "fiscal_year" integer NOT NULL,
  "result" numeric NOT NULL,
  "closed_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='accounting_closures_pkey' AND conrelid='public.accounting_closures'::regclass) THEN ALTER TABLE public.accounting_closures ADD CONSTRAINT accounting_closures_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='accounting_closures_unit_id_fiscal_year_key' AND conrelid='public.accounting_closures'::regclass) THEN ALTER TABLE public.accounting_closures ADD CONSTRAINT accounting_closures_unit_id_fiscal_year_key UNIQUE (unit_id, fiscal_year); END IF; END $$;
ALTER TABLE public.accounting_closures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "closures access" ON public.accounting_closures; CREATE POLICY "closures access" ON public.accounting_closures AS PERMISSIVE FOR ALL TO authenticated USING (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id))) WITH CHECK (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id)));
CREATE TABLE IF NOT EXISTS public.accounting_entry_marks (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "unit_id" text NOT NULL,
  "entry_id" text NOT NULL,
  "account" text NOT NULL,
  "kind" text NOT NULL,
  "code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='accounting_entry_marks_kind_check' AND conrelid='public.accounting_entry_marks'::regclass) THEN ALTER TABLE public.accounting_entry_marks ADD CONSTRAINT accounting_entry_marks_kind_check CHECK ((kind = ANY (ARRAY['lettrage'::text, 'rapprochement'::text]))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='accounting_entry_marks_pkey' AND conrelid='public.accounting_entry_marks'::regclass) THEN ALTER TABLE public.accounting_entry_marks ADD CONSTRAINT accounting_entry_marks_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='accounting_entry_marks_unit_id_entry_id_account_kind_key' AND conrelid='public.accounting_entry_marks'::regclass) THEN ALTER TABLE public.accounting_entry_marks ADD CONSTRAINT accounting_entry_marks_unit_id_entry_id_account_kind_key UNIQUE (unit_id, entry_id, account, kind); END IF; END $$;
ALTER TABLE public.accounting_entry_marks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entry marks access" ON public.accounting_entry_marks; CREATE POLICY "entry marks access" ON public.accounting_entry_marks AS PERMISSIVE FOR ALL TO authenticated USING (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id))) WITH CHECK (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id)));
CREATE TABLE IF NOT EXISTS public.accounting_manual_entries (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "unit_id" text NOT NULL,
  "date" date NOT NULL,
  "journal" text DEFAULT 'OD'::text NOT NULL,
  "label" text NOT NULL,
  "lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='accounting_manual_entries_journal_check' AND conrelid='public.accounting_manual_entries'::regclass) THEN ALTER TABLE public.accounting_manual_entries ADD CONSTRAINT accounting_manual_entries_journal_check CHECK ((journal = ANY (ARRAY['AN'::text, 'OD'::text, 'CL'::text]))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='accounting_manual_entries_pkey' AND conrelid='public.accounting_manual_entries'::regclass) THEN ALTER TABLE public.accounting_manual_entries ADD CONSTRAINT accounting_manual_entries_pkey PRIMARY KEY (id); END IF; END $$;
ALTER TABLE public.accounting_manual_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "manual entries access" ON public.accounting_manual_entries; CREATE POLICY "manual entries access" ON public.accounting_manual_entries AS PERMISSIVE FOR ALL TO authenticated USING (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id))) WITH CHECK (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id)));
CREATE TABLE IF NOT EXISTS public.attendance_records (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" text,
  "employee_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "recorded_at" timestamp with time zone NOT NULL,
  "latitude" double precision,
  "longitude" double precision,
  "distance_m" numeric,
  "inside_zone" boolean,
  "photo_path" text,
  "client_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='attendance_records_client_id_key' AND conrelid='public.attendance_records'::regclass) THEN ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_client_id_key UNIQUE (client_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='attendance_records_kind_check' AND conrelid='public.attendance_records'::regclass) THEN ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_kind_check CHECK ((kind = ANY (ARRAY['in'::text, 'out'::text]))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='attendance_records_pkey' AND conrelid='public.attendance_records'::regclass) THEN ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id); END IF; END $$;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance owner or team insert" ON public.attendance_records; CREATE POLICY "attendance owner or team insert" ON public.attendance_records AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) OR is_team_member_of(user_id)));
DROP POLICY IF EXISTS "attendance owner or team read" ON public.attendance_records; CREATE POLICY "attendance owner or team read" ON public.attendance_records AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR is_team_member_of(user_id)));
CREATE TABLE IF NOT EXISTS public.cash_movements (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" text NOT NULL,
  "type" text NOT NULL,
  "amount" numeric NOT NULL,
  "payment_method" text DEFAULT 'Espèces'::text NOT NULL,
  "sale_id" uuid,
  "label" text,
  "created_by" uuid DEFAULT auth.uid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cash_movements_amount_check' AND conrelid='public.cash_movements'::regclass) THEN ALTER TABLE public.cash_movements ADD CONSTRAINT cash_movements_amount_check CHECK ((amount >= (0)::numeric)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cash_movements_pkey' AND conrelid='public.cash_movements'::regclass) THEN ALTER TABLE public.cash_movements ADD CONSTRAINT cash_movements_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cash_movements_type_check' AND conrelid='public.cash_movements'::regclass) THEN ALTER TABLE public.cash_movements ADD CONSTRAINT cash_movements_type_check CHECK ((type = ANY (ARRAY['sale'::text, 'cash_in'::text, 'cash_out'::text]))); END IF; END $$;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash_movements owner or team insert" ON public.cash_movements; CREATE POLICY "cash_movements owner or team insert" ON public.cash_movements AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id)));
DROP POLICY IF EXISTS "cash_movements owner or team read" ON public.cash_movements; CREATE POLICY "cash_movements owner or team read" ON public.cash_movements AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id)));
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" text NOT NULL,
  "opened_by" uuid DEFAULT auth.uid() NOT NULL,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "opening_amount" numeric DEFAULT 0 NOT NULL,
  "closed_at" timestamp with time zone,
  "expected_amount" numeric,
  "counted_amount" numeric,
  "difference" numeric,
  "status" text DEFAULT 'open'::text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "name" text
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cash_sessions_pkey' AND conrelid='public.cash_sessions'::regclass) THEN ALTER TABLE public.cash_sessions ADD CONSTRAINT cash_sessions_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cash_sessions_status_check' AND conrelid='public.cash_sessions'::regclass) THEN ALTER TABLE public.cash_sessions ADD CONSTRAINT cash_sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text]))); END IF; END $$;
CREATE INDEX IF NOT EXISTS cash_sessions_unit_open ON public.cash_sessions USING btree (unit_id) WHERE (status = 'open'::text);
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash_sessions owner or team" ON public.cash_sessions; CREATE POLICY "cash_sessions owner or team" ON public.cash_sessions AS PERMISSIVE FOR ALL TO authenticated USING (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id))) WITH CHECK (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id)));
CREATE TABLE IF NOT EXISTS public.cycle_budgets (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "unit_id" text NOT NULL,
  "cycle_id" uuid NOT NULL,
  "lines" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "initial_cash" numeric DEFAULT 0 NOT NULL,
  "discount_rate" numeric DEFAULT 10 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cycle_budgets_pkey' AND conrelid='public.cycle_budgets'::regclass) THEN ALTER TABLE public.cycle_budgets ADD CONSTRAINT cycle_budgets_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cycle_budgets_user_id_cycle_id_key' AND conrelid='public.cycle_budgets'::regclass) THEN ALTER TABLE public.cycle_budgets ADD CONSTRAINT cycle_budgets_user_id_cycle_id_key UNIQUE (user_id, cycle_id); END IF; END $$;
ALTER TABLE public.cycle_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own cycle budgets" ON public.cycle_budgets; CREATE POLICY "Own cycle budgets" ON public.cycle_budgets AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = user_id) OR is_team_member_of(user_id))) WITH CHECK ((auth.uid() = user_id));
CREATE TABLE IF NOT EXISTS public.employee_loans (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "employee_id" text NOT NULL,
  "employee_name" text NOT NULL,
  "unit_id" text,
  "amount" numeric DEFAULT 0 NOT NULL,
  "monthly_amount" numeric DEFAULT 0 NOT NULL,
  "months" integer DEFAULT 0 NOT NULL,
  "start_date" date NOT NULL,
  "reason" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='employee_loans_pkey' AND conrelid='public.employee_loans'::regclass) THEN ALTER TABLE public.employee_loans ADD CONSTRAINT employee_loans_pkey PRIMARY KEY (id); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_employee_loans_user ON public.employee_loans USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_employee_loans_employee ON public.employee_loans USING btree (employee_id);
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own employee loans" ON public.employee_loans; CREATE POLICY "own employee loans" ON public.employee_loans AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE TABLE IF NOT EXISTS public.feed_formulations (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" uuid,
  "name" text NOT NULL,
  "species" text NOT NULL,
  "stage" text NOT NULL,
  "batch_size_kg" numeric DEFAULT 100 NOT NULL,
  "mode" text DEFAULT 'balanced'::text NOT NULL,
  "targets" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "nutrition" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "total_cost" numeric DEFAULT 0 NOT NULL,
  "cost_per_kg" numeric DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='feed_formulations_pkey' AND conrelid='public.feed_formulations'::regclass) THEN ALTER TABLE public.feed_formulations ADD CONSTRAINT feed_formulations_pkey PRIMARY KEY (id); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_feed_formulations_user ON public.feed_formulations USING btree (user_id);
ALTER TABLE public.feed_formulations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_formulations_own" ON public.feed_formulations; CREATE POLICY "feed_formulations_own" ON public.feed_formulations AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE TABLE IF NOT EXISTS public.feed_ingredients (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" uuid,
  "name" text NOT NULL,
  "category" text DEFAULT 'proteine'::text NOT NULL,
  "price_per_kg" numeric DEFAULT 0 NOT NULL,
  "protein_pct" numeric DEFAULT 0 NOT NULL,
  "lipid_pct" numeric DEFAULT 0 NOT NULL,
  "fiber_pct" numeric DEFAULT 0 NOT NULL,
  "energy_kcal_kg" numeric DEFAULT 0 NOT NULL,
  "calcium_pct" numeric DEFAULT 0 NOT NULL,
  "phosphorus_pct" numeric DEFAULT 0 NOT NULL,
  "ash_pct" numeric DEFAULT 0 NOT NULL,
  "moisture_pct" numeric DEFAULT 0 NOT NULL,
  "min_inclusion_pct" numeric DEFAULT 0 NOT NULL,
  "max_inclusion_pct" numeric DEFAULT 100 NOT NULL,
  "stock_kg" numeric DEFAULT 0 NOT NULL,
  "supplier" text,
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='feed_ingredients_pkey' AND conrelid='public.feed_ingredients'::regclass) THEN ALTER TABLE public.feed_ingredients ADD CONSTRAINT feed_ingredients_pkey PRIMARY KEY (id); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_feed_ingredients_user ON public.feed_ingredients USING btree (user_id);
ALTER TABLE public.feed_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_ingredients_own" ON public.feed_ingredients; CREATE POLICY "feed_ingredients_own" ON public.feed_ingredients AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE TABLE IF NOT EXISTS public.feed_manufacturing_batches (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" uuid,
  "formulation_id" uuid,
  "formulation_name" text NOT NULL,
  "batch_number" text NOT NULL,
  "species" text,
  "stage" text,
  "quantity_kg" numeric DEFAULT 0 NOT NULL,
  "lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "nutrition" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "total_cost" numeric DEFAULT 0 NOT NULL,
  "cost_per_kg" numeric DEFAULT 0 NOT NULL,
  "responsible" text,
  "status" text DEFAULT 'produced'::text NOT NULL,
  "stock_transferred" boolean DEFAULT false NOT NULL,
  "raw_deducted" boolean DEFAULT false NOT NULL,
  "manufactured_at" timestamp with time zone DEFAULT now() NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='feed_manufacturing_batches_pkey' AND conrelid='public.feed_manufacturing_batches'::regclass) THEN ALTER TABLE public.feed_manufacturing_batches ADD CONSTRAINT feed_manufacturing_batches_pkey PRIMARY KEY (id); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_feed_batches_user ON public.feed_manufacturing_batches USING btree (user_id);
ALTER TABLE public.feed_manufacturing_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feed_batches_own" ON public.feed_manufacturing_batches; CREATE POLICY "feed_batches_own" ON public.feed_manufacturing_batches AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE TABLE IF NOT EXISTS public.feed_production_cycles (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" text,
  "name" text NOT NULL,
  "formulation_id" text,
  "formulation_name" text,
  "planned_quantity_kg" numeric DEFAULT 0 NOT NULL,
  "produced_quantity_kg" numeric DEFAULT 0 NOT NULL,
  "loss_kg" numeric DEFAULT 0 NOT NULL,
  "consumed_materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "total_cost" numeric DEFAULT 0 NOT NULL,
  "cost_per_kg" numeric DEFAULT 0 NOT NULL,
  "batch_number" text,
  "status" text DEFAULT 'planned'::text NOT NULL,
  "start_date" date DEFAULT CURRENT_DATE NOT NULL,
  "end_date" date,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='feed_production_cycles_pkey' AND conrelid='public.feed_production_cycles'::regclass) THEN ALTER TABLE public.feed_production_cycles ADD CONSTRAINT feed_production_cycles_pkey PRIMARY KEY (id); END IF; END $$;
ALTER TABLE public.feed_production_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own feed production cycles" ON public.feed_production_cycles; CREATE POLICY "own feed production cycles" ON public.feed_production_cycles AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE TABLE IF NOT EXISTS public.feed_quality_controls (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" text,
  "control_type" text DEFAULT 'raw_material'::text NOT NULL,
  "item_name" text NOT NULL,
  "batch_number" text,
  "supplier" text,
  "control_date" date DEFAULT CURRENT_DATE NOT NULL,
  "status" text DEFAULT 'conforme'::text NOT NULL,
  "parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "anomaly" text,
  "corrective_action" text,
  "responsible" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='feed_quality_controls_pkey' AND conrelid='public.feed_quality_controls'::regclass) THEN ALTER TABLE public.feed_quality_controls ADD CONSTRAINT feed_quality_controls_pkey PRIMARY KEY (id); END IF; END $$;
ALTER TABLE public.feed_quality_controls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own feed quality controls" ON public.feed_quality_controls; CREATE POLICY "own feed quality controls" ON public.feed_quality_controls AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
ALTER TABLE public.feed_stocks ADD COLUMN IF NOT EXISTS "stock_purpose" text DEFAULT 'production'::text NOT NULL;
ALTER TABLE public.feed_stocks ADD COLUMN IF NOT EXISTS "sale_price" numeric;
CREATE TABLE IF NOT EXISTS public.leave_requests (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "employee_id" text NOT NULL,
  "employee_name" text NOT NULL,
  "unit_id" text,
  "type" text DEFAULT 'annuel'::text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "days" integer DEFAULT 0 NOT NULL,
  "reason" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='leave_requests_pkey' AND conrelid='public.leave_requests'::regclass) THEN ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON public.leave_requests USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests USING btree (employee_id);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own leave requests" ON public.leave_requests; CREATE POLICY "own leave requests" ON public.leave_requests AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE TABLE IF NOT EXISTS public.loan_repayments (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "loan_id" uuid NOT NULL,
  "date" date DEFAULT CURRENT_DATE NOT NULL,
  "amount" numeric DEFAULT 0 NOT NULL,
  "period" text,
  "source" text DEFAULT 'manual'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='loan_repayments_pkey' AND conrelid='public.loan_repayments'::regclass) THEN ALTER TABLE public.loan_repayments ADD CONSTRAINT loan_repayments_pkey PRIMARY KEY (id); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan ON public.loan_repayments USING btree (loan_id);
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own loan repayments" ON public.loan_repayments; CREATE POLICY "own loan repayments" ON public.loan_repayments AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE TABLE IF NOT EXISTS public.plan_module_audit (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "admin_email" text,
  "plan_key" text,
  "module_key" text,
  "action" text,
  "before_value" jsonb,
  "after_value" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='plan_module_audit_pkey' AND conrelid='public.plan_module_audit'::regclass) THEN ALTER TABLE public.plan_module_audit ADD CONSTRAINT plan_module_audit_pkey PRIMARY KEY (id); END IF; END $$;
ALTER TABLE public.plan_module_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit admin read" ON public.plan_module_audit; CREATE POLICY "audit admin read" ON public.plan_module_audit AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "audit insert" ON public.plan_module_audit; CREATE POLICY "audit insert" ON public.plan_module_audit AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TABLE IF NOT EXISTS public.plan_modules (
  "plan_key" text NOT NULL,
  "module_key" text NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='plan_modules_pkey' AND conrelid='public.plan_modules'::regclass) THEN ALTER TABLE public.plan_modules ADD CONSTRAINT plan_modules_pkey PRIMARY KEY (plan_key, module_key); END IF; END $$;
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_modules admin write" ON public.plan_modules; CREATE POLICY "plan_modules admin write" ON public.plan_modules AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "plan_modules readable" ON public.plan_modules; CREATE POLICY "plan_modules readable" ON public.plan_modules AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE TABLE IF NOT EXISTS public.plans (
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" numeric DEFAULT 0 NOT NULL,
  "billing_period" text DEFAULT 'monthly'::text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='plans_pkey' AND conrelid='public.plans'::regclass) THEN ALTER TABLE public.plans ADD CONSTRAINT plans_pkey PRIMARY KEY (key); END IF; END $$;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans admin write" ON public.plans; CREATE POLICY "plans admin write" ON public.plans AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "plans readable" ON public.plans; CREATE POLICY "plans readable" ON public.plans AS PERMISSIVE FOR SELECT TO public USING (true);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "cancellation_reason" text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS "status_before_cancellation" text;
CREATE TABLE IF NOT EXISTS public.savings_agents (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "commission_rate" numeric DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='savings_agents_pkey' AND conrelid='public.savings_agents'::regclass) THEN ALTER TABLE public.savings_agents ADD CONSTRAINT savings_agents_pkey PRIMARY KEY (id); END IF; END $$;
ALTER TABLE public.savings_agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner savings_agents" ON public.savings_agents; CREATE POLICY "owner savings_agents" ON public.savings_agents AS PERMISSIVE FOR ALL TO authenticated USING (owns_unit(unit_id)) WITH CHECK (owns_unit(unit_id));
CREATE TABLE IF NOT EXISTS public.savings_members (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "book_number" text NOT NULL,
  "full_name" text NOT NULL,
  "phone" text,
  "agent_id" uuid,
  "daily_amount" numeric DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='savings_members_pkey' AND conrelid='public.savings_members'::regclass) THEN ALTER TABLE public.savings_members ADD CONSTRAINT savings_members_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='savings_members_unit_id_book_number_key' AND conrelid='public.savings_members'::regclass) THEN ALTER TABLE public.savings_members ADD CONSTRAINT savings_members_unit_id_book_number_key UNIQUE (unit_id, book_number); END IF; END $$;
ALTER TABLE public.savings_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner savings_members" ON public.savings_members; CREATE POLICY "owner savings_members" ON public.savings_members AS PERMISSIVE FOR ALL TO authenticated USING (owns_unit(unit_id)) WITH CHECK (owns_unit(unit_id));
CREATE TABLE IF NOT EXISTS public.savings_transactions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "member_id" uuid NOT NULL,
  "agent_id" uuid,
  "type" text NOT NULL,
  "amount" numeric NOT NULL,
  "date" date DEFAULT CURRENT_DATE NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='savings_transactions_amount_check' AND conrelid='public.savings_transactions'::regclass) THEN ALTER TABLE public.savings_transactions ADD CONSTRAINT savings_transactions_amount_check CHECK ((amount > (0)::numeric)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='savings_transactions_pkey' AND conrelid='public.savings_transactions'::regclass) THEN ALTER TABLE public.savings_transactions ADD CONSTRAINT savings_transactions_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='savings_transactions_type_check' AND conrelid='public.savings_transactions'::regclass) THEN ALTER TABLE public.savings_transactions ADD CONSTRAINT savings_transactions_type_check CHECK ((type = ANY (ARRAY['deposit'::text, 'withdrawal'::text]))); END IF; END $$;
ALTER TABLE public.savings_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner savings_tx" ON public.savings_transactions; CREATE POLICY "owner savings_tx" ON public.savings_transactions AS PERMISSIVE FOR ALL TO authenticated USING (owns_unit(unit_id)) WITH CHECK (owns_unit(unit_id));
CREATE TABLE IF NOT EXISTS public.shop_orders (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "unit_id" uuid NOT NULL,
  "customer_name" text NOT NULL,
  "customer_phone" text NOT NULL,
  "customer_address" text,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "total" numeric DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'new'::text NOT NULL,
  "note" text,
  "sale_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shop_orders_pkey' AND conrelid='public.shop_orders'::regclass) THEN ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shop_orders_status_check' AND conrelid='public.shop_orders'::regclass) THEN ALTER TABLE public.shop_orders ADD CONSTRAINT shop_orders_status_check CHECK ((status = ANY (ARRAY['new'::text, 'confirmed'::text, 'delivered'::text, 'cancelled'::text]))); END IF; END $$;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner shop_orders" ON public.shop_orders; CREATE POLICY "owner shop_orders" ON public.shop_orders AS PERMISSIVE FOR ALL TO authenticated USING (owns_unit(unit_id)) WITH CHECK (owns_unit(unit_id));
DROP POLICY IF EXISTS "public place order" ON public.shop_orders; CREATE POLICY "public place order" ON public.shop_orders AS PERMISSIVE FOR INSERT TO anon WITH CHECK (((status = 'new'::text) AND (sale_id IS NULL) AND (total >= (0)::numeric) AND (EXISTS ( SELECT 1
   FROM shop_settings s
  WHERE ((s.unit_id = shop_orders.unit_id) AND s.enabled)))));
CREATE TABLE IF NOT EXISTS public.shop_products (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" numeric DEFAULT 0 NOT NULL,
  "unit_label" text DEFAULT 'kg'::text NOT NULL,
  "stock" numeric DEFAULT 0 NOT NULL,
  "image_url" text,
  "visible" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shop_products_pkey' AND conrelid='public.shop_products'::regclass) THEN ALTER TABLE public.shop_products ADD CONSTRAINT shop_products_pkey PRIMARY KEY (id); END IF; END $$;
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner shop_products" ON public.shop_products; CREATE POLICY "owner shop_products" ON public.shop_products AS PERMISSIVE FOR ALL TO authenticated USING (owns_unit(unit_id)) WITH CHECK (owns_unit(unit_id));
DROP POLICY IF EXISTS "public visible products" ON public.shop_products; CREATE POLICY "public visible products" ON public.shop_products AS PERMISSIVE FOR SELECT TO anon USING ((visible = true));
CREATE TABLE IF NOT EXISTS public.shop_settings (
  "unit_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "shop_name" text NOT NULL,
  "banner" text,
  "whatsapp" text,
  "enabled" boolean DEFAULT true NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shop_settings_pkey' AND conrelid='public.shop_settings'::regclass) THEN ALTER TABLE public.shop_settings ADD CONSTRAINT shop_settings_pkey PRIMARY KEY (unit_id); END IF; END $$;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner shop_settings" ON public.shop_settings; CREATE POLICY "owner shop_settings" ON public.shop_settings AS PERMISSIVE FOR ALL TO authenticated USING (owns_unit(unit_id)) WITH CHECK (owns_unit(unit_id));
DROP POLICY IF EXISTS "public shop settings" ON public.shop_settings; CREATE POLICY "public shop settings" ON public.shop_settings AS PERMISSIVE FOR SELECT TO anon USING ((enabled = true));
CREATE TABLE IF NOT EXISTS public.stock_movements (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" text NOT NULL,
  "stock_id" uuid NOT NULL,
  "type" text NOT NULL,
  "quantity" numeric NOT NULL,
  "quantity_after" numeric NOT NULL,
  "reason" text,
  "created_by" uuid DEFAULT auth.uid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_movements_pkey' AND conrelid='public.stock_movements'::regclass) THEN ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_movements_type_check' AND conrelid='public.stock_movements'::regclass) THEN ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_type_check CHECK ((type = ANY (ARRAY['in'::text, 'out'::text, 'adjust'::text]))); END IF; END $$;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_movements insert" ON public.stock_movements; CREATE POLICY "stock_movements insert" ON public.stock_movements AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id)));
DROP POLICY IF EXISTS "stock_movements read" ON public.stock_movements; CREATE POLICY "stock_movements read" ON public.stock_movements AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id)));
CREATE TABLE IF NOT EXISTS public.traceability_records (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "unit_id" text,
  "batch_number" text NOT NULL,
  "product_type" text DEFAULT 'feed'::text NOT NULL,
  "product_name" text,
  "origin" text,
  "entry_date" date DEFAULT CURRENT_DATE NOT NULL,
  "quantity" numeric DEFAULT 0 NOT NULL,
  "unit_label" text DEFAULT 'kg'::text NOT NULL,
  "state" text DEFAULT 'en_stock'::text NOT NULL,
  "destination" text,
  "movements" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "controls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='traceability_records_pkey' AND conrelid='public.traceability_records'::regclass) THEN ALTER TABLE public.traceability_records ADD CONSTRAINT traceability_records_pkey PRIMARY KEY (id); END IF; END $$;
ALTER TABLE public.traceability_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own traceability records" ON public.traceability_records; CREATE POLICY "own traceability records" ON public.traceability_records AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE TABLE IF NOT EXISTS public.treasury_accounts (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "unit_id" text NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "account_code" text NOT NULL,
  "currency" text DEFAULT 'XOF'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_accounts_check' AND conrelid='public.treasury_accounts'::regclass) THEN ALTER TABLE public.treasury_accounts ADD CONSTRAINT treasury_accounts_check CHECK ((((kind = 'cash'::text) AND (account_code ~ '^57[0-9]+$'::text)) OR ((kind = 'bank'::text) AND (account_code ~ '^52[0-9]+$'::text)))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_accounts_kind_check' AND conrelid='public.treasury_accounts'::regclass) THEN ALTER TABLE public.treasury_accounts ADD CONSTRAINT treasury_accounts_kind_check CHECK ((kind = ANY (ARRAY['cash'::text, 'bank'::text]))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_accounts_name_check' AND conrelid='public.treasury_accounts'::regclass) THEN ALTER TABLE public.treasury_accounts ADD CONSTRAINT treasury_accounts_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_accounts_pkey' AND conrelid='public.treasury_accounts'::regclass) THEN ALTER TABLE public.treasury_accounts ADD CONSTRAINT treasury_accounts_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_accounts_user_id_unit_id_account_code_key' AND conrelid='public.treasury_accounts'::regclass) THEN ALTER TABLE public.treasury_accounts ADD CONSTRAINT treasury_accounts_user_id_unit_id_account_code_key UNIQUE (user_id, unit_id, account_code); END IF; END $$;
ALTER TABLE public.treasury_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "treasury_accounts_insert" ON public.treasury_accounts; CREATE POLICY "treasury_accounts_insert" ON public.treasury_accounts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id)) AND (EXISTS ( SELECT 1
   FROM production_units u
  WHERE (((u.id)::text = treasury_accounts.unit_id) AND (u.user_id = treasury_accounts.user_id))))));
DROP POLICY IF EXISTS "treasury_accounts_read" ON public.treasury_accounts; CREATE POLICY "treasury_accounts_read" ON public.treasury_accounts AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id)));
CREATE TABLE IF NOT EXISTS public.treasury_movements (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "unit_id" text NOT NULL,
  "request_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "source_id" uuid,
  "destination_id" uuid,
  "amount" numeric(18,2) NOT NULL,
  "date" date NOT NULL,
  "label" text NOT NULL,
  "journal" text NOT NULL,
  "lines" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_movements_amount_check' AND conrelid='public.treasury_movements'::regclass) THEN ALTER TABLE public.treasury_movements ADD CONSTRAINT treasury_movements_amount_check CHECK ((amount > (0)::numeric)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_movements_check' AND conrelid='public.treasury_movements'::regclass) THEN ALTER TABLE public.treasury_movements ADD CONSTRAINT treasury_movements_check CHECK ((((kind = ANY (ARRAY['opening'::text, 'receipt'::text])) AND (source_id IS NULL) AND (destination_id IS NOT NULL)) OR ((kind = 'payment'::text) AND (source_id IS NOT NULL) AND (destination_id IS NULL)) OR ((kind = 'transfer'::text) AND (source_id IS NOT NULL) AND (destination_id IS NOT NULL) AND (source_id <> destination_id)))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_movements_journal_check' AND conrelid='public.treasury_movements'::regclass) THEN ALTER TABLE public.treasury_movements ADD CONSTRAINT treasury_movements_journal_check CHECK ((journal = ANY (ARRAY['AN'::text, 'CA'::text, 'BQ'::text]))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_movements_kind_check' AND conrelid='public.treasury_movements'::regclass) THEN ALTER TABLE public.treasury_movements ADD CONSTRAINT treasury_movements_kind_check CHECK ((kind = ANY (ARRAY['opening'::text, 'receipt'::text, 'payment'::text, 'transfer'::text]))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_movements_label_check' AND conrelid='public.treasury_movements'::regclass) THEN ALTER TABLE public.treasury_movements ADD CONSTRAINT treasury_movements_label_check CHECK ((length(TRIM(BOTH FROM label)) > 0)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_movements_pkey' AND conrelid='public.treasury_movements'::regclass) THEN ALTER TABLE public.treasury_movements ADD CONSTRAINT treasury_movements_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_movements_request_id_key' AND conrelid='public.treasury_movements'::regclass) THEN ALTER TABLE public.treasury_movements ADD CONSTRAINT treasury_movements_request_id_key UNIQUE (request_id); END IF; END $$;
ALTER TABLE public.treasury_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "treasury_movements_insert" ON public.treasury_movements; CREATE POLICY "treasury_movements_insert" ON public.treasury_movements AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id)));
DROP POLICY IF EXISTS "treasury_movements_read" ON public.treasury_movements; CREATE POLICY "treasury_movements_read" ON public.treasury_movements AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR team_member_has_unit_access(user_id, unit_id)));
CREATE TABLE IF NOT EXISTS public.unit_type_module_rules (
  "unit_type" text NOT NULL,
  "module_key" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='unit_type_module_rules_pkey' AND conrelid='public.unit_type_module_rules'::regclass) THEN ALTER TABLE public.unit_type_module_rules ADD CONSTRAINT unit_type_module_rules_pkey PRIMARY KEY (unit_type, module_key); END IF; END $$;
ALTER TABLE public.unit_type_module_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unit rules admin write" ON public.unit_type_module_rules; CREATE POLICY "unit rules admin write" ON public.unit_type_module_rules AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "unit rules readable" ON public.unit_type_module_rules; CREATE POLICY "unit rules readable" ON public.unit_type_module_rules AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE TABLE IF NOT EXISTS public.user_module_overrides (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "module_key" text NOT NULL,
  "allowed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_module_overrides_pkey' AND conrelid='public.user_module_overrides'::regclass) THEN ALTER TABLE public.user_module_overrides ADD CONSTRAINT user_module_overrides_pkey PRIMARY KEY (id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_module_overrides_user_id_module_key_key' AND conrelid='public.user_module_overrides'::regclass) THEN ALTER TABLE public.user_module_overrides ADD CONSTRAINT user_module_overrides_user_id_module_key_key UNIQUE (user_id, module_key); END IF; END $$;
ALTER TABLE public.user_module_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "overrides admin write" ON public.user_module_overrides; CREATE POLICY "overrides admin write" ON public.user_module_overrides AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "overrides self read" ON public.user_module_overrides; CREATE POLICY "overrides self read" ON public.user_module_overrides AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cash_movements_session_id_fkey' AND conrelid='public.cash_movements'::regclass) THEN ALTER TABLE public.cash_movements ADD CONSTRAINT cash_movements_session_id_fkey FOREIGN KEY (session_id) REFERENCES cash_sessions(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_cycle_budgets_updated_at ON public.cycle_budgets; CREATE TRIGGER trg_cycle_budgets_updated_at BEFORE UPDATE ON public.cycle_budgets FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS trg_employee_loans_updated_at ON public.employee_loans; CREATE TRIGGER trg_employee_loans_updated_at BEFORE UPDATE ON public.employee_loans FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='feed_manufacturing_batches_formulation_id_fkey' AND conrelid='public.feed_manufacturing_batches'::regclass) THEN ALTER TABLE public.feed_manufacturing_batches ADD CONSTRAINT feed_manufacturing_batches_formulation_id_fkey FOREIGN KEY (formulation_id) REFERENCES feed_formulations(id) ON DELETE SET NULL; END IF; END $$;
DROP TRIGGER IF EXISTS trg_feed_production_cycles_updated_at ON public.feed_production_cycles; CREATE TRIGGER trg_feed_production_cycles_updated_at BEFORE UPDATE ON public.feed_production_cycles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS trg_feed_quality_controls_updated_at ON public.feed_quality_controls; CREATE TRIGGER trg_feed_quality_controls_updated_at BEFORE UPDATE ON public.feed_quality_controls FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON public.leave_requests; CREATE TRIGGER trg_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='loan_repayments_loan_id_fkey' AND conrelid='public.loan_repayments'::regclass) THEN ALTER TABLE public.loan_repayments ADD CONSTRAINT loan_repayments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES employee_loans(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS guard_sale_cancellation ON public.sales; CREATE TRIGGER guard_sale_cancellation BEFORE DELETE OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION guard_sale_cancellation();
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='savings_members_agent_id_fkey' AND conrelid='public.savings_members'::regclass) THEN ALTER TABLE public.savings_members ADD CONSTRAINT savings_members_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES savings_agents(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='savings_transactions_agent_id_fkey' AND conrelid='public.savings_transactions'::regclass) THEN ALTER TABLE public.savings_transactions ADD CONSTRAINT savings_transactions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES savings_agents(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='savings_transactions_member_id_fkey' AND conrelid='public.savings_transactions'::regclass) THEN ALTER TABLE public.savings_transactions ADD CONSTRAINT savings_transactions_member_id_fkey FOREIGN KEY (member_id) REFERENCES savings_members(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_traceability_records_updated_at ON public.traceability_records; CREATE TRIGGER trg_traceability_records_updated_at BEFORE UPDATE ON public.traceability_records FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_movements_destination_id_fkey' AND conrelid='public.treasury_movements'::regclass) THEN ALTER TABLE public.treasury_movements ADD CONSTRAINT treasury_movements_destination_id_fkey FOREIGN KEY (destination_id) REFERENCES treasury_accounts(id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='treasury_movements_source_id_fkey' AND conrelid='public.treasury_movements'::regclass) THEN ALTER TABLE public.treasury_movements ADD CONSTRAINT treasury_movements_source_id_fkey FOREIGN KEY (source_id) REFERENCES treasury_accounts(id); END IF; END $$;
DROP TRIGGER IF EXISTS authorize_treasury_movement ON public.treasury_movements; CREATE TRIGGER authorize_treasury_movement BEFORE INSERT ON public.treasury_movements FOR EACH ROW EXECUTE FUNCTION authorize_treasury_movement();
DROP TRIGGER IF EXISTS validate_treasury_movement ON public.treasury_movements; CREATE TRIGGER validate_treasury_movement BEFORE INSERT ON public.treasury_movements FOR EACH ROW EXECUTE FUNCTION validate_treasury_movement();
NOTIFY pgrst, 'reload schema';
