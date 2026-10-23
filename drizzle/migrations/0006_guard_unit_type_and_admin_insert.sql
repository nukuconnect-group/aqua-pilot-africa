CREATE OR REPLACE FUNCTION public.guard_unit_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  allowed text[];
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT p.production_units INTO allowed
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF allowed IS NOT NULL
     AND array_length(allowed, 1) IS NOT NULL
     AND NOT (NEW.type = ANY(allowed)) THEN
    RAISE EXCEPTION 'Ce type d''unité n''est pas couvert par votre abonnement. Écrivez à l''administration pour étendre votre abonnement.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_guard_unit_type
BEFORE INSERT OR UPDATE OF type ON public.production_units
FOR EACH ROW
EXECUTE FUNCTION public.guard_unit_type();

CREATE POLICY "Admins can create production units"
ON public.production_units
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));