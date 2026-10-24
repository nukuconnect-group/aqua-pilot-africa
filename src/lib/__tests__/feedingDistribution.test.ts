import { describe, expect, it } from 'vitest';
import { feedingBalance, matchesFeedingStock } from '../feedingDistribution';

describe('nourrissage et retours', () => {
  it('20 kg prélevés, 15 kg servis : retour de 5 kg, consommation nette de 15 kg', () => {
    const balance = feedingBalance(20, 15);
    expect(balance.returned).toBe(5);
    expect(100 - balance.taken + balance.returned).toBe(85);
  });
  it('ne permet pas de servir plus que le prélèvement', () => {
    expect(() => feedingBalance(20, 21)).toThrow();
  });
  it('retourne tout le prélèvement si rien n’est servi', () => {
    expect(feedingBalance(20, 0).returned).toBe(20);
  });
  it('ne prélève jamais le stock d’une autre unité', () => {
    expect(matchesFeedingStock({ unit_id: 'b', feed_type: 'Granulé' }, 'a', 'Granulé')).toBe(false);
  });
  it('ne prélève jamais le stock commercial', () => {
    expect(matchesFeedingStock({ unit_id: 'a', feed_type: 'Granulé', stock_purpose: 'commercial' }, 'a', 'Granulé')).toBe(false);
  });
  it('retrouve automatiquement l’aliment de production par son nom', () => {
    expect(matchesFeedingStock({ unit_id: 'a', custom_name: ' Granulé ' }, 'a', 'granulé')).toBe(true);
  });
});