ALTER TABLE public.feed_stocks ADD COLUMN IF NOT EXISTS stock_purpose text NOT NULL DEFAULT 'production';
ALTER TABLE public.feed_stocks ADD COLUMN IF NOT EXISTS sale_price numeric;
ALTER TABLE public.feed_stocks DROP CONSTRAINT IF EXISTS feed_stocks_stock_purpose_check;
ALTER TABLE public.feed_stocks ADD CONSTRAINT feed_stocks_stock_purpose_check CHECK (stock_purpose IN ('production','commercial'));
COMMENT ON COLUMN public.feed_stocks.stock_purpose IS 'production = intrant consommé par l''exploitation ; commercial = article vendable en caisse';