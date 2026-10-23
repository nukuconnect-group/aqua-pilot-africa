import { describe, expect, it } from 'vitest';
import { DEFAULT_UNIT_MODULE_RULES, DEFAULT_PLANS } from '@/lib/planModules';

describe('Ventes dans toutes les unités', () => {
  it.each(Object.keys(DEFAULT_UNIT_MODULE_RULES))('l’unité %s comporte Ventes et Comptabilité', (type) => {
    const modules = DEFAULT_UNIT_MODULE_RULES[type as keyof typeof DEFAULT_UNIT_MODULE_RULES];
    expect(modules).toContain('sales');
    expect(modules).toContain('accounting');
  });
  it('les forfaits qui incluent Ventes incluent aussi Comptabilité', () => {
    DEFAULT_PLANS.filter((p) => p.modules.includes('sales')).forEach((p) => expect(p.modules).toContain('accounting'));
  });
});
