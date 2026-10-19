import { describe, it, expect } from 'vitest';
import { toWhatsappNumber } from '@/lib/whatsappReminder';
import { applyMovement } from '@/components/feeding/StockMovementsPanel';

describe('relances et stock', () => {
  it('numéro local togolais complété avec 228', () => expect(toWhatsappNumber('90 12 34 56')).toBe('22890123456'));
  it('numéro international conservé', () => expect(toWhatsappNumber('+229 97 00 00 00')).toBe('22997000000'));
  it('entrée, sortie et inventaire', () => {
    expect(applyMovement(100, 'in', 25)).toBe(125);
    expect(applyMovement(100, 'out', 30)).toBe(70);
    expect(applyMovement(100, 'adjust', 88)).toBe(88);
  });
});
