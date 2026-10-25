import { describe, expect, it, vi } from 'vitest';
import { createUnitBackup, readUnitBackup } from '../unitBackup';
describe('unit backup', () => {
  it('filters direct data by the selected unit and children by its sale IDs', async () => {
    const read = vi.fn(async (table: string) => table === 'sales' ? [{ id: 'sale-a', unit_id: 'unit-a' }] : [{ id: 'item-a', sale_id: 'sale-a' }]);
    const backup = await createUnitBackup({ read }, { id: 'unit-a', name: 'Unité A' }, ['sale_items']);
    expect(read).toHaveBeenNthCalledWith(1, 'sales', 'unit_id', ['unit-a'], 0, 500);
    expect(read).toHaveBeenNthCalledWith(2, 'sale_items', 'sale_id', ['sale-a'], 0, 500);
    expect(readUnitBackup(backup).data.sale_items).toHaveLength(1);
  });
  it('does not silently export a partial backup when a read fails', async () => {
    await expect(createUnitBackup({ read: async () => { throw new Error('Permission refusée'); } }, { id: 'unit-a', name: 'A' }, ['sales'])).rejects.toThrow('Permission refusée');
  });
  it('reads beyond the first page without losing records', async () => {
    const read = vi.fn(async (_t, _c, _ids, offset) => offset === 0 ? Array.from({ length: 500 }, (_, i) => ({ id: String(i), unit_id: 'unit-a' })) : [{ id: '500', unit_id: 'unit-a' }]);
    const backup = await createUnitBackup({ read }, { id: 'unit-a', name: 'A' }, ['sales']);
    expect(backup.data.sales).toHaveLength(501);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('rejects files containing another unit', async () => {
    const backup = await createUnitBackup({ read: async () => [{ id: 'sale-b', unit_id: 'unit-b' }] }, { id: 'unit-a', name: 'A' }, ['sales']);
    expect(() => readUnitBackup(backup)).toThrow('plusieurs unités');
  });
  it('rejects child records from another sale', async () => {
    const backup = await createUnitBackup({ read: async () => [] }, { id: 'unit-a', name: 'A' }, ['sales']);
    backup.data.sale_items = [{ id: 'item-b', sale_id: 'sale-b' }];
    expect(() => readUnitBackup(backup)).toThrow('Rattachement');
  });
  it('rejects direct records without a unit attribution', async () => {
    const backup = await createUnitBackup({ read: async () => [{ id: 'sale-a' }] }, { id: 'unit-a', name: 'A' }, ['sales']);
    expect(() => readUnitBackup(backup)).toThrow('plusieurs unités');
  });
});