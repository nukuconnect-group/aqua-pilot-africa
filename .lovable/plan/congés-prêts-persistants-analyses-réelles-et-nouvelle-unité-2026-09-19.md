# Congés/prêts persistants, analyses réelles, et nouvelle unité « Algoculture »

## 1. Congés et prêts (base de données)

Les tables `leave_requests`, `employee_loans` et `loan_repayments` existent déjà dans la base actuelle (vérifié). Il n'y a donc rien à recréer.

À faire :
- Vérifier colonnes, droits d'accès et règles de sécurité (chaque utilisateur ne voit que ses propres données).
- Vérifier que les écrans Congés et Prêts lisent/écrivent bien en base (création, modification, suppression, validation, historique) et non en local.
- Contrôler après reconnexion que les données restent présentes.

## 2. Module Analyses : supprimer les données de démonstration

Dans l'écran Analyses, une courbe (indice de conversion) est encore générée aléatoirement.
- Remplacer par le calcul réel à partir des données d'alimentation et de biomasse.
- Quand la donnée n'existe pas, afficher un état « données insuffisantes » au lieu d'une valeur inventée.
- Passer en revue les autres graphiques/indicateurs de l'écran pour confirmer qu'ils viennent bien de la base.

## 3. Nouvelle unité « Algoculture »

Aucun nouveau module ne sera créé. On ajoute un type d'unité supplémentaire et on adapte le contenu des modules existants.

### Socle
- Ajouter le type `algoculture` à la liste des types d'unité, avec son libellé, son icône et sa couleur, pour qu'il apparaisse à la création d'une unité.
- Déclarer dans les règles d'accès aux modules quels modules sont actifs pour ce type : tableau de bord, infrastructures, cheptel (lots de culture), alimentation (nutriments), production, prophylaxie/qualité, achats, ventes, fournisseurs, comptabilité, RH & paie, équipe, planification, rapports, analyses, traçabilité, support, paramètres, hors ligne.
- Ajouter les traductions FR/EN (et les autres langues déjà présentes) pour le nouveau libellé et les termes adaptés.

### Adaptation du contenu (mêmes composants, vocabulaire et champs contextualisés)
- **Production** : cycles de culture d'algues — espèce/souche, système de culture (bassin, réservoir, raceway), ensemencement, quantité initiale, suivi de croissance, biomasse, densité, rendement, pertes, contamination, récolte, durée, coûts, statut. Suivi du démarrage jusqu'à la récolte.
- **Cheptel** : même module, présenté comme « Lots de culture » — espèce/variété, origine, biomasse, bassin associé, date d'introduction, état, évolution, pertes, récolte, historique.
- **Alimentation** : présenté comme « Intrants / nutriments » — nutriments, fertilisants, minéraux, CO₂, solutions nutritives, quantités consommées, coûts, stocks, rattachement à un cycle ou un bassin. La logique de ration pour poissons est masquée pour ce type d'unité.
- **Infrastructure** : bassins, réservoirs, raceways, pompes, aérateurs, filtration, matériel de récolte, séchage, transformation — capacité, état, maintenance, disponibilité, rattachement aux cycles.
- **Prophylaxie / qualité** : contamination, bactéries, champignons, organismes indésirables, algues concurrentes, qualité de l'eau, paramètres physico-chimiques, échantillons, lots concernés, mesures préventives et correctives.
- **Achats / Ventes / Fournisseurs / Comptabilité** : catégories et produits adaptés (nutriments, matériel de laboratoire, emballages / algues fraîches, séchées, en poudre, biomasse, produits transformés). Devise centralisée déjà en place, réutilisée telle quelle.
- **RH & Paie, Équipe, Planification, Rapports, Support, Paramètres, Hors ligne** : réutilisés sans changement, seuls les intitulés d'activité sont adaptés.
- **Traçabilité** : chaîne Lot → bassin → intrants → contrôles → récolte → transformation → stock → vente → client.

### Tableau de bord Algoculture
Construit avec les composants de tableau de bord existants, alimenté par la base : cycles actifs, biomasse actuelle, production totale et du mois, quantité récoltée, en stock, réservée, ventes, coûts, rendement, pertes, alertes qualité et production, état des bassins, évolution de la production.

### Assistant IA
L'assistant existant reçoit le contexte Algoculture (croissance, biomasse, paramètres de culture, qualité de l'eau, contamination, rendement, pertes, nutriments, coûts, prévision de récolte) en s'appuyant sur les données réelles de l'unité active. Aucune nouvelle IA.

### Cloisonnement des données
Toutes les données restent rattachées à l'identifiant de l'unité, comme aujourd'hui : aucune donnée partagée entre Algoculture, pisciculture, fabrication d'aliments ou commercialisation.

## Détails techniques
- `ProductionUnitType` étendu avec `algoculture` ; mise à jour de `planModules.ts` (`ALL_OPERATIONAL_UNIT_TYPES`, libellés, `unitTypes` par module, règles `unit_type_module_rules`), `ProductionUnitSelector`, `ProductionUnitsManagement`, `CustomEquipmentManager`, `ProductionCycleForm`, `FeedingManagement`, locales `*/dashboard.ts`.
- Routage par type dans `src/pages/Dashboard.tsx` sur le modèle existant `isFeedMillUnit` (`isAlgaeUnit`), en réutilisant les composants actuels avec des libellés/options contextuels plutôt qu'en dupliquant des écrans.
- Migration base : ajout de la valeur `algoculture` dans les règles de modules par type d'unité ; pas de nouvelles tables métier (les tables cycles/lots/stocks/ventes existantes sont réutilisées, avec champs contextuels au besoin).
- `AnalyticsDashboard.tsx` ligne ~681 : suppression du `Math.random()` sur le FCR.
