# Rendre la refonte AquaAssistant visible et fonctionnelle

## Résultat attendu
- Remplacer l’écran actuellement visible par une interface AquaBrain professionnelle, lisible sur téléphone et ordinateur.
- Afficher uniquement des indicateurs calculés depuis l’unité sélectionnée : cycles, lots/biomasse, stocks/intrants et derniers contrôles.
- Conserver l’historique des conversations, la voix, les langues et le mode plein écran existants.

## Mise en œuvre
1. Corriger les incompatibilités des nouveaux éléments de chat qui bloquent la compilation.
2. Recomposer le module réellement monté avec : en-tête AquaBrain, sélection d’unité, synthèse opérationnelle, progression des cycles, alertes/conseils factuels et chat principal.
3. Utiliser les éléments de conversation, messages Markdown et zone de saisie installés, sans dupliquer le système de chat.
4. Adapter le vocabulaire à l’unité active, notamment Algoculture, et afficher « donnée non renseignée » lorsque les données manquent.
5. Corriger le plein écran au-dessus de toute l’application, les hauteurs mobiles, les zones sûres et la taille des textes/contrôles.
6. Envoyer l’unité sélectionnée au service AquaAssistant et limiter son contexte aux données réelles accessibles de cette unité.
7. Vérifier la compilation, puis contrôler visuellement l’écran normal, le plein écran et le format téléphone.

## Détails techniques
- Réutilisation de `AquaAssistantModule` et de l’historique persistant existant.
- Réutilisation des hooks actuels de cycles, lots, stocks, contrôles et alimentation.
- Aucun chiffre fictif ni contenu de démonstration n’est ajouté à l’assistant.
- Le nouveau symbole AquaBrain devient l’identité de l’assistant et l’icône de l’application.
