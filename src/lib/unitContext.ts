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
  /** Types d'infrastructures proposés à la création. */
  infrastructureTypeOptions: { value: string; label: string }[];
  /** Onglet « Pêche de contrôle » / échantillonnage. */
  samplingTabLabel: string;
  samplingTitle: string;
  samplingSubtitle: string;
  /** Onglets du module Prophylaxie. */
  healthCheptelTabLabel: string;
  healthDiseasesTabLabel: string;
  /** Onglet « Alimentation » dans l'analytique. */
  analyticsInputsTabLabel: string;
  /** Assistant IA santé. */
  aiSpeciesTitle: string;
  aiSpeciesDescription: string;
  aiSpeciesPlaceholder: string;
  /** Activation/désactivation de sous-modules non pertinents. */
  features: {
    feedingSheets: boolean;
    feedingPlanning: boolean;
    sampling: boolean;
  };
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
  purchaseCategoryMap: {
    'Aliments': ['Granulés flottants', 'Granulés coulants', 'Farine de poisson', 'Aliment croissance', 'Aliment finition', 'Compléments nutritionnels'],
    'Équipements et matériels': ['Pompes', 'Filtres', 'Aérateurs', 'Bassins', 'Filets', 'Outils de mesure', 'Matériel de pêche'],
    'Intrants': ['Engrais organiques', 'Probiotiques', 'Désinfectants', 'Produits de traitement', 'Chaux', 'Sel'],
    'Alevins': ['Tilapia', 'Carpe', 'Truite', 'Bar', 'Dorade', 'Autres espèces'],
    'Formations du personnel': ['Formation technique', 'Formation sécurité', 'Formation gestion', 'Certification', 'Séminaires'],
    'Prestations externes': ['Consultance', 'Maintenance', 'Transport', 'Analyses laboratoire', 'Services vétérinaires'],
    'Prestations internes': ["Main d'œuvre", 'Services internes', 'Transferts inter-unités'],
    'Matières premières': ['Ciment', 'Bâches', 'Tuyaux', 'Vannes', 'Raccords', 'Électricité'],
    'Kits et autres': ['Kits de test', "Produits d'entretien", 'Fournitures bureau', 'Carburant', 'Divers'],
  },
  supplierCategoryOptions: ['Aliments', 'Vétérinaire', 'Équipement', 'Alevins', 'Matériel', 'Autre'],
  stockTypeOptions: [
    { value: 'granules_flottants', label: 'Granulés flottants' },
    { value: 'granules_coulants', label: 'Granulés coulants' },
    { value: 'farine_poisson', label: 'Farine de poisson' },
    { value: 'farine_soja', label: 'Farine de soja' },
    { value: 'aliment_starter', label: 'Aliment starter (0.5-1mm)' },
    { value: 'aliment_croissance', label: 'Aliment croissance (2-3mm)' },
    { value: 'aliment_finition', label: 'Aliment finition (4-6mm)' },
    { value: 'aliment_reproducteur', label: 'Aliment reproducteur' },
    { value: 'complement_vitamine', label: 'Complément vitaminé' },
    { value: 'probiotique', label: 'Probiotique' },
  ],
  conversionLabel: 'FCR',
  conversionDescription: 'Indice de conversion alimentaire',
  infrastructureTypeOptions: [
    { value: 'bassin_incubation', label: "Bassin d'incubation" },
    { value: 'bassin_grossissement', label: 'Bassin de grossissement' },
    { value: 'bassin_beton', label: 'Bassin en béton' },
    { value: 'etang_naturel', label: 'Étang naturel' },
    { value: 'etang_artificiel', label: 'Étang artificiel' },
    { value: 'chambre_froide', label: 'Chambre froide' },
    { value: 'chambre_froide_positive', label: 'Chambre froide positive' },
    { value: 'chambre_froide_negative', label: 'Chambre froide négative' },
    { value: 'four_fumage', label: 'Four de fumage' },
    { value: 'four_sechage', label: 'Four de séchage' },
    { value: 'table_decoupe', label: 'Table de découpe' },
    { value: 'machine_filetage', label: 'Machine de filetage' },
    { value: 'tunnel_congelation', label: 'Tunnel de congélation' },
    { value: 'silo_aliment', label: 'Silo à aliment' },
    { value: 'reservoir_eau', label: "Réservoir d'eau" },
    { value: 'systeme_filtration', label: 'Système de filtration' },
    { value: 'pompe_eau', label: 'Pompe à eau' },
    { value: 'aerateur', label: 'Aérateur' },
    { value: 'laboratoire', label: "Laboratoire d'analyse" },
  ],
  samplingTabLabel: 'Pêche',
  samplingTitle: 'Pêche de Contrôle',
  samplingSubtitle: 'Enregistrez les pêches de contrôle par infrastructure',
  healthCheptelTabLabel: 'Cheptel',
  healthDiseasesTabLabel: 'Maladies',
  analyticsInputsTabLabel: 'Alimentation',
  aiSpeciesTitle: 'Maladies par espèce',
  aiSpeciesDescription: 'Saisissez une espèce élevée pour obtenir ses maladies réelles et les recommandations.',
  aiSpeciesPlaceholder: 'Ex : Tilapia du Nil, Clarias gariepinus, Carpe commune...',
  features: { feedingSheets: true, feedingPlanning: true, sampling: true },
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
  purchaseCategoryMap: {
    'Nutriments & fertilisants': ['Nitrate de sodium', 'Bicarbonate de sodium', 'Phosphate (KH2PO4)', 'Sulfate de magnésium', 'Sulfate de fer', 'Urée', 'Oligo-éléments', 'Milieu nutritif F/2', 'CO₂'],
    'Souches & inoculum': ['Souche mère', 'Inoculum de spiruline', 'Inoculum de chlorella', 'Boutures de macro-algues'],
    'Matériel de culture': ['Bâches de bassin', 'Agitateurs / roues à aubes', 'Pompes', 'Système de filtration', 'Toiles de filtration', 'Tuyauterie'],
    'Équipements': ['Photobioréacteur', 'Séchoir à algues', 'Broyeur / granulateur', 'Presse / essoreuse', 'Injecteur de CO₂'],
    'Produits de laboratoire': ['Kits de test pH', 'Kits de salinité', 'Microscope / consommables', 'Réactifs', 'Analyses laboratoire'],
    'Emballages & conditionnement': ['Sachets alimentaires', 'Bocaux', 'Étiquettes', 'Cartons', 'Sacs de stockage'],
    'Prestations externes': ['Consultance', 'Maintenance', 'Transport', 'Analyses qualité', 'Certification'],
    'Formations du personnel': ['Formation culture', 'Hygiène & sécurité alimentaire', 'Formation récolte & séchage'],
    'Kits et autres': ['Produits de nettoyage', 'Carburant', 'Fournitures bureau', 'Divers'],
  },
  supplierCategoryOptions: [
    'Nutriments & fertilisants',
    'Souches & inoculum',
    'Matériel de culture',
    'Équipements',
    'Laboratoire',
    'Emballages',
    'Autre',
  ],
  stockTypeOptions: [
    { value: 'nitrate_sodium', label: 'Nitrate de sodium' },
    { value: 'bicarbonate_sodium', label: 'Bicarbonate de sodium' },
    { value: 'phosphate', label: 'Phosphate (KH2PO4)' },
    { value: 'sulfate_magnesium', label: 'Sulfate de magnésium' },
    { value: 'sulfate_fer', label: 'Sulfate de fer' },
    { value: 'uree', label: 'Urée' },
    { value: 'oligo_elements', label: 'Oligo-éléments' },
    { value: 'milieu_f2', label: 'Milieu nutritif F/2' },
    { value: 'co2', label: 'CO₂' },
    { value: 'correcteur_ph', label: 'Chaux / correcteur de pH' },
  ],
  conversionLabel: 'Rendement nutritif',
  conversionDescription: 'Kg d’intrants consommés par kg de biomasse algale produite',
  infrastructureTypeOptions: [
    { value: 'bassin_raceway', label: 'Bassin raceway (open pond)' },
    { value: 'bassin_circulaire', label: 'Bassin circulaire de culture' },
    { value: 'photobioreacteur_tubulaire', label: 'Photobioréacteur tubulaire' },
    { value: 'photobioreacteur_plan', label: 'Photobioréacteur à panneaux' },
    { value: 'bassin_inoculum', label: 'Bassin d’inoculum / pré-culture' },
    { value: 'reservoir_culture', label: 'Réservoir de culture' },
    { value: 'bassin_decantation', label: 'Bassin de décantation' },
    { value: 'ligne_flottante', label: 'Ligne flottante / filière en mer' },
    { value: 'table_culture', label: 'Table de culture (macro-algues)' },
    { value: 'unite_filtration', label: 'Unité de filtration / essorage' },
    { value: 'sechoir_solaire', label: 'Séchoir solaire' },
    { value: 'sechoir_electrique', label: 'Séchoir électrique' },
    { value: 'salle_conditionnement', label: 'Salle de conditionnement' },
    { value: 'laboratoire_souches', label: 'Laboratoire de souches' },
    { value: 'station_co2', label: 'Station d’injection CO₂' },
    { value: 'station_pompage', label: 'Station de pompage / eau de mer' },
    { value: 'reservoir_nutriments', label: 'Réservoir de solution nutritive' },
    { value: 'magasin_stockage', label: 'Magasin de stockage produits secs' },
  ],
  samplingTabLabel: 'Suivi culture',
  samplingTitle: 'Contrôle de croissance de la culture',
  samplingSubtitle: 'Densité, biomasse, pH, salinité et transparence par bassin',
  healthCheptelTabLabel: 'Lots de culture',
  healthDiseasesTabLabel: 'Contaminations',
  analyticsInputsTabLabel: 'Intrants',
  aiSpeciesTitle: 'Maladies & contaminations par espèce d’algue',
  aiSpeciesDescription:
    'Saisissez une espèce ou souche d’algue pour obtenir ses pathologies, contaminations, symptômes, traitements et dosages recommandés.',
  aiSpeciesPlaceholder: 'Ex : Spiruline (Arthrospira platensis), Chlorella vulgaris, Gracilaria...',
  features: { feedingSheets: false, feedingPlanning: false, sampling: true },
};


const TERMS_BY_TYPE: Partial<Record<ProductionUnitType, UnitContextTerms>> = {
  algoculture: ALGAE_TERMS,
};

export const isAlgaeUnitType = (type?: ProductionUnitType | null) => type === 'algoculture';

export const getUnitTerms = (type?: ProductionUnitType | null): UnitContextTerms =>
  (type && TERMS_BY_TYPE[type]) || DEFAULT_TERMS;
