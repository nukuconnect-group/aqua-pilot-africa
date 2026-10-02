DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "audit insert" ON public.plan_module_audit;
CREATE POLICY "audit insert" ON public.plan_module_audit FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));