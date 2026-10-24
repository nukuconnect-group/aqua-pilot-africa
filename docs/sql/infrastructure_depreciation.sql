-- Historical application backend. No new tables or destructive changes.
-- An infrastructure stores only the link and user-entered configuration in its existing specifications.
-- Invoker trigger keeps the existing infrastructure/asset RLS and commits both writes together.
BEGIN;
CREATE OR REPLACE FUNCTION public.sync_infrastructure_depreciation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  config jsonb;
  asset_id uuid;
  price numeric;
  years integer;
  service_date date;
  asset_currency text;
BEGIN
  config := NEW.specifications->'depreciation';
  IF TG_OP = 'UPDATE' AND OLD.specifications->>'depreciationAssetId' IS NOT NULL THEN
    NEW.specifications := jsonb_set(NEW.specifications,'{depreciationAssetId}',OLD.specifications->'depreciationAssetId');
    IF NEW.unit_id IS DISTINCT FROM OLD.unit_id THEN
      RAISE EXCEPTION 'Conservez l’unité de l’infrastructure liée à un amortissement';
    END IF;
    IF config IS NOT DISTINCT FROM OLD.specifications->'depreciation' THEN
      IF NEW.name IS DISTINCT FROM OLD.name THEN
        UPDATE public.depreciable_assets SET name=NEW.name WHERE id=(OLD.specifications->>'depreciationAssetId')::uuid AND user_id=NEW.user_id;
      END IF;
      RETURN NEW;
    END IF;
    IF config IS NULL OR config = 'null'::jsonb THEN RAISE EXCEPTION 'Conservez le rattachement de l’amortissement'; END IF;
  END IF;
  IF config IS NULL OR config = 'null'::jsonb THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR auth.uid() <> NEW.user_id THEN
    RAISE EXCEPTION 'Amortissement réservé au propriétaire de l’infrastructure';
  END IF;
  price := (config->>'purchasePrice')::numeric;
  years := (config->>'usefulLife')::integer;
  service_date := (config->>'purchaseDate')::date;
  asset_currency := config->>'currency';
  IF price IS NULL OR price <= 0 OR years IS NULL OR years < 1 OR years > 50 OR service_date IS NULL
     OR asset_currency IS NULL OR asset_currency NOT IN ('XOF','EUR','USD','MAD') OR config->>'method' IS DISTINCT FROM 'linear' THEN
    RAISE EXCEPTION 'Renseignez le coût, la date, la durée et la devise de l’amortissement linéaire';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.specifications->>'depreciationAssetId' IS NOT NULL THEN
    asset_id := (OLD.specifications->>'depreciationAssetId')::uuid;
  ELSE
    asset_id := gen_random_uuid();
  END IF;
  IF EXISTS (SELECT 1 FROM public.depreciable_assets WHERE id=asset_id AND (user_id <> NEW.user_id OR unit_id IS DISTINCT FROM NEW.unit_id)) THEN
    RAISE EXCEPTION 'Amortissement rattaché à une autre unité';
  END IF;
  INSERT INTO public.depreciable_assets(id,user_id,unit_id,name,category,purchase_price,currency,purchase_date,depreciation_method,useful_life,current_value,accumulated_depreciation,status)
  VALUES(asset_id,NEW.user_id,NEW.unit_id,NEW.name,'Installations techniques',price,asset_currency,service_date,'linear',years,price,0,'active')
  ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, purchase_price=EXCLUDED.purchase_price,
    currency=EXCLUDED.currency,purchase_date=EXCLUDED.purchase_date,useful_life=EXCLUDED.useful_life,
    depreciation_method=EXCLUDED.depreciation_method;
  NEW.specifications := jsonb_set(NEW.specifications,'{depreciationAssetId}',to_jsonb(asset_id::text));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_infrastructure_depreciation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_infrastructure_depreciation() TO authenticated,service_role;
DROP TRIGGER IF EXISTS infrastructure_depreciation_sync ON public.unit_infrastructures;
CREATE TRIGGER infrastructure_depreciation_sync BEFORE INSERT OR UPDATE ON public.unit_infrastructures
FOR EACH ROW EXECUTE FUNCTION public.sync_infrastructure_depreciation();
COMMIT;