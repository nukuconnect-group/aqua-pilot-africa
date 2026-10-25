/** Preserve an explicit accessible choice; only auto-select when there is no ambiguity. */
export function resolveSalesUnit<T extends { id: string }>(units: T[], activeUnit: T | null): T | null {
  if (activeUnit) return units.find(unit => unit.id === activeUnit.id) ?? null;
  return units.length === 1 ? units[0] : null;
}