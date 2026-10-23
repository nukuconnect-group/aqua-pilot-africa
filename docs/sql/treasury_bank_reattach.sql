-- Mobile Money (55x) accepté comme compte de type banque, et rattachement d'un compte à une autre unité du même propriétaire.
ALTER TABLE public.treasury_accounts DROP CONSTRAINT IF EXISTS treasury_accounts_check;
ALTER TABLE public.treasury_accounts ADD CONSTRAINT treasury_accounts_check CHECK ((kind = 'cash' AND account_code ~ '^57[0-9]+$') OR (kind = 'bank' AND account_code ~ '^5[25][0-9]+$'));

CREATE OR REPLACE FUNCTION public.reattach_treasury_account(_account_id uuid, _unit_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.treasury_accounts; target_owner uuid;
BEGIN
 SELECT * INTO a FROM public.treasury_accounts WHERE id = _account_id FOR UPDATE;
 IF a.id IS NULL OR a.user_id <> auth.uid() THEN RAISE EXCEPTION 'Seul le propriétaire peut rattacher ce compte'; END IF;
 SELECT user_id INTO target_owner FROM public.production_units WHERE id::text = _unit_id;
 IF target_owner IS NULL OR target_owner <> a.user_id THEN RAISE EXCEPTION 'Unité inaccessible'; END IF;
 IF a.unit_id = _unit_id THEN RETURN; END IF;
 IF EXISTS (SELECT 1 FROM public.treasury_accounts WHERE user_id = a.user_id AND unit_id = _unit_id AND account_code = a.account_code) THEN
   RAISE EXCEPTION 'Ce numéro de compte existe déjà dans l’unité choisie';
 END IF;
 IF EXISTS (SELECT 1 FROM public.treasury_movements m WHERE (m.source_id = a.id OR m.destination_id = a.id) AND m.kind = 'transfer') THEN
   RAISE EXCEPTION 'Ce compte a des transferts avec d’autres comptes de son unité : il ne peut pas changer d’unité';
 END IF;
 UPDATE public.treasury_accounts SET unit_id = _unit_id WHERE id = a.id;
 UPDATE public.treasury_movements SET unit_id = _unit_id WHERE source_id = a.id OR destination_id = a.id;
END $$;
REVOKE ALL ON FUNCTION public.reattach_treasury_account(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reattach_treasury_account(uuid, text) TO authenticated;
