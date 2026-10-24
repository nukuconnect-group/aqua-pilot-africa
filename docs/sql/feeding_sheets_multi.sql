-- Fiches d'alimentation : plusieurs infrastructures et plusieurs périodes par fiche.
-- À installer sur la base historique de l'application (éditeur SQL).
-- Sans ce script, l'application continue de fonctionner avec une seule infrastructure
-- et une seule période par fiche (repli automatique).

ALTER TABLE public.feeding_sheets ADD COLUMN IF NOT EXISTS infrastructure_ids uuid[];
ALTER TABLE public.feeding_sheets ADD COLUMN IF NOT EXISTS period_times jsonb;

UPDATE public.feeding_sheets
SET infrastructure_ids = ARRAY[infrastructure_id]
WHERE infrastructure_id IS NOT NULL AND infrastructure_ids IS NULL;

UPDATE public.feeding_sheets
SET period_times = jsonb_build_array(jsonb_build_object('period', period, 'time', time::text))
WHERE period_times IS NULL;

COMMENT ON COLUMN public.feeding_sheets.infrastructure_ids IS 'Plusieurs infrastructures par fiche (remplace infrastructure_id)';
COMMENT ON COLUMN public.feeding_sheets.period_times IS 'Périodes de nourrissage avec heure: [{period, time}]';
COMMENT ON COLUMN public.feeding_sheets.infrastructure_id IS 'DEPRECATED: remplacé par infrastructure_ids';
COMMENT ON COLUMN public.feeding_sheets.period IS 'DEPRECATED: remplacé par period_times (première période conservée pour compatibilité)';
