// Règle d'accès aux types d'unités : un compte ne peut créer que les types
// couverts par son abonnement (profiles.production_units).
// null ou liste vide = pas de restriction (comptes anciens sans liste enregistrée).
// Les administrateurs ne sont jamais restreints.
export const isUnitTypeAllowed = (
  allowedTypes: string[] | null | undefined,
  type: string,
  isAdmin: boolean,
): boolean => {
  if (isAdmin) return true;
  if (!allowedTypes || allowedTypes.length === 0) return true;
  return allowedTypes.includes(type);
};
