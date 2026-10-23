-- EAN-13 interne (préfixe 20, usage en magasin) attribué automatiquement à chaque article de stock.
ALTER TABLE public.feed_stocks ADD COLUMN IF NOT EXISTS barcode text;
CREATE SEQUENCE IF NOT EXISTS public.feed_stock_ean_seq START 1;

CREATE OR REPLACE FUNCTION public.ean13_with_check(_base12 text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT _base12 || ((10 - (SELECT sum(substr(_base12, i, 1)::int * CASE WHEN i % 2 = 0 THEN 3 ELSE 1 END) FROM generate_series(1, 12) i) % 10) % 10)::text
$$;

CREATE OR REPLACE FUNCTION public.assign_stock_barcode()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.barcode IS NULL OR length(trim(NEW.barcode)) = 0 THEN
    NEW.barcode := public.ean13_with_check('20' || lpad(nextval('public.feed_stock_ean_seq')::text, 10, '0'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS assign_stock_barcode ON public.feed_stocks;
CREATE TRIGGER assign_stock_barcode BEFORE INSERT ON public.feed_stocks FOR EACH ROW EXECUTE FUNCTION public.assign_stock_barcode();

UPDATE public.feed_stocks SET barcode = public.ean13_with_check('20' || lpad(nextval('public.feed_stock_ean_seq')::text, 10, '0'))
WHERE barcode IS NULL OR length(trim(barcode)) = 0;

CREATE UNIQUE INDEX IF NOT EXISTS feed_stocks_barcode_key ON public.feed_stocks (barcode);
