CREATE OR REPLACE FUNCTION public.check_and_send_stock_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.notify_critical_notification_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.notify_profile_activated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;