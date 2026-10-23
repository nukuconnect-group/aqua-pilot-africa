import postgres from "npm:postgres@3.4.4";
import { sql as ddl } from "./sql.ts";
Deno.serve(async () => {
  const sql = postgres(Deno.env.get("AQUAPILOTE_DB_URL") ?? "", { max: 1, prepare: false, connect_timeout: 10 });
  try {
    await sql.begin(async (tx) => { await tx.unsafe(ddl); });
    const r = await sql`select policyname from pg_policies where tablename in ('cash_sessions','cash_movements')`;
    return Response.json({ ok: true, policies: r.map((x: any) => x.policyname) });
  } catch (e) { return Response.json({ ok: false, error: String((e as Error).message).slice(0, 300) }); }
  finally { await sql.end(); }
});
