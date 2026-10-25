import { SIGNUP_UNIT_OPTIONS } from './signupUnits';

export interface SubscriptionOffer {
  id: string;
  name: string;
  description: string;
  annualPrice: number | null;
  regularPrice?: number;
  unitLimit: number | null;
  features: string[];
}

const unitTypes = SIGNUP_UNIT_OPTIONS.map(unit => unit.label).join(', ');
export const SUBSCRIPTION_OFFERS: SubscriptionOffer[] = [
  { id: 'annual_basic', name: 'Petite exploitation', description: 'Une unité à gérer selon votre activité.', annualPrice: 60000, regularPrice: 100000, unitLimit: 1,
    features: ['1 unité au choix', 'Stocks, ventes, caisse et trésorerie', 'Production et alimentation selon le type d’unité', 'Rapports PDF et Excel', `Types disponibles : ${unitTypes}`] },
  { id: 'annual_pro', name: 'Semi-industriel', description: 'Jusqu’à trois unités pour une exploitation organisée.', annualPrice: 150000, unitLimit: 3,
    features: ['Jusqu’à 3 unités au choix', 'Production, stocks, ventes et comptabilité', 'Équipe et affectation des caissiers', 'Suivi sanitaire selon le type d’unité', `Types disponibles : ${unitTypes}`] },
  { id: 'annual_enterprise', name: 'Industriel', description: 'Plusieurs unités, tous les types d’activité.', annualPrice: 850000, unitLimit: null,
    features: ['Nombre d’unités illimité', 'Tous les types d’unités', 'Modules adaptés à chaque activité', 'Production, alimentation, stocks et suivi sanitaire', 'Ventes, caisses, trésorerie, comptabilité et rapports', `Unités : ${unitTypes}`] },
  { id: 'custom', name: 'Sur devis', description: 'Une offre chiffrée selon vos besoins.', annualPrice: null, unitLimit: null,
    features: ['Périmètre et unités définis avec vous', 'Modules et accompagnement selon vos besoins', 'Prix communiqué sur demande'] },
];

export const offerPrice = (offer: SubscriptionOffer) => offer.annualPrice === null ? 'Sur devis' : `${offer.annualPrice.toLocaleString('fr-FR')} F CFA`;