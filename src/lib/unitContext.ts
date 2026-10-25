/**
 * Terminologie et options métier par type d'unité.
 *
 * Objectif : réutiliser strictement les mêmes modules/composants pour tous les
 * types d'unités, et n'adapter que le vocabulaire et les listes d'options.
 * Aucun module dupliqué n'est créé pour l'algoculture.
 */
import type { ProductionUnitType } from '@/contexts/ProductionUnitsContext';
import { COMMERCIAL_INFRASTRUCTURE_TYPES } from './commercialInfrastructure';

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
  /** Types de lots proposés à la création d'un lot. */
  batchTypeOptions: { value: string; label: string }[];
  /** Libellés liés au rattachement d'un lot à une infrastructure. */
  attachedBatchLabel: string;
  attachedBatchEmptyText: string;
  createBatchTitle: string;
  /** Unité de comptage des individus d'un lot. */
  individualsLabel: string;
  /** Libellés du formulaire de cycle de production. */
  cycleQuantityLabel: string;
  cycleInitialWeightLabel: string;
  cycleTargetWeightLabel: string;
  cycleSurvivalLabel: string;
  cycleAverageWeightLabel: string;
  /** Libellés du module Alimentation / Intrants. */
  feedSessionTitle: string;
  feedSessionButton: string;
  feedingDailyQuantityLabel: string;
  feedingSessionsLabel: string;
  feedingLastLabel: string;
  feedingNextLabel: string;
  feedingHistoryTitle: string;
  behaviorLabel: string;
  behaviorOptions: { value: string; label: string }[];
  /** Pathologies / contaminations fréquentes proposées en presets. */
  commonDiseasePresets: { name: string; symptoms: string[]; treatment: string }[];
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
  batchTypeOptions: [
    { value: 'alevins', label: 'Alevins' },
    { value: 'geniteurs', label: 'Géniteurs' },
    { value: 'juveniles', label: 'Juvéniles' },
    { value: 'adultes', label: 'Adultes' },
    { value: 'autres', label: 'Autres' },
  ],
  attachedBatchLabel: 'Lot de poissons rattaché',
  attachedBatchEmptyText: "Cette infrastructure n'a pas encore de lot de poissons associé",
  createBatchTitle: 'Créer un lot de poisson',
  individualsLabel: 'individus',
  cycleQuantityLabel: 'Quantité initiale (individus)',
  cycleInitialWeightLabel: 'Poids initial total (kg)',
  cycleTargetWeightLabel: 'Biomasse objectif (kg)',
  cycleSurvivalLabel: 'Taux de survie attendu (%)',
  cycleAverageWeightLabel: 'Poids moyen individuel visé (g)',
  feedSessionTitle: 'Session de nourrissage',
  feedSessionButton: 'Ajouter une session',
  feedingDailyQuantityLabel: 'Quantité/jour',
  feedingSessionsLabel: 'Repas/jour',
  feedingLastLabel: 'Dernier repas',
  feedingNextLabel: 'Prochain repas',
  feedingHistoryTitle: 'Historique de Nourrissage',
  behaviorLabel: 'Comportement des poissons',
  behaviorOptions: [
    { value: 'normal', label: 'Normal - Bon appétit' },
    { value: 'actif', label: 'Très actifs' },
    { value: 'lent', label: 'Peu actifs / Lents' },
    { value: 'refus_partiel', label: 'Refus partiel' },
    { value: 'refus_total', label: 'Refus total' },
    { value: 'stress', label: 'Stress visible' },
  ],
  commonDiseasePresets: [
    { name: 'Ichtyophthirius (Points blancs)', symptoms: ['Points blancs sur le corps', 'Frottement', 'Respiration rapide'], treatment: 'Traitement au sel (3%) pendant 5 jours' },
    { name: 'Aeromonose', symptoms: ['Lésions cutanées', 'Hémorragies', 'Léthargie'], treatment: 'Antibiotique (Oxytétracycline)' },
    { name: 'Columnariose', symptoms: ['Taches blanches/grises', 'Érosion des nageoires', 'Mucus excessif'], treatment: 'Bain de permanganate de potassium' },
    { name: 'Saprolegniose', symptoms: ['Masses cotonneuses blanches', 'Érosion de la peau'], treatment: 'Bain de vert de malachite ou permanganate' },
  ],
  features: { feedingSheets: true, feedingPlanning: false, sampling: true },
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
  samplingSubtitle: 'Biomasse, densité, pH, salinité, pertes et contaminations par bassin',
  healthCheptelTabLabel: 'Lots de culture',
  healthDiseasesTabLabel: 'Contaminations',
  analyticsInputsTabLabel: 'Intrants',
  aiSpeciesTitle: 'Maladies & contaminations par espèce d’algue',
  aiSpeciesDescription:
    'Saisissez une espèce ou souche d’algue pour obtenir ses pathologies, contaminations, symptômes, traitements et dosages recommandés.',
  aiSpeciesPlaceholder: 'Ex : Spiruline (Arthrospira platensis), Chlorella vulgaris, Gracilaria...',
  batchTypeOptions: [
    { value: 'souche_mere', label: 'Souche mère' },
    { value: 'inoculum', label: 'Inoculum / pré-culture' },
    { value: 'culture_croissance', label: 'Culture en croissance' },
    { value: 'boutures', label: 'Boutures / thalles (macro-algues)' },
    { value: 'culture_recoltable', label: 'Culture récoltable' },
  ],
  attachedBatchLabel: 'Lot de culture rattaché',
  attachedBatchEmptyText: "Ce bassin n'a pas encore de lot de culture associé",
  createBatchTitle: 'Créer un lot de culture',
  individualsLabel: 'kg / L ensemencés',
  cycleQuantityLabel: 'Quantité ensemencée (kg ou L)',
  cycleInitialWeightLabel: 'Biomasse initiale (kg)',
  cycleTargetWeightLabel: 'Biomasse objectif à la récolte (kg)',
  cycleSurvivalLabel: 'Taux de réussite de culture attendu (%)',
  cycleAverageWeightLabel: 'Densité visée (g/L)',
  feedSessionTitle: 'Apport d’intrants / nutriments',
  feedSessionButton: 'Enregistrer un apport',
  feedingDailyQuantityLabel: 'Intrants/jour',
  feedingSessionsLabel: 'Apports/jour',
  feedingLastLabel: 'Dernier apport',
  feedingNextLabel: 'Prochain apport',
  feedingHistoryTitle: 'Historique des apports nutritifs',
  behaviorLabel: 'État de la culture',
  behaviorOptions: [
    { value: 'normal', label: 'Culture saine - couleur normale' },
    { value: 'croissance_rapide', label: 'Croissance rapide / densité en hausse' },
    { value: 'croissance_lente', label: 'Croissance lente' },
    { value: 'decoloration', label: 'Décoloration (jaunissement/pâleur)' },
    { value: 'sedimentation', label: 'Sédimentation / floculation' },
    { value: 'contamination', label: 'Contamination suspectée' },
  ],
  commonDiseasePresets: [
    { name: 'Contamination par algues concurrentes', symptoms: ['Changement de couleur du milieu', 'Chute de densité de la souche', 'Filaments étrangers au microscope'], treatment: 'Isoler le bassin, réensemencer depuis la souche mère, ajuster pH (9,5-10,5 pour spiruline) et salinité' },
    { name: 'Brouteurs / protozoaires (amibes, ciliés, rotifères)', symptoms: ['Baisse rapide de la biomasse', 'Milieu qui s’éclaircit', 'Organismes mobiles au microscope'], treatment: 'Choc pH ou ammoniaque contrôlé, filtration 50 µm, récolte anticipée puis redémarrage depuis l’inoculum' },
    { name: 'Épiphytes sur macro-algues', symptoms: ['Dépôts sur les thalles', 'Croissance ralentie', 'Thalles cassants'], treatment: 'Nettoyage mécanique des lignes, réduction de la densité, rotation des filières' },
    { name: 'Maladie de l’ice-ice (Kappaphycus/Eucheuma)', symptoms: ['Blanchiment des thalles', 'Ramollissement', 'Casse des branches'], treatment: 'Déplacer les filières vers un courant plus fort, retirer les thalles atteints, replanter des boutures saines' },
    { name: 'Contamination bactérienne / fongique', symptoms: ['Odeur anormale', 'Mousse et biofilm', 'Milieu trouble'], treatment: 'Désinfection du bassin (hypochlorite puis neutralisation), stérilisation de l’eau d’appoint, redémarrage d’inoculum' },
    { name: 'Dérive des paramètres (pH, salinité, nutriments)', symptoms: ['Décoloration jaune/verte pâle', 'Arrêt de croissance', 'Sédimentation de la biomasse'], treatment: 'Correction du pH (bicarbonate), réajustement des nitrates/phosphates, contrôle de la température et de l’ombrage' },
  ],
  features: { feedingSheets: true, feedingPlanning: false, sampling: true },
};


const TERMS_BY_TYPE: Partial<Record<ProductionUnitType, UnitContextTerms>> = {
  algoculture: ALGAE_TERMS,
  commercialisation: {
    ...DEFAULT_TERMS,
    infrastructureLabel: 'Infrastructure / matériel',
    infrastructureTypeOptions: COMMERCIAL_INFRASTRUCTURE_TYPES,
    attachedBatchLabel: 'Lot de stock rattaché',
    attachedBatchEmptyText: 'Aucun lot de marchandises rattaché',
    features: { feedingSheets: false, feedingPlanning: false, sampling: false },
  },
};

export const isAlgaeUnitType = (type?: ProductionUnitType | null) => type === 'algoculture';

export const getUnitTerms = (type?: ProductionUnitType | null): UnitContextTerms =>
  (type && TERMS_BY_TYPE[type]) || DEFAULT_TERMS;

/** Libellé lisible d'un type d'infrastructure, adapté au type d'unité. */
export const getInfrastructureTypeLabel = (
  type: string,
  unitType?: ProductionUnitType | null,
): string => {
  const terms = getUnitTerms(unitType);
  const found =
    terms.infrastructureTypeOptions.find((o) => o.value === type) ||
    DEFAULT_TERMS.infrastructureTypeOptions.find((o) => o.value === type) ||
    ALGAE_TERMS.infrastructureTypeOptions.find((o) => o.value === type);
  return found ? found.label : type.replace(/_/g, ' ');
};
