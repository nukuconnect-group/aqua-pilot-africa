# Uniformiser AquaFeed et les modules par type d’unité

## Résultat attendu
- Les écrans **Prophylaxie alimentaire**, **Production d’aliments** et **Traçabilité** suivent immédiatement la langue sélectionnée, y compris formulaires, statuts, tableaux, messages vides et exports.
- Une unité **Fabrication d’aliments** masque **Cheptel**.
- Une unité **Commercialisation** masque **Alimentation** et **AquaFeed**.
- Le parcours complet fonctionne en anglais, puis revient correctement en français.

## Mise en œuvre
1. **Traductions des écrans AquaFeed**
   - Relier les trois écrans et leurs onglets au système de langue centralisé.
   - Traduire les libellés calculés et stockés sous forme de codes (types, statuts, états), sans modifier les données enregistrées.
   - Localiser les titres, colonnes et valeurs des exports.

2. **PDF complet en anglais**
   - Compléter l’export de formulation avec toutes les informations : identité de la formule, espèce/stade, quantité, ingrédients, pourcentages, coûts, nutrition, prix conseillé, marge, unité et date.
   - Générer le document dans la langue active et vérifier visuellement sa lisibilité page par page.

3. **Configuration centralisée des unités**
   - Consolider les règles dans la configuration unique des modules par type d’unité.
   - Appliquer ces règles après l’abonnement et les permissions utilisateur/équipe, afin qu’elles ne puissent pas être contournées dans les menus ni par navigation directe.
   - Conserver les autres règles existantes sans élargir les accès.

4. **Validation du parcours bilingue**
   - Vérifier la connexion en anglais.
   - Créer ou utiliser une unité de test **Fabrication d’aliments**, confirmer l’absence de Cheptel, ouvrir AquaFeed et le formulaire de formulation, puis lancer l’export PDF anglais.
   - Passer en français et vérifier les mêmes écrans, statuts, boutons et formulaires.
   - Contrôler les erreurs de console et exécuter les vérifications du projet.

## Détails techniques
- Les valeurs persistées restent stables (`fabrication_aliment`, `commercialisation`, codes de statut) ; seule leur présentation est traduite.
- L’accès effectif reste l’intersection : abonnement ∩ type d’unité ∩ permissions utilisateur ∩ permissions équipe.
- Les données de test créées uniquement pour la vérification seront supprimées si elles ne préexistaient pas.
