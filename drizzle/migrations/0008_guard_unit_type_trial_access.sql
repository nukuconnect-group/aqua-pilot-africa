CREATE OR REPLACE FUNCTION public.guard_unit_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed text[];
  current_sub public.subscriptions%ROWTYPE;
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  SELECT s.* INTO current_sub FROM public.subscriptions s
  WHERE s.user_id = NEW.user_id
  ORDER BY CASE
    WHEN s.status = 'active' AND s.start_date <= CURRENT_DATE AND s.end_date >= CURRENT_DATE THEN 0
    WHEN s.status = 'trial' AND s.start_date <= CURRENT_DATE AND s.end_date >= CURRENT_DATE THEN 1
    ELSE 2 END, s.end_date DESC
  LIMIT 1;

  IF current_sub.id IS NOT NULL THEN
    IF current_sub.status NOT IN ('active', 'trial')
       OR current_sub.start_date > CURRENT_DATE OR current_sub.end_date < CURRENT_DATE THEN
      IF TG_OP = 'UPDATE' THEN
        IF NEW.type IS NOT DISTINCT FROM OLD.type AND NEW.is_active = false THEN
          RETURN NEW;
        END IF;
      END IF;
      RAISE EXCEPTION 'Votre essai ou abonnement est terminé. Souscrivez à un abonnement payant pour réactiver vos unités. Vos données sont conservées.' USING ERRCODE = '42501';
    END IF;
    IF current_sub.status = 'trial' THEN RETURN NEW; END IF;
  END IF;

  SELECT p.production_units INTO allowed FROM public.profiles p WHERE p.id = NEW.user_id;
  IF allowed IS NOT NULL AND cardinality(allowed) > 0 AND NOT (NEW.type = ANY(allowed)) THEN
    RAISE EXCEPTION 'Ce type d''unité n''est pas couvert par votre abonnement. Écrivez à l''administration pour étendre votre abonnement.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_unit_type ON public.production_units;
CREATE TRIGGER trg_guard_unit_type
BEFORE INSERT OR UPDATE OF type, is_active ON public.production_units
FOR EACH ROW EXECUTE FUNCTION public.guard_unit_type();