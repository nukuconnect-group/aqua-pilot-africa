import { describe, it, expect } from 'vitest';
import { closingEntry, isBalanced } from '../syscohada';
describe('clôture SYSCOHADA', () => {
  it('solde 6 et 7 vers 131 avec le bon résultat', () => {
    const e = closingEntry([{ account: '702', debit: 0, credit: 1000 }, { account: '602', debit: 300, credit: 0 }, { account: '571', debit: 700, credit: 0 }], '2026-12-31')!;
    expect(isBalanced(e.lines)).toBe(true);
    expect(e.lines.find((l) => l.account === '131')!.credit).toBe(700);
    expect(e.lines.some((l) => l.account === '571')).toBe(false);
  });
  it('refuse une écriture déséquilibrée', () => {
    expect(isBalanced([{ account: '101', debit: 0, credit: 500 }, { account: '571', debit: 400, credit: 0 }])).toBe(false);
  });
});
