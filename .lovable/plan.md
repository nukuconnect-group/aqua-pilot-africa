# Remplacer le code de app.aquapilote par la nouvelle version

## Dépôts confirmés
- **Source :** `nukuconnect-group/aqua-pilot-africa`.
- **Destination principale :** `nukuconnect-group/app.aquapilote`, qui conserve son nom et son historique.
- La source correspond à la version actuellement ouverte dans Lovable.

## Résultat de l’examen
La nouvelle version ajoute 324 fichiers et modifie 191 fichiers communs. Sept fichiers n’existent que dans la destination, notamment d’anciens fichiers générés pour le mode hors ligne et les en-têtes Cloudflare.

Les connexions et les réglages de déploiement diffèrent : un remplacement aveugle n’est pas sûr. Les en-têtes actuels interdisent aussi la caméra et le microphone, utilisés dans la nouvelle version.

## Opération prévue
1. Créer une branche de sauvegarde de la destination avant tout remplacement.
2. Préparer le transfert sur une branche distincte de `app.aquapilote`, sans toucher immédiatement à sa version principale.
3. Remplacer les anciens fichiers applicatifs par ceux de la source et retirer les anciens fichiers générés devenus obsolètes. Ne pas mélanger les deux interfaces.
4. Préserver les paramètres de connexion existants après comparaison avec la base réellement utilisée par la nouvelle version. Ne copier aucun secret et ne modifier aucune donnée, aucun compte ni aucune fonction déployée.
5. Conserver l’identité Cloudflare `app-aquapilote`, les protections utiles et le fonctionnement des liens directs. Adapter les permissions caméra et microphone aux fonctionnalités existantes.
6. Vérifier l’intégralité des fichiers transférés, les tests disponibles, les résultats de compilation et les écrans accessibles sans créer de vente ou d’opération réelle.
7. Présenter une demande d’intégration GitHub avec le bilan et les vérifications restantes avant remplacement de la branche principale.

## Limites à conserver visibles
- L’accès GitHub autorisé permet d’examiner les dépôts ; il ne change pas la liaison Git de ce projet Lovable.
- La réception du nouveau code par Cloudflare et ses variables hébergées doivent être contrôlées avant d’annoncer le déploiement terminé.
- Les parcours nécessitant un compte connecté restent non vérifiés tant qu’une session utilisable sur la base historique n’est pas disponible.
- Le transfert ne corrige pas à lui seul les fonctionnalités encore inachevées dans la source, notamment le rafraîchissement du tableau des utilisateurs après attribution d’un abonnement.

## Détails techniques
Utiliser des commits ordinaires et une demande d’intégration, sans réécriture d’historique ni push forcé. Les fichiers sensibles et les configurations de connexion font l’objet d’exceptions explicites ; aucun changement de base de données n’est inclus. Le moyen de transfert doit être validé avant les écritures : GitHub n’a pas trouvé l’arbre de la source dans la destination, donc les objets des deux dépôts ne peuvent pas être réutilisés aveuglément.