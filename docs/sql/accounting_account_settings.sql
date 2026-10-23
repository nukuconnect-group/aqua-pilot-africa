-- Numéros et libellés de comptes personnalisés par l'équipe comptable (remplacent l'affichage du plan SYSCOHADA par défaut).
CREATE TABLE IF NOT EXISTS public.accounting_account_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  default_code text NOT NULL,
  custom_code text NOT NULL CHECK (custom_code ~ '^[1-9][0-9]{1,9}$'),
  custom_label text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, default_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_account_settings TO authenticated;
GRANT ALL ON public.accounting_account_settings TO service_role;
ALTER TABLE public.accounting_account_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner and team read account settings" ON public.accounting_account_settings;
CREATE POLICY "Owner and team read account settings" ON public.accounting_account_settings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_member_of(user_id));
DROP POLICY IF EXISTS "Owner manages account settings" ON public.accounting_account_settings;
CREATE POLICY "Owner manages account settings" ON public.accounting_account_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
