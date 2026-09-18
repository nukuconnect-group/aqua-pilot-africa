CREATE TABLE public.feed_quality_controls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unit_id TEXT,
  control_type TEXT NOT NULL DEFAULT 'raw_material',
  item_name TEXT NOT NULL,
  batch_number TEXT,
  supplier TEXT,
  control_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'conforme',
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  anomaly TEXT,
  corrective_action TEXT,
  responsible TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_quality_controls TO authenticated;
GRANT ALL ON public.feed_quality_controls TO service_role;
ALTER TABLE public.feed_quality_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feed quality controls" ON public.feed_quality_controls FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_feed_quality_controls_updated_at BEFORE UPDATE ON public.feed_quality_controls FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.feed_production_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unit_id TEXT,
  name TEXT NOT NULL,
  formulation_id TEXT,
  formulation_name TEXT,
  planned_quantity_kg NUMERIC NOT NULL DEFAULT 0,
  produced_quantity_kg NUMERIC NOT NULL DEFAULT 0,
  loss_kg NUMERIC NOT NULL DEFAULT 0,
  consumed_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  cost_per_kg NUMERIC NOT NULL DEFAULT 0,
  batch_number TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_production_cycles TO authenticated;
GRANT ALL ON public.feed_production_cycles TO service_role;
ALTER TABLE public.feed_production_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feed production cycles" ON public.feed_production_cycles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_feed_production_cycles_updated_at BEFORE UPDATE ON public.feed_production_cycles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.traceability_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unit_id TEXT,
  batch_number TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'feed',
  product_name TEXT,
  origin TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_label TEXT NOT NULL DEFAULT 'kg',
  state TEXT NOT NULL DEFAULT 'en_stock',
  destination TEXT,
  movements JSONB NOT NULL DEFAULT '[]'::jsonb,
  controls JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traceability_records TO authenticated;
GRANT ALL ON public.traceability_records TO service_role;
ALTER TABLE public.traceability_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own traceability records" ON public.traceability_records FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_traceability_records_updated_at BEFORE UPDATE ON public.traceability_records FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();