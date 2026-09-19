CREATE TABLE IF NOT EXISTS public.plans (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  billing_period text NOT NULL DEFAULT 'monthly',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans readable" ON public.plans;
CREATE POLICY "plans readable" ON public.plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "plans admin write" ON public.plans;
CREATE POLICY "plans admin write" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.plan_modules (
  plan_key text NOT NULL,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_key, module_key)
);
GRANT SELECT ON public.plan_modules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_modules TO authenticated;
GRANT ALL ON public.plan_modules TO service_role;
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plan_modules readable" ON public.plan_modules;
CREATE POLICY "plan_modules readable" ON public.plan_modules FOR SELECT USING (true);
DROP POLICY IF EXISTS "plan_modules admin write" ON public.plan_modules;
CREATE POLICY "plan_modules admin write" ON public.plan_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.unit_type_module_rules (
  unit_type text NOT NULL,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (unit_type, module_key)
);
GRANT SELECT ON public.unit_type_module_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_type_module_rules TO authenticated;
GRANT ALL ON public.unit_type_module_rules TO service_role;
ALTER TABLE public.unit_type_module_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unit rules readable" ON public.unit_type_module_rules;
CREATE POLICY "unit rules readable" ON public.unit_type_module_rules FOR SELECT USING (true);
DROP POLICY IF EXISTS "unit rules admin write" ON public.unit_type_module_rules;
CREATE POLICY "unit rules admin write" ON public.unit_type_module_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.user_module_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_overrides TO authenticated;
GRANT ALL ON public.user_module_overrides TO service_role;
ALTER TABLE public.user_module_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "overrides self read" ON public.user_module_overrides;
CREATE POLICY "overrides self read" ON public.user_module_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "overrides admin write" ON public.user_module_overrides;
CREATE POLICY "overrides admin write" ON public.user_module_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.plan_module_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text,
  plan_key text,
  module_key text,
  action text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.plan_module_audit TO authenticated;
GRANT ALL ON public.plan_module_audit TO service_role;
ALTER TABLE public.plan_module_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit admin read" ON public.plan_module_audit;
CREATE POLICY "audit admin read" ON public.plan_module_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "audit insert" ON public.plan_module_audit;
CREATE POLICY "audit insert" ON public.plan_module_audit FOR INSERT TO authenticated WITH CHECK (true);