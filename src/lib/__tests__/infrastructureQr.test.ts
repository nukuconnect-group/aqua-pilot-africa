import { describe, expect, it } from 'vitest';
import { infrastructureQrValue, resolveInfrastructureQr } from '../infrastructureQr';

describe('Infrastructure QR identity', () => {
  const infrastructure = { id: 'infra-1', unitId: 'unit-1', name: 'Bassin 1' };
  it('keeps the persisted identity when the name changes and updates its readable name', () => {
    const payload = JSON.parse(infrastructureQrValue({ ...infrastructure, name: 'Bassin renommé' }));
    expect(payload.infrastructureId).toBe('infra-1');
    expect(payload.unitId).toBe('unit-1');
    expect(payload.name).toBe('Bassin renommé');
  });
  it('includes only the saved number, name and readable type, not private specifications', () => {
    const payload = JSON.parse(infrastructureQrValue({ ...infrastructure, type: 'cage_flottante', specifications: { number: 'C-07', attachedBatchId: 'private-batch' } }));
    expect(payload.number).toBe('C-07');
    expect(payload.name).toBe('Bassin 1');
    expect(payload.infrastructureType).toBeTruthy();
    expect(payload.attachedBatchId).toBeUndefined();
  });
  it('never invents a number when none is saved', () => {
    expect(JSON.parse(infrastructureQrValue(infrastructure)).number).toBeUndefined();
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