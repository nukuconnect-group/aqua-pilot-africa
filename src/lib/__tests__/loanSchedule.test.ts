import { describe, it, expect } from 'vitest';
import { loanSchedule } from '../loanSchedule';

describe('échéancier de prêt', () => {
  it('5 000 000 sur 12 mois donne 12 échéances qui soldent le prêt', () => {
    const s = loanSchedule(5_000_000, 12, '2026-11-01');
    expect(s).toHaveLength(12);
    expect(s.reduce((t, i) => t + i.amount, 0)).toBe(5_000_000);
    expect(s[0].amount).toBe(416_666);
    expect(s[11].remaining).toBe(0);
  });
  it('aucune échéance sans montant ou durée', () => {
    expect(loanSchedule(0, 12, '2026-11-01')).toEqual([]);
    expect(loanSchedule(1000, 0, '2026-11-01')).toEqual([]);
  });
});
