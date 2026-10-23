import { describe, expect, it } from 'vitest';
import { hasAssignedModule } from '../moduleAccess';
import { computeModuleAccess, DEFAULT_PLANS, DEFAULT_UNIT_MODULE_RULES, FULL_PERMISSIONS, NO_PERMISSIONS } from '../planModules';

describe('AquaAssistant accessible à tous les comptes', () => {
  it.each(DEFAULT_PLANS)('reste accessible avec le forfait $key', (plan) => {
    const access = computeModuleAccess({ ...plan, modules: [], rolePermissions: { user: { 'aqua-assistant': NO_PERMISSIONS } } }, 'user', { userOverrides: { 'aqua-assistant': false } });
    expect(access.allowed.has('aqua-assistant')).toBe(true);
    expect(access.permissions['aqua-assistant']).toEqual(FULL_PERMISSIONS);
  });
  it('reste accessible sans forfait', () => {
    expect(computeModuleAccess(null, 'user').allowed.has('aqua-assistant')).toBe(true);
  });
  it.each(Object.keys(DEFAULT_UNIT_MODULE_RULES))('reste accessible dans l’unité %s', (type) => {
    const activeUnitType = type as keyof typeof DEFAULT_UNIT_MODULE_RULES;
    const access = computeModuleAccess(DEFAULT_PLANS[0], 'operator', { activeUnitType, unitRules: { ...DEFAULT_UNIT_MODULE_RULES, [type]: [] } });
    expect(access.allowed.has('aqua-assistant')).toBe(true);
  });
  it('ne nécessite pas une attribution de module pour un équipier', () => {
    expect(hasAssignedModule('aqua-assistant', () => false)).toBe(true);
    expect(hasAssignedModule('accounting', () => false)).toBe(false);
    expect(hasAssignedModule('sales', () => false)).toBe(false);
  });
});