import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_OFFERS } from '../subscriptionOffers';
describe('offres AquaPilote', () => {
  it('Petite exploitation coûte 60000 au lieu de 100000', () => expect(SUBSCRIPTION_OFFERS.find(p => p.id === 'annual_basic')).toMatchObject({ annualPrice: 60000, regularPrice: 100000 }));
  it('Petite exploitation couvre une unité', () => expect(SUBSCRIPTION_OFFERS.find(p => p.id === 'annual_basic')?.unitLimit).toBe(1));
  it('Semi-industriel coûte 150000', () => expect(SUBSCRIPTION_OFFERS.find(p => p.id === 'annual_pro')?.annualPrice).toBe(150000));
  it('Semi-industriel couvre trois unités', () => expect(SUBSCRIPTION_OFFERS.find(p => p.id === 'annual_pro')?.unitLimit).toBe(3));
  it('Industriel coûte 850000 par an', () => expect(SUBSCRIPTION_OFFERS.find(p => p.id === 'annual_enterprise')?.annualPrice).toBe(850000));
  it('Industriel ne limite pas le nombre d’unités', () => expect(SUBSCRIPTION_OFFERS.find(p => p.id === 'annual_enterprise')?.unitLimit).toBeNull());
  it('Sur devis ne possède pas de prix inventé', () => expect(SUBSCRIPTION_OFFERS.find(p => p.id === 'custom')?.annualPrice).toBeNull());
});