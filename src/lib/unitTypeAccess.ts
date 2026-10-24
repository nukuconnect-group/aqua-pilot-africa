import { subscriptionAccess, type SubscriptionAccessRecord } from './subscriptionAccess';

// Pendant l'essai actif tous les types sont accessibles ; ensuite seuls les types couverts.
// null ou liste vide = pas de restriction (comptes anciens sans liste enregistrée).
// Les administrateurs ne sont jamais restreints.
export const isUnitTypeAllowed = (
  allowedTypes: string[] | null | undefined,
  type: string,
  isAdmin: boolean,
  subscription?: SubscriptionAccessRecord | null,
  today?: string,
): boolean => {
  if (isAdmin) return true;
  if (subscription) {
    const access = subscriptionAccess(subscription, today);
    if (!access.isActive) return false;
    if (access.isTrial) return true;
  }
  if (!allowedTypes || allowedTypes.length === 0) return true;
  return allowedTypes.includes(type);
};
