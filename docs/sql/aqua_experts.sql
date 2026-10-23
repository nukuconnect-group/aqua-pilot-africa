-- Annuaire des experts, consultants et techniciens en aquaculture
CREATE TABLE IF NOT EXISTS public.aqua_experts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  specialty text NOT NULL DEFAULT 'Expert en aquaculture',
  organization text,
  country text,
  city text,
  phone text,
  whatsapp text,
  email text,
  services text,
  provides_products boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.aqua_experts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.aqua_experts TO authenticated;
GRANT ALL ON public.aqua_experts TO service_role;
ALTER TABLE public.aqua_experts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "experts read" ON public.aqua_experts;
DROP POLICY IF EXISTS "experts admin manage" ON public.aqua_experts;
CREATE POLICY "experts read" ON public.aqua_experts FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "experts admin manage" ON public.aqua_experts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
NOTIFY pgrst, 'reload schema';
