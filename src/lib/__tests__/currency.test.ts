import { describe, it, expect } from 'vitest';
import { convertAmount, formatMoney } from '../currency';

describe('conversion de devise', () => {
  it('convertit les F CFA en euros au taux fixe', () => {
    expect(convertAmount(655.957, 'XOF', 'EUR')).toBeCloseTo(1, 5);
  });

  it('convertit les F CFA en dollars', () => {
    expect(convertAmount(600, 'XOF', 'USD')).toBeCloseTo(1, 5);
  });

  it('laisse le montant inchangé dans la même devise', () => {
    expect(convertAmount(1000, 'XOF', 'XOF')).toBe(1000);
  });

  it('formatMoney convertit le montant XOF dans la devise demandée', () => {
    // 655 957 F CFA ≈ 1 000 €
    expect(formatMoney(655957, 'EUR')).toBe('1 000,00 €');
  });

  it('formatMoney garde les F CFA sans décimales', () => {
    expect(formatMoney(1500, 'XOF')).toBe('1 500 F CFA');
  });
});
