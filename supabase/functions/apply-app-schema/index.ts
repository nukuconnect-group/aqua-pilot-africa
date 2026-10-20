// Applique les champs manquants sur la base de l'application (exécution idempotente, sans suppression de données).
import postgres from 'npm:postgres@3.4.4';

const SQL = `
ALTER TABLE public.feed_stocks ADD COLUMN IF NOT EXISTS stock_purpose text NOT NULL DEFAULT 'production';
ALTER TABLE public.feed_stocks ADD COLUMN IF NOT EXISTS sale_price numeric;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_stocks_stock_purpose_check') THEN
    ALTER TABLE public.feed_stocks ADD CONSTRAINT feed_stocks_stock_purpose_check CHECK (stock_purpose IN ('production','commercial'));
  END IF;
END $$;
UPDATE public.feed_stocks SET stock_purpose = 'commercial' WHERE stock_purpose = 'production' AND notes LIKE '[Stock commercial]%';
NOTIFY pgrst, 'reload schema';
`;

Deno.serve(async () => {
  const url = Deno.env.get('AQUAPILOTE_DB_URL');
  if (!url) return new Response(JSON.stringify({ ok: false, error: 'missing url' }), { status: 500 });
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    await sql.unsafe(SQL);
    const cols = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='feed_stocks' and column_name in ('stock_purpose','sale_price')`;
    return new Response(JSON.stringify({ ok: true, columns: cols.map((c: any) => c.column_name) }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message).replace(/postgres(ql)?:\/\/\S+/g, '[url]') }), { status: 500 });
  } finally {
    await sql.end();
  }
});
