import { describe, expect, it } from 'vitest';
import { computeModuleAccess, DEFAULT_PLANS, DEFAULT_UNIT_MODULE_RULES, enforceUnitTypeRestrictions, MODULE_CATALOG } from '../planModules';
import { stockPurposeForUnit, stocksForUnitType } from '../stockPurpose';

describe('Commercialisation rules', () => {
  it.each(['livestock', 'health', 'aquahealth'])('never enables %s through stale configuration or user overrides', (module) => {
    expect(DEFAULT_UNIT_MODULE_RULES.commercialisation).not.toContain(module);
    const all = MODULE_CATALOG.map(m => m.key);
    expect(enforceUnitTypeRestrictions('commercialisation', all).has(module)).toBe(false);
    const plan = DEFAULT_PLANS.find(p => p.key === 'enterprise');
    if (!plan) throw new Error('Enterprise plan missing');
    expect(computeModuleAccess(plan, 'owner', {
      activeUnitType: 'commercialisation',
      unitRules: { ...DEFAULT_UNIT_MODULE_RULES, commercialisation: all },
      userOverrides: { [module]: true },
    }).allowed.has(module)).toBe(false);
  });
  it('shows only commercial items without changing stored inventory', () => {
    const stocks = [
      { id: 'production', stock_purpose: 'production', notes: null },
      { id: 'commercial', stock_purpose: 'commercial', notes: null },
      { id: 'legacy', stock_purpose: null, notes: '[Stock commercial] Prix de vente: 500' },
    ];
    expect(stocksForUnitType(stocks, 'commercialisation').map(s => s.id)).toEqual(['commercial', 'legacy']);
    expect(stocks[0].stock_purpose).toBe('production');
    expect(stocksForUnitType(stocks, 'grossissement')).toEqual(stocks);
  });
  it.each(['production', '', null] as const)('forces commercial for new/imported/restored purpose %s', (purpose) => {
    expect(stockPurposeForUnit('commercialisation', purpose)).toBe('commercial');
    expect(stockPurposeForUnit('grossissement', purpose)).toBe(purpose);
  });
});