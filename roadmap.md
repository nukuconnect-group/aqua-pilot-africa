## Barre de caisse et largeur du menu mobile (25/10/2026)
- [x] Conserver toutes les informations dans une barre de caisse lisible : libellés complets, grille compacte mobile, actions en icônes
- [ ] Réduire uniquement la largeur du menu téléphone à 240 px maximum ; préserver tablette, ordinateur, textes, icônes et défilement
- [ ] Vérifier les dimensions et relancer les tests de caisse ; contrôle connecté indisponible

## Navigation Ventes et panier mobile (25/10/2026)
- [x] Masquer les raccourcis après sélection et ajouter un retour sans perdre le panier
- [x] Disposition mobile en deux zones défilantes : recherche et panier après ajout, recherche et encaissement épinglés ; disposition ordinateur conservée
- [x] 15 tests ciblés réussis, dont panier de 6500 conservé au retour ; compilation OK
- [ ] Vérifier visuellement la caisse à 393×604 sur le compte réel : session historique indisponible, dernier contrôle navigateur sur /auth ; aucune vente réelle effectuée

## Parcours Ventes mobile (25/10/2026)
- [x] Ouvrir Ventes sur Gestion des caisses sur mobile, y compris pour les utilisateurs affectés ; droits serveur inchangés
- [x] Afficher les cartes et la création sans bandeau de vente, ouvrir directement la caisse et intégrer Vente IA à Multi-caisses
- [x] 14 tests ciblés réussis, accès à la caisse sélectionnée et paniers multi-clients distincts ; compilation OK
- [ ] Vérifier l’affichage et les affectations depuis le compte réel : session personnelle non disponible, navigateur mobile redirigé vers /auth sans erreur ; aucune donnée réelle modifiée

## Module Ventes mobile et logo menu (25/10/2026)
- [x] Ventes mobile : grille de raccourcis 3 colonnes, cartes de caisses complètes (unité, ouverture, caissiers affectés et connecté), noms longs non tronqués, tuile quantités du jour ; 9 tests réussis, compilation OK ; affichage compte réel non vérifié (session indisponible)
- [x] Logo du menu mobile : fond blanc étendu à toute la section du logo, s'arrêtant à la ligne de séparation du bas sans toucher les modules ; badge membre et croix de fermeture passés en bleu marine sur blanc ; contrôle isolé à 393 px et classes de couleur vérifiées, menu connecté non ouvert (session indisponible)

## Tableau de bord et IoT commercial (25/10/2026)
- [x] Réduire les icônes ordinateur et placer les accès rapides avant les graphiques sur ordinateur ; ordre mobile conservé
- [x] Compacter le sélecteur mobile et appliquer réellement les périodes aux données financières ; 7/30/365 jours, salaires datés et graphiques adaptés
- [x] Conserver l’en-tête et les onglets habituels IoT pour Commercialisation, uniquement températures réelles des infrastructures ; retrait de l’interface illustrée distincte
- [x] 11 tests ciblés réussis, clics 7 jours/Mois/Année et paramètres URL vérifiés ; affichage 393/768/1280 px sans débordement, analyse thermique ouverte, compilation OK
- [ ] Vérifier les données depuis le compte connecté : accès de contrôle refusé, navigateur redirigé vers Connexion ; aucune donnée réelle modifiée

## Actualisation, installation et emails (25/10/2026)
- [x] Actualisation partagée bouton/tirage, requêtes actives avec erreurs remontées ; lectures des hooks refusées signalées ; chargement initial des unités uniquement ; fournisseur ajouté ; geste ignore les listes déjà défilées
- [x] 23 tests réussis dont nouvelle lecture du stock par unité, quantité actualisée, saisie et écran conservés, refus serveur remonté ; contrôles bouton/tirage à 360/393/768/1280 px en mode isolé
- [x] Parcours Android natif simulé et instructions iPhone/iPad testés en Chromium ; capture précoce de l’événement d’installation corrigée ; domaine réel HTTPS et icônes OK, manifeste sans erreur ; Chromium ne signale que le mode privé du banc de test
- [ ] Vérifier lectures du compte réel et installation physique Android/Safari iPhone : session historique indisponible (création de session personnelle refusée), aucun appareil physique accessible
- [ ] Configurer les emails de notifications depuis app.aquapilote.com : domaine d’envoi absent, configuration par le propriétaire requise avant modèles/envoi

## Installation AquaPilote (25/10/2026)
- [x] Statut centralisé ; événements navigateur partagés, aucun statut installé déduit du stockage local ou de l’acceptation seule
- [x] Une seule invitation globale, photo générée, logo actuel, fermeture respectée sept jours ; section visible dans Paramètres
- [x] Icônes réelles 192/512 px et maskable, Apple adaptées ; identité de lancement conservée ; bouton flottant mobile 44 px
- [x] 11 tests réussis ; fenêtre et fermeture à 320/393/430/768/1280 px ; superposition assistant corrigée ; instructions iPhone dans Paramètres contrôlées en Chromium, confirmation simulée supprime les invitations ; compilation OK
- [ ] Installation/désinstallation réelle Android, Safari iOS et ordinateur : appareils physiques et installation native indisponibles dans cet aperçu ; parcours connecté non vérifié faute de session historique

## Photos du tableau de bord et actualisation mobile (25/10/2026)
- [x] Remplacer le fond mobile par les deux images fournies hébergées, alternées toutes les 30 minutes
- [x] Ajouter bouton et tirage vers le bas ; relire les sources montées du tableau de bord et les requêtes actives sans rechargement ni remontage
- [x] Deux images chargées et alternance à 30 minutes contrôlées ; bouton et geste vérifiés, écran conservé, en-tête sans débordement à 320/393/768 px ; 14 tests ciblés distincts réussis, compilation OK
- [ ] Vérifier la relecture des données du compte réel et le geste dans l’app installée : session historique indisponible ; contrôles d’interaction isolés uniquement

## Indicateurs et en-tête mobiles (25/10/2026)
- [x] Réduire la hauteur des quatre indicateurs à 104 px sur mobile et colorer distinctement leurs icônes
- [x] Garder AquaPilote sur une ligne ; contenir notification, recherche et langue sans débordement
- [x] Vérifier l’affichage à 320, 393, 768 et 1280 px et l’ouverture de Recherche, sans erreur
- [x] Ajouter une image légèrement floutée d’aquaculteur au travail derrière le titre et les filtres mobiles

## Infrastructures commerciales et chaîne du froid (25/10/2026)
- [x] Vérifier l’option d’amortissement et son lien comptable par unité : création et maintien des modifications comptables confirmés en transaction annulée
- [x] Adapter types, équipements et matériel ; rattacher les lots de Stock de la même unité ; erreurs de sauvegarde conservant la saisie
- [x] Adapter le centre IoT aux températures enregistrées, courbes et analyses des chambres froides ; relevé manuel daté, pas de simulation ni durée de dépassement inventée
- [x] 10 tests réussis ; formulaire commercial à 393, 768 et 1280 px sans débordement ; compilation OK
- [ ] Vérifier création, rattachement de Stock et relevé depuis le compte réel : session historique indisponible. Aucun capteur connecté ni chambre froide commerciale enregistrée à ce jour ; connexion automatique des capteurs non réalisée faute de source réelle.

## Tableau de bord et menu mobile (25/10/2026)
- [x] Bandeau plus haut, titre lisible, quatre indicateurs en deux colonnes, sources existantes filtrées par unité et contenus commerciaux adaptés
- [x] Accès rapides sous les dépenses ; menu élargi et aligné à gauche au-dessus des autres éléments ; AquaAssistant après Paramètres, agrandi avec zoom léger désactivé en mouvement réduit
- [x] Tableau contrôlé à 390, 768 et 1280 px ; 24 écrans ouverts isolément sur téléphone, débordements Stock/Ventes/Paramètres/IoT corrigés ; 16 tests d’accès et 5 tests navigateur réussis, compilation OK
- [ ] Vérifier les données personnelles de chaque type d’unité : session historique indisponible ; contrôles isolés uniquement, aucune donnée réelle modifiée

## Discussions AquaAssistant invisibles (25/10/2026)
- [x] Zone de discussion non nulle, questions dans le défilement, dernier message visible ; création d’historique avec échange complet sans réinitialisation
- [x] Écrit visible et conservé sur 390, 694, 768 et 1280 px, écran et fenêtre flottante ; 5 tests navigateur et 7 tests vocaux réussis, compilation OK ; capture et courbe avec audio fourni et affichage du texte dicté contrôlés isolément
- [ ] Réponse et transcription depuis le compte réel : session historique indisponible, génération de session refusée faute d’utilisateur dans le service d’aperçu ; aucune donnée réelle modifiée

## Transcription vocale réelle (25/10/2026)
- [x] Capture WAV réelle en mémoire, courbe mesurée, transcription protégée par la session historique ; aucune persistance audio
- [x] Validation appelle la transcription complète puis l’envoi existant ; annulation conserve le brouillon ; fragments incomplets et refus ne sont pas envoyés
- [x] Fonction déployée ; phrase française synthétisée réellement transcrite (HTTP 200) ; 7 tests réussis, capture navigateur avec audio parlé et courbe variable vérifiée ; refus 401 confirmé
- [ ] Vérifier l’envoi et la réponse depuis le compte réel : session historique indisponible, génération de session impossible (aucun utilisateur dans le service d’aperçu) ; aucune donnée du compte modifiée

## AquaAssistant : synthèse mobile et vocal (25/10/2026)
- [x] Compacter les indicateurs en deux colonnes sur téléphone et aligner mesures, alertes et commandes
- [x] Adapter aussi la synthèse et le chatbot aux ordinateurs et tablettes : deux colonnes en espace réduit, quatre en espace large
- [x] Ajouter une courbe réelle du microphone, une durée, annulation et envoi explicite du texte dicté dans la conversation existante ; pas de stockage audio
- [x] 26 tests ciblés réussis ; contrôles isolés à 390, 768 et 1280 px sans débordement ni erreur ; annulation préserve la saisie, envoi rejoint le traitement existant et restaure le texte après refus anonyme ; compilation réussie
- [ ] Vérifier données personnelles, parole réelle et réponse IA depuis le compte connecté : session historique indisponible ; dictée testée avec reconnaissance simulée, pas de données réelles modifiées

## Fond AquaAssistant encore plus sobre (25/10/2026)
- [x] Retirer les deux voiles dégradés et l’ombre de la conversation ; entête en aplat marine très léger, réponses en carte à bordure fine
- [x] Contrôle isolé : aucun dégradé ni image d’arrière-plan détecté dans la surface, rendu sobre et lisible ; compilation réussie

## Rapports et présentation AquaAssistant (25/10/2026)
- [x] Rétablir la disposition habituelle de Rapports en Commercialisation avec contenus commerciaux par unité
- [x] AquaAssistant : fond illustré flouté d’abord posé, puis refusé par l’utilisateur et remplacé par un fond sobre sans image (voir section ci-dessus), discussion existante conservée
- [x] 30 tests réussis ; six onglets/modèles, aperçu et PDF vérifiés isolément avec enregistrements réels ; fond chargé, saisie conservée et affichage mobile sans débordement
- [ ] Vérifier Rapports et la réponse IA depuis le compte connecté : session historique indisponible, aperçu redirigé vers /auth ; aucune donnée réelle modifiée

## Erreurs restantes Analytique (25/10/2026)
- [x] AquaAssistant mobile : accès existant sans débordement ni erreur ; avatar absent/inaccessible vérifié, dimension de silhouette corrigée
- [x] Dates/quantités manquantes sécurisées, relevés non mesurés conservés absents, filtres unité/période et actualisation corrigés sans changement de disposition
- [x] 11 tests réussis ; écrans isolés sans erreur et compilation réussie
- [ ] Vérifier les données et la photo du compte réel : session historique indisponible ; aucun changement aux données réelles

## Barre latérale AquaAssistant et profil (25/10/2026)
- [x] Icône robot inspirée de la référence dans les menus ordinateur/mobile ; discussion existante conservée
- [x] Photo existante conservée ; avatar silhouette élégant dans le profil et menu de déconnexion
- [x] Ouverture depuis les deux menus vérifiée en contrôle isolé, sans débordement ni erreur ; 14 tests d’accès réussis
- [ ] Vérifier photo personnelle et réponse IA avec le compte réel : session historique indisponible

## Disposition commune des analyses (25/10/2026)
- [x] Rétablir Analytique : quatre indicateurs, onglets, grille de graphiques ; données commerciales adaptées
- [x] Intelligence & Analyse : tableau BI distinct, courbes/histogrammes, sélection de plage et prévisions tracées séparément
- [x] 9 tests réussis, disposition et onglets vérifiés isolément sur ordinateur/mobile ; compilation réussie
- [ ] Vérifier les courbes remplies depuis le compte réel : session indisponible, aucun montant d’essai créé

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
