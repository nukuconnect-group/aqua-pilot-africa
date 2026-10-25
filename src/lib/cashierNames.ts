export interface CashierDirectoryEntry {
  id: string;
  name: string;
}

/**
 * Résout les identifiants de caissiers en noms complets à partir d'un
 * annuaire (membres d'équipe, profils). Les noms sont retournés tels quels,
 * jamais tronqués : c'est l'affichage qui gère le retour à la ligne.
 */
export const resolveCashierNames = (
  ids: string[],
  directory: CashierDirectoryEntry[],
): string[] => {
  const byId = new Map<string, string>();
  for (const entry of directory) {
    const name = (entry.name || '').trim();
    if (entry.id && name && !byId.has(entry.id)) byId.set(entry.id, name);
  }
  const seen = new Set<string>();
  const names: string[] = [];
  for (const id of ids) {
    const name = byId.get(id);
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      names.push(name);
    }
  }
  return names;
};
