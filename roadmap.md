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
- [ ] Analyse photo : écran existant, service IA à installer sur le serveur de l'application (bloqué : serveur de l'utilisateur)
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
