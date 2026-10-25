## Disposition commune des analyses (25/10/2026)
- [ ] Rétablir Analytique : disposition commune, indicateurs et graphiques commerciaux adaptés
- [ ] Améliorer Intelligence & Analyse avec courbes interactives et prévisions distinctes
- [ ] Vérifier les dispositions, filtres et tests existants

## Erreurs Analytique et Intelligence & Analyse (25/10/2026)
- [x] Reproduire Invalid time value lors d’une date vide et corriger ; gérer les lectures échouées sans chargement permanent ; actualisation sans rechargement de page
- [x] 9 tests réussis, écrans isolés sans erreur, date vide ne ferme plus l’analyse ; compilation réussie
- [ ] Confirmer le problème signalé depuis le compte connecté : session historique indisponible ; contrôles isolés uniquement, aucune donnée réelle modifiée

## Amélioration AquaAssistant (25/10/2026)
- [x] Moderniser le module existant, synthèse réelle et conversation lisible, miniature conservée
- [x] Questions et raccourcis contextuels ; alertes datées avec source/priorité/recommandation
- [x] Contexte IA : backend historique, IDs accessibles, données absentes explicites ; fonction déployée ; refus anonyme confirmé
- [x] 26 tests ciblés réussis ; question rapide et saisie conservée entre vues ; miniature mobile vérifiée sans erreur
- [ ] Vérifier synthèse et réponse IA avec le compte réel : navigateur sur /auth et appel protégé refusé 401, session historique indisponible ; aucune donnée réelle modifiée

## Analyses commerciales, assistant et amortissements (24/10/2026)
- [x] AquaAssistant : menu latéral en écran normal, icône en fenêtre compacte ; question non envoyée conservée et affichage mobile vérifié
- [x] Commercialisation : ventes, encaissements, créances, achats et solde réels ; prévisions et rapport générés automatiquement ; 6 tests réussis
- [x] Infrastructures : option d’amortissement installée sur la base réelle ; essai réel annulé sans données conservées
- [ ] Vérifier l’écran Commercialisation avec le compte connecté : session indisponible, affichage du rapport réel non confirmé

## Commercialisation et contrôle des QR (24/10/2026, 23:43 UTC)
- [x] Compléter le QR avec nom, type et numéro enregistré s’il existe ; aucun numéro distinct dans les données contrôlées, référence persistée affichée sans invention
- [x] Masquer Cheptel, Prophylaxie et AquaHealth IA en Commercialisation, y compris accès direct ; configuration obsolète testée
- [x] Présenter uniquement le stock commercial, créations et imports commerciaux sans modifier les anciens articles ; brouillon production sauvegardé comme commercial vérifié
- [x] Contrôler les placements QR des cartes et PDF ; attendre images et rendu avant impression ; PDF généré à partir d’un relevé réel et QR scanné avec nom/type/identité corrects ; 78 tests réussis
- [ ] Vérifier les cartes et téléchargements depuis le compte connecté : navigateur redirigé vers onboarding, session historique indisponible ; contrôles isolés uniquement, aucune donnée réelle modifiée

## QR des infrastructures (24/10/2026)
- [x] Afficher un QR stable sur chaque infrastructure et sa carte d’alimentation
- [x] Inclure le même QR dans les PDF, impressions, Word, Excel et programmes ; CSV contient la référence du QR
- [x] Tester l’identité par unité : 37 tests réussis ; QR et conversion PNG/PDF vérifiés isolément avec une infrastructure réelle, sans écriture
- [ ] Vérifier le téléchargement depuis les écrans du compte réel : navigateur sur onboarding, session réelle indisponible

## Vérifications demandées avec le compte connecté (24/10/2026, 13:13 UTC)
- [ ] Vérifier le maintien de l’accès hors ligne et des saisies au retour dans l’application avec le compte réel — session du backend historique non disponible au navigateur de test ; génération automatique de la session personnelle refusée (aucun compte correspondant sur le backend géré).
- [ ] Tester matin, midi et soir sur une journée, relire les enregistrements et vérifier le PDF depuis le compte réel — même blocage ; ne pas créer de nourrissages fictifs dans les données de production.

## Programme daté et accueil succinct (24/10/2026)
- [x] Retirer la réinitialisation automatique des écrans lents et l’activation forcée des mises à jour ; contrôles en arrière-plan, pas au retour de focus
- [x] Préciser la limite : première connexion/création de compte exigent Internet ; aucun accès hors ligne simulé
- [x] Accueil AquaAssistant court avec le nom réel de la ferme
- [x] Programme sur une semaine ou dates libres, quantités/heures par jour
- [x] Fiche journalière cumulant les périodes, suivi et PDF par date
- [x] Tests ciblés réussis ; aperçu /auth conserve la page après focus et coupure/reconnexion, aucun stock réel modifié
- [ ] Vérifier nourrissage, PDF, retour au premier plan et accès hors connexion avec le compte réel : session de la base historique indisponible, aperçu sur /auth

## Corrections Alimentation et chatbot (24/10/2026, 10:30)
- [x] Création de fiche acceptée par la base réelle (une infrastructure, quantités et heures matin/midi/soir)
- [x] Une infrastructure sur une seule fiche active ; désactiver l’autre fiche pour la réutiliser
- [x] Nourrir : effectif, prescrit, prélevé, servi, restant, mortalité, comportement, raison ; fonctionne sans la fonction serveur
- [x] PDF/impression journaliers plus professionnels, remplis avec les nourrissages réels
- [x] Chatbot : bulle d’accueil dépliée à l’arrivée, flèche pour réduire et redéplier
- [ ] Vérifier création, nourrissage et PDF avec un compte connecté : aperçu sur la page de connexion

## Fiches avancées de nourrissage (24/10/2026)
- [x] Nouvelle précision : exactement une infrastructure par fiche ; création bloquée sans infrastructure ; effectifs disponibles sur les infrastructures ; anciennes fiches multiples conservées mais correction requise avant nourrissage
- [x] Revoir les fiches modifiables et leurs exports PDF/impression
- [x] Période et heure réelle ; prescription, prélèvement, service et retour ; mortalité
- [x] Préparer l’enregistrement atomique et idempotent des mouvements, mortalités et comptabilité dans docs/sql/feeding_distribution.sql ; interface sans repli partiel
- [x] Protéger les brouillons contre les rechargements ; arrêter les rechargements forcés pendant les mises à jour ; tests ciblés réussis dont 20/15/5, infrastructure unique et refus sans perte de saisie
- [ ] Activer record_sheet_feeding sur la base historique de l’application : outil de migration disponible lié à une autre base, aucun accès d’administration à la base réelle ; aucun déploiement revendiqué
- [ ] Vérifier le nourrissage connecté et le PDF réel : navigateur affiche la connexion, session de la base historique indisponible ; aucun stock réel modifié

## Module Alimentation (demande du 24/10/2026)
- [x] Fiches d'alimentation : plusieurs infrastructures par fiche, périodes matin/midi/soir avec heure par période
- [x] Afficher le nombre de poissons par infrastructure (cycle actif) sur les fiches et au nourrissage
- [x] Mortalité : diminuer automatiquement le lot de poissons et l'effectif de l'infrastructure
- [x] PDF de la fiche journalière : en-tête avec logo, signatures consultant et directeur de l'exploitation
- [x] Réparer le bouton « Nourrir » (enregistrement robuste même si la base historique n'a pas les nouvelles colonnes) ; 10 tests réussis, compilation réussie
- [ ] Script docs/sql/feeding_sheets_multi.sql à installer sur la base historique (bloqué : action de l'utilisateur) ; sans lui, une seule infrastructure et une seule période par fiche
- [ ] Vérifier le nourrissage réel avec un compte connecté : session indisponible, aperçu redirigé vers /auth

- [ ] Traduire Prophylaxie alimentaire, Production d’aliments et Traçabilité selon la langue sélectionnée
- [ ] Centraliser les règles de modules par type d’unité
- [ ] Générer et vérifier un PDF complet en anglais
- [ ] Tester le parcours anglais puis français

## Trésorerie et ventes du 20/10/2026
- [x] Préparer les comptes caisse/banque, fonds initiaux et mouvements avec écritures équilibrées ; changement appliqué dans Lovable Cloud
- [x] Ajouter l’annulation des ventes avec motif, historique et contre-écritures datées
- [x] Tester les règles comptables : 20 tests réussis
- [ ] Activer ces changements sur la base historique utilisée par l’application : accès indisponible ici ; script conservé dans docs/sql/treasury_accounts.sql
- [ ] Vérifier création, transfert et annulation avec les données réelles : aucune session disponible, parcours redirigé vers /auth

## Corrections du 20/10/2026
- [x] Rétablir l’accès au Stock depuis les menus et l’Alimentation (tests de résolution des liens réussis)
- [x] Adapter les dispositions Stock et Alimentation aux écrans étroits (vérification visuelle connectée encore bloquée)
- [x] Simplifier le chat sans cartes de stock ni suggestions
- [ ] Vérifier les données du Stock et les écrans connecté : le navigateur arrive sur la connexion, et le service ne peut pas fournir de session pour la base historique utilisée par l’application.

## Refonte générale (plan du 19/10/2026)
- [x] Caisse : ouverture/fermeture, vente par produits réels, QR code, saisie rapide, versement en trésorerie
- [ ] Caisse : installer docs/sql/cash_register.sql sur le serveur de l'application (bloqué : action de l'utilisateur)
- [x] Bulle d'aide flottante AquaAssistant
- [x] Barres de navigation arrondies (mobile et ordinateur)
- [x] Comptabilité SYSCOHADA (plan de comptes, journaux, grand livre, balance, états)
- [x] Gestionnaire de stock + historique des mouvements (installer docs/sql/stock_movements.sql)
- [x] Analyse photo : service déployé dans Lovable Cloud, appel avec la session existante et validation du compte sur la base de l’application
- [ ] Installer docs/sql/hr_attendance.sql sur le serveur (bloqué : action de l'utilisateur)
- [x] RH : pointage GPS/photo hors ligne, retards, heures sup, avances
- [x] Mois gratuit à l'inscription
- [x] Caisse d'épargne (adhérents, carnets, agents, commissions) et boutique intégrée
- [ ] Installer docs/sql/savings_shop.sql sur le serveur (bloqué : action de l'utilisateur)
- [x] Relances clients WhatsApp ; avances sur salaire sorties de la caisse

## Demandes du 20/10/2026 (trésorerie, stock, ventes, CRM)
- [x] Trésorerie : message « doit être activée » remplacé par un message générique ; création de comptes, encaissement, décaissement, transfert déjà en place
- [x] Stock : import CSV avec progression, codes-barres automatiques et impression d'étiquettes
- [x] Ventes : onglets boutique, relances, clients, factures, modèles, étiquettes retirés ; multicaisse avec nom et transfert de fonds entre caisses
- [x] CRM : module Clients & Fournisseurs par unité ajouté au menu

## Demandes du 20/10/2026 (achats, boutique, nourrissage)
- [x] Achats : choix de la caisse/compte de prélèvement, décaissement automatique à l'achat comptant
- [x] Boutique publique : les produits en rupture affichent déjà « Rupture » (vérifié, rien à changer)
- [x] Alimentation : choix du stock à prélever au nourrissage, sortie de stock + écriture comptable automatique (602/321)
- [x] Vente sans caisse : l'écran demande déjà d'ouvrir une caisse (vérifié)

## CRM : présentation et contacts
- [x] Retirer le bandeau et les indicateurs Fournisseurs ; conserver les créations et les données réelles
- [x] Ajouter les icônes WhatsApp, SMS, email et appel aux clients et fournisseurs
- [ ] Vérifier la présentation et les contacts avec un compte réel : session indisponible ; compilation réussie et 6 tests existants réussis

## Ventes et caisses : recherche et encaissement
- [x] Stock : correction existante conservée, suppression confirmée individuelle/groupée et réinitialisation par unité ; aperçu CSV modifiable, arrêt de l’import et résultats par produit ; 10 tests réussis et compilation réussie
- [x] Clarifier les échecs d’encaissement : consignes visibles pour connexion, caisse fermée, accès refusé et reprise ; référence de la vente conservée affichée ; 11 tests existants réussis, compilation réussie (parcours réel toujours bloqué par l’accès au compte)
- [x] Tests isolés de l'écran de caisse : deux articles, quantités décimales, total 6500, rattachement à la caisse et reprise sans seconde vente ; fermeture et exception reproduites puis corrigées (13 tests réussis)
- [x] Rechercher les articles réels de l'unité, ajouter des lignes libres et modifier prix/quantités dans le panier
- [x] Ajouter l'ouverture de plusieurs caisses et l'historique par caisse, avec détails, filtre date/recherche et CSV, y compris après clôture
- [x] Conserver la vente et sa caisse lors d'une reprise d'encaissement dans la page, sans recréer la vente
- [x] Tester les règles : 12 tests réussis et compilation réussie
- [ ] Vérifier un encaissement réel de bout en bout : accès au compte de l'application indisponible ; navigateur redirigé vers /auth, écran de connexion confirmé, aucune vente réelle effectuée
- [ ] Garantir l'atomicité vente/encaissement et transferts côté serveur : accès à la base historique indisponible ; opérations toujours distinctes

## Vérification des actions du stock
- [x] Essais isolés correction, suppression individuelle/groupée et réinitialisation ; champs effacés, seuil nul, quantité zéro et formulaire conservé corrigés
- [ ] Vérifier ces actions avec le stock réel : écran de connexion, aucune session disponible pour le compte existant
- [ ] Installer sur la base réelle les 30 tables manquantes (caisse, mouvements de stock, trésorerie, RH, plans…) — bloqué : adresse de connexion PostgreSQL valide requise
- [x] Messages de caisse sans référence à la connexion/base
- [x] 21/10 : retirer des écrans les messages parlant de serveur ou de fichiers d'installation (stock, boutique, épargne, pointage, ventes)
- [x] Vente assistée par IA dans la caisse (propositions confirmées avant ajout ; non testée connectée)

## AquaHealth : photos du 21/10/2026
- [x] Corriger le parcours photo et les erreurs lisibles ; fonction déployée, refus des appels anonymes confirmé
- [x] Refuser les images sans vrais poissons en indiquant leur sujet ; appel IA réel sur texte « POISSON TILAPIA » : refus correct, sans diagnostic
- [x] Tester les règles et le service : 9 tests réussis, compilation réussie
- [ ] Vérifier une photo réelle de poisson depuis le compte utilisateur : session de la base historique indisponible, écran redirigé vers /auth ; reconnaissance positive non vérifiée en direct

## Caisses, ventes et trésorerie (23/10/2026)
- [x] Solde permanent : réouverture d'une caisse fermée avec reprise du montant compté (tests réussis)
- [x] Bilan de clôture : ouverture, ventes par paiement, entrées/sorties, transferts, théorique, écart
- [x] Écart de clôture enregistré dans les notifications du responsable
- [x] Bouton Verrouiller + verrouillage auto après 5 min, déverrouillage par mot de passe
- [x] Panier visible sur ordinateur, bouton panier sur téléphone
- [ ] Transfert caisse → trésorerie atomique avec écriture comptable (fonction serveur à installer sur la base de l'application)
- [ ] Écriture comptable serveur à chaque vente (pos_post_sale), sans doublon
- [x] Conditionnements unité / pack / carton dans le panier (stock déduit en unités)
- [x] Tableau de suivi des écarts avec mesures correctives (Gestion des caisses)
- [x] Ventes du jour + comptage des espèces avec notification d'écart
- [x] Transfert total ou partiel : autre caisse, compte de trésorerie, remise à une personne
- [x] Désactivation des caisses fermées
- [ ] Tester les 12 scénarios avec un compte connecté (aucune session disponible ici)

## Icônes du 23/10/2026
- [x] Ouvrir AquaAssistant sans restriction d’abonnement ni d’attribution d’équipe ; 26 tests réussis, ouverture/fermeture vérifiée depuis Ventes, Stock et Comptabilité en mode essai ; droits des données inchangés, réponse IA sur compte réel non vérifiable sans session
- [x] Corriger la classe de fond inexistante d’AquaAssistant et Caisse ; icônes visibles et contrastées vérifiées en mode essai sur mobile et ordinateur, ouverture du chat avec module conservé ; 10 tests réussis
- [x] Sortir le bouton AquaAssistant des contraintes d’affichage et le conserver indépendamment des restrictions de module, sans contourner les accès
- [x] Contraster les icônes et boutons de caisse, éviter la compression des onglets ; compilation et 5 tests existants réussis
- [ ] Vérifier visuellement sur le compte réel : connexion nécessaire dans l’aperçu, la session automatique n’est pas disponible pour ce compte

## Demande du 23/10/2026
- [x] Photos réalistes automatiques des produits (par lots), réutilisées sur les fiches
- [x] Import de stock : signaler les produits sans prix
- [x] Caisse : afficher les produits avec photos ; Multi-caisses : retirer le catalogue
- [x] Recherche produit instantanée dans Caisse, Vente IA, Multi-caisses ; Vente IA fonctionnelle
- [x] AquaHealth : détection du poisson sur photo + nom direct + analyse
- [ ] Page Experts (Afrique, Maroc) : photo, titre, numéro, contact WhatsApp / message, notification WhatsApp — fiche prête ; en attente de la photo et d’une connexion WhatsApp Business pour l’envoi automatique
- [x] Ventes passées non reportées en trésorerie : rattrapage vers caisse (espèces/mobile money) ou banque (carte/virement), invitation à créer les comptes manquants

## Mode hors connexion complet (demandé)
- [ ] Étape 1 : application installable et ouverture sans internet (version publiée uniquement)
- [ ] Étape 2 : données de l’unité gardées sur l’appareil, consultables hors ligne
- [ ] Étape 3 : ventes, achats et stock enregistrés hors ligne puis envoyés au retour d’internet
- [ ] Limite : la toute première connexion à un compte exige internet

## Stock commercial / production (demandé)
- [x] Tableau de bord stock : totaux et valeurs séparés commercial / production
- [x] Mouvements : préciser commercial ou production
- [x] Écritures : préciser le type de stock ; aliments consommés = charge (coût × quantité)

## Vérification du refus des types d’unités
- [x] Interface : autoriser tous les types pendant l’essai actif et appliquer les restrictions aux abonnements payants
- [x] Interface : bloquer les écrans des unités à expiration selon les dates et afficher l’invitation à souscrire sans supprimer les données ; 16 tests ciblés réussis
- [ ] Appliquer et vérifier la protection serveur sur la base historique de l’application : déploiement hors de la base Lovable Cloud non disponible ; script préparé dans docs/sql/unit_trial_access.sql
- [x] Vérifier la règle existante : quatre tests réussis, dont grossissement autorisé et fabrication d’aliment refusée
- [x] Corriger le faux succès après un refus de création ou modification et conserver le message du refus
- [x] Bloquer la sauvegarde tant que la lecture des types autorisés n’a pas réussi
- [ ] Vérifier le refus sur le compte réel : session indisponible, aperçu redirigé vers /auth ; aucune unité créée
