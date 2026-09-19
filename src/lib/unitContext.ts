/**
 * Terminologie et options métier par type d'unité.
 *
 * Objectif : réutiliser strictement les mêmes modules/composants pour tous les
 * types d'unités, et n'adapter que le vocabulaire et les listes d'options.
 * Aucun module dupliqué n'est créé pour l'algoculture.
 */
import type { ProductionUnitType } from '@/contexts/ProductionUnitsContext';

export interface UnitContextTerms {
  /** Libellé du module « Cheptel / lots ». */
  livestockTitle: string;
  livestockSubtitle: string;
  batchLabel: string;
  speciesLabel: string;
  quantityLabel: string;
  biomassLabel: string;
  /** Libellé du module « Alimentation ». */
  feedingTitle: string;
  feedingSubtitle: string;
  feedLabel: string;
  /** Libellé du module « Prophylaxie ». */
  healthTitle: string;
  healthSubtitle: string;
  /** Libellé du module « Production ». */
  productionTitle: string;
  productionSubtitle: string;
  harvestLabel: string;
  infrastructureLabel: string;
  /** Options proposées dans les formulaires. */
  speciesOptions: string[];
  feedOptions: string[];
  infrastructureOptions: string[];
  healthIssueOptions: string[];
  salesProductOptions: string[];
  purchaseCategoryOptions: string[];
  /** Catégories/sous-catégories d'achats proposées dans le module Achats. */
  purchaseCategoryMap: Record<string, string[]>;
  /** Catégories proposées à la création d'un fournisseur. */
  supplierCategoryOptions: string[];
  /** Types proposés dans la gestion des stocks d'aliments / intrants. */
  stockTypeOptions: { value: string; label: string }[];
  /** Libellés d'analyse (indice de conversion / rendement). */
  conversionLabel: string;
  conversionDescription: string;
}


const DEFAULT_TERMS: UnitContextTerms = {
  livestockTitle: 'Gestion du Cheptel',
  livestockSubtitle: 'Lots, biomasse et suivi de croissance',
  batchLabel: 'Lot',
  speciesLabel: 'Espèce',
  quantityLabel: 'Nombre de poissons',
  biomassLabel: 'Biomasse (kg)',
  feedingTitle: 'Alimentation',
  feedingSubtitle: "Gestion de l'alimentation",
  feedLabel: 'Aliment',
  healthTitle: 'Prophylaxie',
  healthSubtitle: 'Prévention et interventions sanitaires',
  productionTitle: 'Production',
  productionSubtitle: 'Cycles de production et objectifs',
  harvestLabel: 'Pêche / récolte',
  infrastructureLabel: 'Bassin',
  speciesOptions: ['Carpe commune', 'Tilapia', 'Truite arc-en-ciel', 'Saumon', 'Bar', 'Dorade'],
  feedOptions: ['Aliment starter', 'Aliment croissance', 'Aliment finition'],
  infrastructureOptions: ['Bassin', 'Étang', 'Cage flottante', 'Raceway'],
  healthIssueOptions: ['Parasites', 'Infection bactérienne', 'Mycose', 'Stress', 'Mortalité anormale'],
  salesProductOptions: ['Poisson frais', 'Poisson transformé', 'Alevins'],
  purchaseCategoryOptions: ['Aliment', 'Alevins', 'Matériel', 'Équipement', 'Consommables'],
};

/** Vocabulaire et options propres à une unité d'algoculture. */
export const ALGAE_TERMS: UnitContextTerms = {
  livestockTitle: 'Lots de Culture',
  livestockSubtitle: 'Lots biologiques d’algues, biomasse et suivi de croissance',
  batchLabel: 'Lot de culture',
  speciesLabel: 'Espèce / souche d’algue',
  quantityLabel: 'Quantité ensemencée (kg ou L)',
  biomassLabel: 'Biomasse algale (kg)',
  feedingTitle: 'Intrants & Nutriments',
  feedingSubtitle: 'Nutriments, fertilisants, minéraux, CO₂ et solutions nutritives',
  feedLabel: 'Intrant / nutriment',
  healthTitle: 'Prophylaxie & Qualité de culture',
  healthSubtitle: 'Contaminations, organismes indésirables et qualité de l’eau',
  productionTitle: 'Production d’algues',
  productionSubtitle: 'Cycles de culture : ensemencement, croissance, récolte',
  harvestLabel: 'Récolte',
  infrastructureLabel: 'Bassin / réservoir de culture',
  speciesOptions: [
    'Spiruline (Arthrospira platensis)',
    'Chlorella vulgaris',
    'Nannochloropsis',
    'Dunaliella salina',
    'Haematococcus pluvialis',
    'Ulva (laitue de mer)',
    'Gracilaria',
    'Eucheuma / Kappaphycus',
    'Sargassum',
  ],
  feedOptions: [
    'Nitrate de sodium',
    'Bicarbonate de sodium',
    'Phosphate (KH2PO4)',
    'Sulfate de magnésium',
    'Sulfate de fer',
    'Urée',
    'Oligo-éléments',
    'Milieu nutritif F/2',
    'CO₂',
    'Chaux / correcteur de pH',
  ],
  infrastructureOptions: [
    'Bassin raceway',
    'Bassin circulaire',
    'Photobioréacteur',
    'Réservoir de culture',
    'Bassin de décantation',
    'Table de séchage',
    'Unité de filtration',
    'Unité de transformation',
  ],
  healthIssueOptions: [
    'Contamination bactérienne',
    'Contamination fongique',
    'Algues concurrentes',
    'Protozoaires / brouteurs',
    'Chute de densité',
    'Décoloration de la culture',
    'Dérive des paramètres physico-chimiques',
  ],
  salesProductOptions: [
    'Algues fraîches',
    'Algues séchées',
    'Algues en poudre',
    'Biomasse humide',
    'Extraits / produits transformés',
  ],
  purchaseCategoryOptions: [
    'Nutriments & fertilisants',
    'Produits de laboratoire',
    'Matériel de culture',
    'Emballages',
    'Équipements',
    'Consommables',
  ],
};

const TERMS_BY_TYPE: Partial<Record<ProductionUnitType, UnitContextTerms>> = {
  algoculture: ALGAE_TERMS,
};

export const isAlgaeUnitType = (type?: ProductionUnitType | null) => type === 'algoculture';

export const getUnitTerms = (type?: ProductionUnitType | null): UnitContextTerms =>
  (type && TERMS_BY_TYPE[type]) || DEFAULT_TERMS;
