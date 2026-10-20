ALTER FUNCTION public.validate_treasury_movement() SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.validate_treasury_movement() FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.authorize_treasury_movement() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (NEW.user_id=auth.uid() OR public.team_member_has_unit_access(NEW.user_id,NEW.unit_id)) THEN RAISE EXCEPTION 'Mouvement non autorisé'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.authorize_treasury_movement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER authorize_treasury_movement BEFORE INSERT ON public.treasury_movements FOR EACH ROW EXECUTE FUNCTION public.authorize_treasury_movement();