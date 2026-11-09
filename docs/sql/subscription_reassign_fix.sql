-- Reassigning/extending a subscription must unlock the account immediately.
-- 1) Current subscription = a valid one (in period, trial/active) first, newest end first.
CREATE OR REPLACE FUNCTION public.get_current_subscription(_user_id uuid)
 RETURNS TABLE(id uuid, plan text, status text, start_date date, end_date date, days_remaining integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_target uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF public.has_role(v_caller, 'admin'::app_role) THEN
    v_target := COALESCE(_user_id, v_caller);
  ELSE
    v_target := v_caller;
  END IF;
  RETURN QUERY
  SELECT s.id, s.plan, s.status, s.start_date, s.end_date,
         GREATEST(0, (s.end_date - CURRENT_DATE))::integer
  FROM public.subscriptions s
  WHERE s.user_id = v_target
  ORDER BY
    CASE WHEN s.status IN ('active','trial') AND s.start_date <= CURRENT_DATE AND s.end_date >= CURRENT_DATE THEN 0 ELSE 1 END,
    CASE s.status WHEN 'active' THEN 1 WHEN 'trial' THEN 2 WHEN 'expired' THEN 3 ELSE 4 END,
    s.end_date DESC, s.created_at DESC
  LIMIT 1;
END;
$function$;

-- 2) Extending counts from today when already expired, reactivates, and unlocks the profile.
CREATE OR REPLACE FUNCTION public.extend_subscription(_subscription_id uuid, _days integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can extend subscriptions';
  END IF;
  UPDATE public.subscriptions
  SET end_date = GREATEST(end_date, CURRENT_DATE - 1) + _days,
      start_date = LEAST(start_date, CURRENT_DATE),
      status = CASE WHEN status IN ('expired','suspended','cancelled')
                    THEN CASE WHEN plan = 'trial_discovery' THEN 'trial' ELSE 'active' END
                    ELSE status END,
      updated_at = now()
  WHERE id = _subscription_id
  RETURNING user_id INTO v_user;
  IF v_user IS NOT NULL THEN
    UPDATE public.profiles
    SET is_suspended = false, suspension_reason = NULL, suspended_at = NULL, is_activated = true
    WHERE id = v_user;
  END IF;
END;
$function$;
