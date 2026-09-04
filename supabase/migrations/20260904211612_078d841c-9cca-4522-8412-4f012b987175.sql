CREATE TABLE IF NOT EXISTS public.feed_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id uuid,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'proteine',
  price_per_kg numeric NOT NULL DEFAULT 0,
  protein_pct numeric NOT NULL DEFAULT 0,
  lipid_pct numeric NOT NULL DEFAULT 0,
  fiber_pct numeric NOT NULL DEFAULT 0,
  energy_kcal_kg numeric NOT NULL DEFAULT 0,
  calcium_pct numeric NOT NULL DEFAULT 0,
  phosphorus_pct numeric NOT NULL DEFAULT 0,
  ash_pct numeric NOT NULL DEFAULT 0,
  moisture_pct numeric NOT NULL DEFAULT 0,
  min_inclusion_pct numeric NOT NULL DEFAULT 0,
  max_inclusion_pct numeric NOT NULL DEFAULT 100,
  stock_kg numeric NOT NULL DEFAULT 0,
  supplier text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_ingredients TO authenticated;
GRANT ALL ON public.feed_ingredients TO service_role;
ALTER TABLE public.feed_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_ingredients_own" ON public.feed_ingredients FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.feed_formulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id uuid,
  name text NOT NULL,
  species text NOT NULL,
  stage text NOT NULL,
  batch_size_kg numeric NOT NULL DEFAULT 100,
  mode text NOT NULL DEFAULT 'balanced',
  targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  nutrition jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_cost numeric NOT NULL DEFAULT 0,
  cost_per_kg numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_formulations TO authenticated;
GRANT ALL ON public.feed_formulations TO service_role;
ALTER TABLE public.feed_formulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_formulations_own" ON public.feed_formulations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.feed_manufacturing_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id uuid,
  formulation_id uuid REFERENCES public.feed_formulations(id) ON DELETE SET NULL,
  formulation_name text NOT NULL,
  batch_number text NOT NULL,
  species text,
  stage text,
  quantity_kg numeric NOT NULL DEFAULT 0,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  nutrition jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_cost numeric NOT NULL DEFAULT 0,
  cost_per_kg numeric NOT NULL DEFAULT 0,
  responsible text,
  status text NOT NULL DEFAULT 'produced',
  stock_transferred boolean NOT NULL DEFAULT false,
  raw_deducted boolean NOT NULL DEFAULT false,
  manufactured_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_manufacturing_batches TO authenticated;
GRANT ALL ON public.feed_manufacturing_batches TO service_role;
ALTER TABLE public.feed_manufacturing_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_batches_own" ON public.feed_manufacturing_batches FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_feed_ingredients_user ON public.feed_ingredients(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_formulations_user ON public.feed_formulations(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_batches_user ON public.feed_manufacturing_batches(user_id);