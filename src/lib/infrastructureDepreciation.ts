export interface InfrastructureDepreciationInput {
  purchasePrice: number; purchaseDate: string; usefulLife: number;
  currency: string; method: 'linear' | 'accelerated';
}
export function validateInfrastructureDepreciation(input: InfrastructureDepreciationInput): string | null {
  if (!Number.isFinite(input.purchasePrice) || input.purchasePrice <= 0) return 'Indiquez un coût d’acquisition supérieur à zéro.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.purchaseDate) || Number.isNaN(new Date(input.purchaseDate).getTime())) return 'Indiquez la date de mise en service.';
  if (!Number.isInteger(input.usefulLife) || input.usefulLife < 1 || input.usefulLife > 50) return 'La durée doit être comprise entre 1 et 50 ans.';
  if (!['XOF', 'EUR', 'USD', 'MAD'].includes(input.currency)) return 'Choisissez une devise disponible.';
  if (input.method !== 'linear') return 'Choisissez la méthode linéaire.';
  return null;
}