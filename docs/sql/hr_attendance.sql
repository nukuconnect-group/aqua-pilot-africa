-- AquaPilote — Pointage du personnel (à exécuter une fois sur le serveur de l'application)
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id text,
  employee_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('in','out')),
  recorded_at timestamptz NOT NULL,
  latitude double precision,
  longitude double precision,
  distance_m numeric,
  inside_zone boolean,
  photo_path text,
  client_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance owner or team read" ON public.attendance_records FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_member_of(user_id));
CREATE POLICY "attendance owner or team insert" ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_team_member_of(user_id));
