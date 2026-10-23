-- Suppression (archivage) des comptes de trésorerie : l'historique et les écritures restent conservés.
ALTER TABLE public.treasury_accounts ADD COLUMN IF NOT EXISTS archived_at timestamptz;
GRANT UPDATE (archived_at) ON public.treasury_accounts TO authenticated;
DROP POLICY IF EXISTS treasury_accounts_archive ON public.treasury_accounts;
CREATE POLICY treasury_accounts_archive ON public.treasury_accounts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
NOTIFY pgrst, 'reload schema';
