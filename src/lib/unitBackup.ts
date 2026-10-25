export const UNIT_BACKUP_TABLES = [
  'production_units', 'unit_infrastructures', 'unit_equipment', 'purchases',
  'accounting_transactions', 'depreciable_assets', 'feed_stocks', 'livestock_batches',
  'production_cycles', 'cycle_infrastructures', 'health_records', 'feeding_records',
  'feeding_plans', 'feeding_sheets', 'reproduction_records', 'sales', 'sale_items',
  'cash_sessions', 'cash_movements', 'treasury_accounts', 'treasury_movements',
] as const;
export type UnitBackupTable = typeof UNIT_BACKUP_TABLES[number];
type Row = Record<string, unknown>;
export interface UnitBackup {
  version: '2.0';
  exportDate: string;
  unit: { id: string; name: string };
  data: Partial<Record<UnitBackupTable, Row[]>>;
}
export interface BackupReader {
  read(table: UnitBackupTable, column: string, ids: string[], offset: number, limit: number): Promise<Row[]>;
}
export async function createUnitBackup(reader: BackupReader, unit: UnitBackup['unit'], tables: readonly UnitBackupTable[]): Promise<UnitBackup> {
  if (!unit.id) throw new Error('Choisissez une unité.');
  const data: UnitBackup['data'] = {};
  const readAll = async (table: UnitBackupTable, column: string, ids: string[]) => {
    const rows: Row[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      for (let offset = 0; ; offset += 500) {
        const page = await reader.read(table, column, ids.slice(i, i + 100), offset, 500);
        rows.push(...page);
        if (page.length < 500) break;
      }
    }
    return rows;
  };
  for (const table of tables) {
    if (!UNIT_BACKUP_TABLES.includes(table)) throw new Error('Catégorie non autorisée.');
    if (table === 'cycle_infrastructures' || table === 'sale_items') {
      const parent = table === 'sale_items' ? 'sales' : 'production_cycles';
      const parentRows = data[parent] ?? await readAll(parent, 'unit_id', [unit.id]);
      data[parent] = parentRows;
      const ids = parentRows.map(r => r.id).filter((id): id is string => typeof id === 'string');
      data[table] = await readAll(table, table === 'sale_items' ? 'sale_id' : 'cycle_id', ids);
    } else {
      data[table] = await readAll(table, table === 'production_units' ? 'id' : 'unit_id', [unit.id]);
    }
  }
  return { version: '2.0', exportDate: new Date().toISOString(), unit, data };
}

export function readUnitBackup(value: unknown): UnitBackup {
  if (!value || typeof value !== 'object') throw new Error('Fichier invalide.');
  const backup = value as UnitBackup;
  if (backup.version !== '2.0' || typeof backup.unit?.id !== 'string' || typeof backup.unit?.name !== 'string' || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data) || !Number.isFinite(Date.parse(backup.exportDate))) throw new Error('Sauvegarde par unité invalide.');
  for (const [table, rows] of Object.entries(backup.data)) {
    if (!UNIT_BACKUP_TABLES.includes(table as UnitBackupTable) || !Array.isArray(rows)) throw new Error('Catégorie invalide.');
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Enregistrement invalide.');
      if (table === 'production_units' ? row.id !== backup.unit.id : (table !== 'sale_items' && table !== 'cycle_infrastructures' && row.unit_id !== backup.unit.id)) throw new Error('Le fichier mélange plusieurs unités.');
    }
  }
  for (const [child, parent, column] of [['sale_items', 'sales', 'sale_id'], ['cycle_infrastructures', 'production_cycles', 'cycle_id']] as const) {
    const ids = new Set(backup.data[parent]?.map(r => r.id));
    if (backup.data[child]?.some(r => !ids.has(r[column]))) throw new Error('Rattachement à l’unité invalide.');
  }
  return backup;
}