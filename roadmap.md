# Ajustements Ventes et abonnements
## Erreur du tableau de bord
- [x] Écran blanc revérifié à 393 × 604 : le chargement actuel React rend correctement un composant avec `useState` dans le navigateur ; aucun worker PWA enregistré ni contrôleur actif. Tests supplémentaires couvrant le domaine exact de l’erreur et les aperçus, sans retirer les workers de notifications. Aucun changement du code métier ni redémarrage : le chargement frais ne reproduit pas l’erreur des anciennes versions.
- [x] Identifier l’erreur `useState` du 25 octobre : les traces de l’aperçu mélangent deux versions des modules React (`2225e7be` et `7516dd16`) ; aucune modification des calculs ou de l’authentification. Huit tests tableau de bord/installation/hors ligne réussis. À l’ouverture fraîche, aucun worker ni erreur JavaScript, mais redirection vers Connexion.
- [ ] Confirmer le tableau de bord connecté après actualisation manuelle unique de l’aperçu : session de la base historique non disponible dans le navigateur de contrôle ; l’écran déconnecté ne valide pas le tableau de bord.
## Harmonisation mobile
- [x] Ajustements ciblés dans les huit modules : onglets deux colonnes, formulaires achats empilés, actions/fiches alimentation, en-têtes cycles/caisses/factures et états SYSCOHADA. 30 tests ciblés réussis ; contrôles partagés isolés à 320/393 px sans débordement, changement d’onglet vérifié. Ce contrôle isolé ne valide pas les modules connectés.
- [ ] Contrôle connecté des huit modules et correction des problèmes trouvés dès qu’une session est disponible : accès revérifié le 25 octobre 2026, aperçu déconnecté et connexion personnelle impossible (aucun compte correspondant). À vérifier : filtres et acquittement d’alertes ; bassins/MQTT/seuils ; visualisation/traçabilité/quarantaine/mortalité du cheptel ; création/modification/détails de cycles ; traitement et persistance de prophylaxie ; fiches/nourrissage/PDF ; écritures/trésorerie/export ; caisse/panier/clôture/verrouillage/opérations/factures/échéances. Aucune opération réelle créée.
- [x] Essai d’un mois gratuit déjà en premier : inscription vérifiée à 320, 393 et 1280 px, sans créer de compte ; page abonnement également ordonnée.
- [x] Corriger les largeurs communes, onglets, fenêtres et tableaux sans masquer les informations.
- [x] Adapter paramètres du tableau de bord, graphiques vides, performances et Centre IoT/MQTT ; contrôle connecté restant ci-dessous.
- [x] Aligner les actions cheptel et pêche, afficher les noms des objectifs, préciser la photo AquaHealth et relire les lots après mortalité, sans changer les écritures existantes.
- [x] Appliquer les protections communes aux unités, infrastructures, comptabilité, ventes/achats et modules de gestion.
- [ ] Vérifier tous les modules et actions en compte connecté : aucune session accessible pour le compte demandeur ; inscription seule vérifiée, aucune vente ni mortalité réelle créée. Les actions console-only des cycles et traitements locaux exigent un parcours connecté pour validation avant modification métier.

## Travaux précédents
- [x] Ajuster uniquement la largeur du menu téléphone à 240 px maximum, conserver tablette/ordinateur et présenter l’essai gratuit en premier.
- [x] Ouvrir Ventes sur l’unité unique ou déjà sélectionnée, avec possibilité de changer.
- [x] Placer les trois actions nommées sous les données de caisse et ajouter l’icône stock.
- [x] Mettre à jour les offres affichées et les contrôles de création côté écran ; 44 tests réussis.
- [ ] Activer rattachements multi-unités, destination explicite et limites serveur : scripts préparés, mais l’outil de migration disponible cible une autre base que la base historique (ne pas y appliquer).
- [ ] Vérifier les écrans Ventes connectés et les écritures serveur : aucune session disponible pour votre compte ; l’aperçu redirige vers Connexion. Aucune vente ni écriture réelle créée.