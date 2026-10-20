-- Séparation stock de production / stock commercial (à exécuter sur la base de l'application).
-- Sans ces colonnes, l'application conserve la destination dans les notes de l'article.
ALTER TABLE public.feed_stocks ADD COLUMN IF NOT EXISTS stock_purpose text NOT NULL DEFAULT 'production';
ALTER TABLE public.feed_stocks ADD COLUMN IF NOT EXISTS sale_price numeric;
ALTER TABLE public.feed_stocks DROP CONSTRAINT IF EXISTS feed_stocks_stock_purpose_check;
ALTER TABLE public.feed_stocks ADD CONSTRAINT feed_stocks_stock_purpose_check CHECK (stock_purpose IN ('production','commercial'));
