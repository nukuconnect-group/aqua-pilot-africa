import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import {
  AUTO_ENABLED_KEY,
  generateDailyJournals,
  isoDate,
} from '@/lib/farmJournal';

/** Heure locale à partir de laquelle la journée est considérée terminée. */
const END_OF_DAY_HOUR = 20;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Planificateur "calendrier" du journal de ferme :
 * - à la fin de chaque journée (>= 20h locale), génère le journal du jour par unité ;
 * - au démarrage, rattrape la veille si elle n'a jamais été générée.
 */
export const useDailyFarmJournal = () => {
  const { user } = useAuth();
  const { units } = useProductionUnits();
  const running = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    if (localStorage.getItem(AUTO_ENABLED_KEY) === 'off') return;

    const tick = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const now = new Date();
        const dates: string[] = [];

        // Rattrapage de la veille (journée terminée)
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        dates.push(isoDate(yesterday));

        // Journée en cours une fois la journée terminée
        if (now.getHours() >= END_OF_DAY_HOUR) dates.push(isoDate(now));

        const unitList = units.map(u => ({ id: u.id, name: u.name }));
        for (const date of dates) {
          await generateDailyJournals(unitList, user.id, date);
        }
      } catch (e) {
        console.error('Planificateur journal de ferme', e);
      } finally {
        running.current = false;
      }
    };

    const timeout = setTimeout(tick, 4000);
    const interval = setInterval(tick, CHECK_INTERVAL_MS);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [user?.id, units]);
};
