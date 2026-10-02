# AquaAssistant mobile + calculs, et nouveau module "Intelligence & Analyse"

## 1. AquaAssistant sur mobile
- Remettre le bouton "plein écran" visible sur mobile (en-tête compact, bouton toujours affiché, pas masqué par la barre du haut).
- En plein écran mobile : la conversation et la barre de saisie occupent tout l'écran, rien n'est coupé en bas (zones sûres iPhone respectées).

## 2. AquaAssistant qui calcule
- Message d'accueil clair : "Que voulez-vous savoir ? Je peux calculer votre chiffre d'affaires, votre rentabilité…"
- Suggestions simples sous forme de phrases cliquables (sans icônes) :
  - "Quel est mon chiffre d'affaires ce mois ?"
  - "Mon unité est-elle rentable ce mois ?"
  - "Quelles sont mes dépenses du mois ?"
  - "Donne-moi des conseils pour améliorer ma marge"
- Le service de l'assistant reçoit les vrais chiffres de l'unité choisie : ventes, achats/dépenses, salaires, aliment, mortalités, stocks — pour le mois en cours et le mois précédent — et calcule lui-même CA, dépenses, marge, rentabilité et évolution.
- Toutes les données lues sont filtrées sur l'unité active (plus de mélange entre unités).
- Si une donnée manque, l'assistant le dit au lieu d'inventer.
- L'IA peut compléter avec ses connaissances générales (prix de marché, bonnes pratiques aquacoles), en les signalant clairement comme "information générale" et non comme chiffre de la ferme.

## 3. Nouveau module "Intelligence & Analyse" (accessible à tous)
Ajouté au menu latéral et mobile, sans restriction d'abonnement. Deux onglets :

**Tableau de bord Business Intelligence**
- Choix de la période (7 j, 30 j, 3 mois, 12 mois, personnalisée) et comparaison avec la période précédente.
- Indicateurs : chiffre d'affaires, dépenses, marge, rentabilité, aliment distribué, mortalités — avec % d'évolution.
- Graphiques : évolution CA vs dépenses, répartition des dépenses, meilleurs produits, mortalités dans le temps.
- Tout vient des données réelles de l'unité active ; "Aucune donnée" affiché sinon.

**Prévisions IA**
- Bouton "Générer les prévisions" : l'IA analyse l'historique réel et propose CA prévu des 3 prochains mois, risques et recommandations.
- Affiché sous forme de graphique (historique + prévision en pointillé) et de texte court.
- Si l'historique est insuffisant, message explicite au lieu d'une prévision inventée.

## Détails techniques
- `AquaAssistantModule.tsx` : fix du bouton plein écran mobile (classes `hidden sm:` à retirer, z-index/safe-area), nouvelles suggestions.
- `supabase/functions/aqua-assistant` : contexte financier unit-scoped (sales, purchases, expenses, payroll, feeding, health) mois courant vs précédent, avec totaux pré-calculés ; migration du modèle vers `openai/gpt-6-astra` via Responses (streaming conservé côté client en adaptant le parseur SSE).
- Nouveau composant `src/components/analytics/BusinessIntelligenceModule.tsx` (Recharts) + entrée dans `AppSidebar`, `MobileNavigation`, routage `?module=business-intelligence`, et ajout dans `moduleAccess` comme module toujours autorisé.
- Nouvelle fonction `ai-forecast` : reçoit l'historique agrégé de l'unité, renvoie une prévision structurée (JSON) en streaming.
