import { describe, it, expect } from 'vitest';
import { buildEntries } from '@/lib/syscohada';
import { isSaleMirror } from '@/hooks/useFinancialSummary';

const sale = { id: 's1', date: '2026-10-23', clientName: 'Client', totalAmount: 70690, paymentMethod: 'Espèces', status: 'paid' };

describe('écritures de vente SYSCOHADA', () => {
  it('vente espèces : 411/701 puis 571/411', () => {
    const e = buildEntries([sale], [], []);
    expect(e[0].lines).toEqual([{ account: '411', debit: 70690, credit: 0 }, { account: '701', debit: 0, credit: 70690 }]);
    expect(e[1].lines).toEqual([{ account: '571', debit: 70690, credit: 0 }, { account: '411', debit: 0, credit: 70690 }]);
  });
  it('annulation : écritures inverses datées', () => {
    const e = buildEntries([{ ...sale, status: 'cancelled', statusBeforeCancellation: 'paid', cancelledAt: '2026-10-24T10:00:00Z', cancellationReason: 'erreur' }], [], []);
    expect(e).toHaveLength(4);
    expect(e[2].lines).toEqual([{ account: '411', debit: 0, credit: 70690 }, { account: '701', debit: 70690, credit: 0 }]);
    expect(e[3].date).toBe('2026-10-24');
  });
  it("l'écriture miroir d'une vente n'est pas recomptée au chiffre d'affaires", () => {
    expect(isSaleMirror({ category: 'Vente de poissons', description: 'Vente à Client comptoir' })).toBe(true);
    expect(isSaleMirror({ category: 'Subvention', description: 'Aide' })).toBe(false);
  });
});
