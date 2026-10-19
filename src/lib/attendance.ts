/** Distance en mètres entre deux points GPS (formule de haversine). */
export const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };

/** Retard, heures sup. et oubli de sortie pour une journée. */
export const dailySummary = (ins: Date[], outs: Date[], start: string, end: string, isPastDay: boolean) => {
  const first = ins.length ? new Date(Math.min(...ins.map(Number))) : null;
  const last = outs.length ? new Date(Math.max(...outs.map(Number))) : null;
  const mins = (d: Date) => d.getHours() * 60 + d.getMinutes();
  return {
    lateMinutes: first ? Math.max(0, mins(first) - toMin(start)) : 0,
    overtimeMinutes: last ? Math.max(0, mins(last) - toMin(end)) : 0,
    missingOut: !!first && !last && isPastDay,
    absent: !first,
  };
};
