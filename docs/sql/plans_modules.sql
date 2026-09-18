-- AquaPilote — Gestion des modules par abonnement
-- À exécuter une seule fois dans l'éditeur SQL du projet Supabase utilisé par l'application.

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  billing_period text NOT NULL DEFAULT 'yearly',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_read" ON public.plans;
CREATE POLICY "plans_read" ON public.plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "plans_admin_write" ON public.plans;
CREATE POLICY "plans_admin_write" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.plan_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL REFERENCES public.plans(key) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_key, module_key)
);
GRANT SELECT ON public.plan_modules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.plan_modules TO authenticated;
GRANT ALL ON public.plan_modules TO service_role;
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_modules_read" ON public.plan_modules;
CREATE POLICY "plan_modules_read" ON public.plan_modules FOR SELECT USING (true);
DROP POLICY IF EXISTS "plan_modules_admin_write" ON public.plan_modules;
CREATE POLICY "plan_modules_admin_write" ON public.plan_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.plan_module_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text,
  plan_key text NOT NULL,
  module_key text NOT NULL,
  action text NOT NULL,
  before_value text,
  after_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.plan_module_audit TO authenticated;
GRANT ALL ON public.plan_module_audit TO service_role;
ALTER TABLE public.plan_module_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_audit_admin" ON public.plan_module_audit;
CREATE POLICY "plan_audit_admin" ON public.plan_module_audit FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      JOIN public.plan_modules pm ON pm.plan_key = COALESCE(
        (SELECT p.key FROM public.plans p WHERE p.key = s.plan),
        CASE s.plan
          WHEN 'trial_discovery' THEN 'professional'
          WHEN 'annual_basic' THEN 'standard'
          WHEN 'annual_pro' THEN 'professional'
          WHEN 'annual_enterprise' THEN 'enterprise'
          ELSE 'free' END)
      WHERE s.user_id = _user_id
        AND s.status IN ('active','trial')
        AND s.end_date >= CURRENT_DATE
        AND pm.module_key = _module_key
        AND pm.enabled);
$$;
GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, text) TO authenticated, anon;

INSERT INTO public.plans (key, name, description, price, billing_period, sort_order) VALUES
  ('free','Plan Gratuit','Découverte limitée',0,'free',0),
  ('standard','Plan Standard','Exploitation et gestion de base',0,'yearly',1),
  ('professional','Plan Professionnel','Gestion complète + intelligence',0,'yearly',2),
  ('enterprise','Plan Entreprise','Tous les modules AquaPilote',0,'yearly',3)
ON CONFLICT (key) DO NOTHING;
