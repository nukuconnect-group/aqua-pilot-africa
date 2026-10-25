import type { ProductionUnitType } from '@/contexts/ProductionUnitsContext';

export interface AssistantUnitProfile {
  /** Libellé métier court affiché dans l'en-tête. */
  label: string;
  /** Rôle de l'assistant pour ce type d'unité. */
  role: string;
  /** Propositions de questions métier, cliquables. */
  suggestions: { title: string; question: string }[];
}

const common = {
  revenue: { title: 'Chiffre d’affaires', question: 'Quel est mon chiffre d’affaires du mois et comment évolue-t-il par rapport au mois précédent ?' },
  stocks: { title: 'Stocks critiques', question: 'Quels stocks sont sous le seuil minimum et que dois-je commander en priorité ?' },
  priorities: { title: 'Priorités du jour', question: 'Quelles sont les actions prioritaires aujourd’hui pour cette unité ?' },
};

const profiles: Record<ProductionUnitType | 'all', AssistantUnitProfile> = {
  all: {
    label: 'Vue globale',
    role: 'Synthèse de toutes vos unités',
    suggestions: [
      common.revenue,
      { title: 'Résumé des unités', question: 'Donne-moi un résumé chiffré de chacune de mes unités de production.' },
      common.stocks,
      { title: 'Cycles en cours', question: 'Quel est l’état d’avancement de mes cycles actifs ?' },
      { title: 'Contrôles récents', question: 'Quels sont les derniers contrôles enregistrés et y a-t-il des valeurs anormales ?' },
      common.priorities,
    ],
  },
  grossissement: {
    label: 'Grossissement',
    role: 'Croissance, alimentation, santé et ventes',
    suggestions: [
      { title: 'Avancement des cycles', question: 'Où en sont mes cycles de grossissement (poids moyen, biomasse, jours restants) ?' },
      { title: 'Indice de conversion', question: 'Quel est mon indice de conversion alimentaire par cycle et est-il correct ?' },
      { title: 'Ration du jour', question: 'Quelle ration journalière dois-je distribuer selon la biomasse enregistrée ?' },
      { title: 'Mortalité', question: 'Quel est le taux de mortalité par bassin et quelles causes sont enregistrées ?' },
      common.revenue,
      { title: 'Date de récolte', question: 'Quand prévoir la prochaine récolte selon le poids cible de mes cycles ?' },
    ],
  },
  ecloserie: {
    label: 'Écloserie',
    role: 'Reproduction, larves, alevins et survie',
    suggestions: [
      { title: 'Lots d’alevins', question: 'Quels lots de larves et d’alevins sont en cours et quel est leur taux de survie ?' },
      { title: 'Reproduction', question: 'Résume mes dernières pontes et éclosions enregistrées.' },
      { title: 'Qualité de l’eau', question: 'Les derniers contrôles d’eau sont-ils adaptés aux larves ?' },
      { title: 'Alimentation larvaire', question: 'Quel est le stock d’aliment larvaire et combien de jours il couvre ?' },
      { title: 'Ventes d’alevins', question: 'Combien d’alevins ai-je vendus ce mois et pour quel montant ?' },
      common.priorities,
    ],
  },
  algoculture: {
    label: 'Algoculture',
    role: 'Cultures, nutriments, paramètres et récoltes',
    suggestions: [
      { title: 'Cultures en cours', question: 'Quel est l’état de mes cultures d’algues et leur progression ?' },
      { title: 'Paramètres de culture', question: 'Les derniers pH, températures et salinités sont-ils dans les limites ?' },
      { title: 'Nutriments', question: 'Quels nutriments et intrants sont en stock et lesquels commander ?' },
      { title: 'Pertes de culture', question: 'Quelles pertes de culture sont enregistrées par cycle et par bassin ?' },
      { title: 'Rendement', question: 'Quel est le rendement de récolte par cycle de culture ?' },
      common.revenue,
    ],
  },
  fabrication_aliment: {
    label: 'Provenderie',
    role: 'Production d’aliment, matières premières et ventes',
    suggestions: [
      { title: 'Matières premières', question: 'Quelles matières premières sont sous le seuil et combien commander ?' },
      { title: 'Production d’aliment', question: 'Combien d’aliment ai-je produit ce mois par formule ?' },
      { title: 'Coût de revient', question: 'Quel est le coût de revient par kg de mes formules d’aliment ?' },
      { title: 'Ventes d’aliment', question: 'Quelles sont mes ventes d’aliment du mois et mes meilleurs clients ?' },
      common.revenue,
      common.priorities,
    ],
  },
  transformation: {
    label: 'Transformation',
    role: 'Transformation, rendement matière et ventes',
    suggestions: [
      { title: 'Rendement matière', question: 'Quel est le rendement matière de mes lots transformés ?' },
      { title: 'Produits finis', question: 'Quel est mon stock de produits finis par catégorie ?' },
      common.revenue,
      common.stocks,
      { title: 'Coûts de transformation', question: 'Quels sont mes coûts de transformation ce mois ?' },
      common.priorities,
    ],
  },
  conservation: {
    label: 'Conservation',
    role: 'Stockage froid, rotation et pertes',
    suggestions: [
      { title: 'Stock conservé', question: 'Quel est le stock conservé par produit et depuis combien de temps ?' },
      { title: 'Rotation', question: 'Quels produits doivent sortir en priorité ?' },
      { title: 'Pertes', question: 'Quelles pertes de stock sont enregistrées ce mois ?' },
      common.revenue,
      common.stocks,
      common.priorities,
    ],
  },
  commercialisation: {
    label: 'Commercialisation',
    role: 'Ventes, clients, encaissements et marges',
    suggestions: [
      common.revenue,
      { title: 'Meilleurs produits', question: 'Quels produits se vendent le mieux ce mois ?' },
      { title: 'Créances clients', question: 'Quels clients ont des montants restant à encaisser ?' },
      { title: 'Finances', question: 'Analyse mes dépenses et recettes. Distingue solde ventes moins achats et bénéfice net ; signale les coûts manquants.' },
      common.stocks,
      common.priorities,
    ],
  },
};

export const getAssistantUnitProfile = (type?: ProductionUnitType | null): AssistantUnitProfile =>
  (type && profiles[type]) || profiles.all;
