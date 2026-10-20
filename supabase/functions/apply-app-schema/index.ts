// Applique les champs manquants sur la base de l'application (exécution idempotente, sans suppression de données).
import postgres from 'npm:postgres@3.4.4';

const EXTRA = `
UPDATE public.feed_stocks SET stock_purpose = 'commercial' WHERE stock_purpose = 'production' AND notes LIKE '[Stock commercial]%';
`;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const url = Deno.env.get('AQUAPILOTE_DB_URL');
  if (!url) return new Response(JSON.stringify({ ok: false, error: 'missing url' }), { status: 500 });
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    const install = await Deno.readTextFile(new URL('./install.sql', import.meta.url));
    await sql.begin(async (tx: any) => { await tx.unsafe(install); await tx.unsafe(EXTRA); });
    const cols = await sql`select table_name from information_schema.columns where table_schema='public' and table_name in ('cash_sessions','cash_movements','stock_movements','treasury_accounts') group by 1`;
    return new Response(JSON.stringify({ ok: true, columns: cols.map((c: any) => c.table_name) }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message).replace(/postgres(ql)?:\/\/\S+/g, '[url]') }), { status: 500 });
  } finally {
    await sql.end();
  }
});
