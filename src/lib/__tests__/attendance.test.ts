import { describe, it, expect } from 'vitest';
import { dailySummary, distanceMeters } from '@/lib/attendance';

describe('pointage', () => {
  it('retard de 25 min et 30 min d’heures sup.', () => {
    const r = dailySummary([new Date(2026, 9, 19, 8, 25)], [new Date(2026, 9, 19, 17, 30)], '08:00', '17:00', true);
    expect(r.lateMinutes).toBe(25);
    expect(r.overtimeMinutes).toBe(30);
    expect(r.missingOut).toBe(false);
  });
  it('oubli de sortie sur une journée passée', () => {
    expect(dailySummary([new Date(2026, 9, 18, 8, 0)], [], '08:00', '17:00', true).missingOut).toBe(true);
  });
  it('distance d’environ 111 m pour 0,001° de latitude', () => {
    expect(Math.round(distanceMeters({ lat: 6.13, lng: 1.22 }, { lat: 6.131, lng: 1.22 }))).toBe(111);
  });
});
