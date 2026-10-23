import postgres from "npm:postgres@3.4.4";

Deno.serve(async () => {
  const url = Deno.env.get("AQUAPILOTE_DB_URL") ?? "";
  try {
    const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
    const r = await sql`select table_name from information_schema.tables where table_schema='public' order by 1`;
    await sql.end();
    return Response.json({ ok: true, tables: r.map((x: any) => x.table_name) });
  } catch (e) {
    return Response.json({ ok: false, error: String((e as Error).message).slice(0, 200) });
  }
});
