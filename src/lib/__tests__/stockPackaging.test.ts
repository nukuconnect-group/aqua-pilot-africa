import { describe, it, expect } from 'vitest';
import { totalKgFromBags, costPerKgFromBag, costPerBagFromKg } from '../stockPackaging';

describe('stockPackaging', () => {
  it('20 sacs de 25 kg = 500 kg', () => {
    expect(totalKgFromBags(20, 25)).toBe(500);
  });
  it('sac de 15 kg à 15 000 F = 1 000 F/kg', () => {
    expect(costPerKgFromBag(15000, 15)).toBe(1000);
  });
  it('1 000 F/kg pour un sac de 20 kg = 20 000 F le sac', () => {
    expect(costPerBagFromKg(1000, 20)).toBe(20000);
  });
  it('sans poids de sac, aucun calcul', () => {
    expect(totalKgFromBags(20, 0)).toBe(0);
    expect(costPerKgFromBag(15000, 0)).toBe(0);
  });
});
