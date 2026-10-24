import { describe, expect, it } from 'vitest';
import { infrastructureQrValue, resolveInfrastructureQr } from '../infrastructureQr';

describe('Infrastructure QR identity', () => {
  const infrastructure = { id: 'infra-1', unitId: 'unit-1', name: 'Bassin 1' };
  it('keeps the same QR when the name changes', () => {
    expect(infrastructureQrValue({ ...infrastructure, name: 'Bassin renommé' })).toBe(infrastructureQrValue(infrastructure));
  });
  it('assigns distinct codes to distinct infrastructures', () => {
    expect(infrastructureQrValue({ ...infrastructure, id: 'infra-2' })).not.toBe(infrastructureQrValue(infrastructure));
  });
  it('never resolves an infrastructure from another unit', () => {
    expect(resolveInfrastructureQr('unit-2', 'infra-1', [infrastructure])).toBeUndefined();
  });
  it('resolves a cycle ID to the same unit infrastructure QR', () => {
    expect(resolveInfrastructureQr('unit-1', 'cycle-infra', [infrastructure], [{ id: 'cycle-infra', infrastructure_name: 'Bassin 1' }])).toEqual(infrastructure);
  });
  it('refuses ambiguous names rather than using the wrong QR', () => {
    expect(resolveInfrastructureQr('unit-1', 'cycle-infra', [infrastructure, { ...infrastructure, id: 'infra-2' }], [{ id: 'cycle-infra', infrastructure_name: 'Bassin 1' }])).toBeUndefined();
  });
});