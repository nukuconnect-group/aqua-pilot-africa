import postgres from "npm:postgres@3.4.4";
import { sql as ddl } from "./sql.ts";
Deno.serve(async () => {
  const sql = postgres(Deno.env.get("AQUAPILOTE_DB_URL") ?? "", { max: 1, prepare: false, connect_timeout: 10 });
  try {
    await sql.begin(async (tx) => { await tx.unsafe(ddl); });
    const r = await sql`select count(*)::int n from pg_proc where proname='pos_post_sale'`;
    return Response.json({ ok: true, n: r[0].n });
  } catch (e) { return Response.json({ ok: false, error: String((e as Error).message).slice(0, 300) }); }
  finally { await sql.end(); }
});
