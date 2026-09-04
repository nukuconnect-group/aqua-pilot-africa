CREATE OR REPLACE FUNCTION public.__replay_exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  EXECUTE sql;
END;
$fn$;
REVOKE ALL ON FUNCTION public.__replay_exec(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__replay_exec(text) TO anon;