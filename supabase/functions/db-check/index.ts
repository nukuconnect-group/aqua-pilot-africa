import postgres from "npm:postgres@3.4.4";

import { schema, grants } from "./sql.ts";

Deno.serve(async () => {
  const sql = postgres(Deno.env.get("AQUAPILOTE_DB_URL") ?? "", { max: 1, prepare: false, connect_timeout: 10 });
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(schema);
      await tx.unsafe(grants);
      await tx.unsafe("NOTIFY pgrst, 'reload schema'");
    });
    const r = await sql`select count(*)::int n from information_schema.tables where table_schema='public'`;
    return Response.json({ ok: true, tables: r[0].n });
  } catch (e) {
    return Response.json({ ok: false, error: String((e as Error).message).slice(0, 400) });
  } finally {
    await sql.end();
  }
});
