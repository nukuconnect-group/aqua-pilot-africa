# Refonte générale AquaPilote — 4 priorités

Ordre de réalisation : un chantier terminé et vérifié avant le suivant. Données réelles uniquement, toujours rattachées à l'unité active.

## 1. Ventes et caisse
- Ouverture de caisse (fond de caisse initial), suivi en direct des encaissements, fermeture avec écart constaté (attendu / compté).
- Écran de vente type caisse enregistreuse : grille des produits réels du stock, panier, client, mode de paiement, ticket.
- Vente par lecture de QR code / code-barres (lecteur déjà présent, réutilisé).
- Vente assistée par IA : saisie en langage naturel (« 20 kg de tilapia à Kossi ») transformée en panier à valider.
- Chaque vente encaissée est versée dans la trésorerie (caisse) du module comptabilité.
- Factures et historique des ventes rafraîchis en temps réel ; les modèles de documents affichent les vrais produits.

## 2. Comptabilité SYSCOHADA révisé
- Plan de comptes SYSCOHADA (classes 1 à 9), modifiable.
- Journaux (ventes, achats, caisse, banque, opérations diverses), écritures générées automatiquement depuis ventes, achats, dépenses et paie, sans double saisie.
- Grand livre, balance générale, lettrage simple, transferts caisse ↔ banque.
- Bilan et compte de résultat au format SYSCOHADA ; clôture d'exercice assistée.
- Fournisseurs intégrés au circuit (commande → réception → facture → paiement).

## 3. Stocks et assistant
- Stock alimentation devenu un vrai gestionnaire : création libre de produits (nom, catégorie, unité, prix, seuil), stock initial, entrées / sorties / ajustements avec historique.
- Bulle d'assistant flottante (ordinateur et mobile) avec message d'accueil après connexion ; fermable, réapparaît discrètement plus tard avec un rappel d'aide ; ouvre AquaAssistant.
- Analyse de photo de poisson malade (AquaHealth) : diagnostic probable et traitements proposés, avec mention de prudence.

## 4. RH et interface
- Départements, postes, horaires ; pointage mobile avec position GPS, zone autorisée et photo, enregistré même hors réseau puis synchronisé.
- Calcul quotidien des retards, heures supplémentaires et oublis de sortie ; avances sur salaire reliées à la caisse et retenues sur la fiche de paie.
- Barres de navigation (mobile et ordinateur) aux bords arrondis, rendu plus soigné.
- À l'inscription : choix d'un abonnement avec premier mois gratuit d'essai.

## Plus tard (validé, après ces 4 chantiers)
Tontine avancée, boutique en ligne avec synchronisation WooCommerce, relance des clients (CRM WhatsApp).

## Point important — serveur
Vous gardez votre propre serveur. Les fonctions IA (assistant, vente par IA, analyse de photos, prévisions) et les nouvelles tables doivent y être installées. Je fournirai à chaque étape les fichiers à installer ; sans cela ces parties afficheront « service indisponible » au lieu de fausses réponses.

## Détails techniques
- Nouvelles tables : `cash_registers`, `cash_sessions`, `cash_movements`, `chart_of_accounts`, `journal_entries`, `journal_lines`, `stock_products`, `stock_movements`, `attendance_records`, `departments`, `work_schedules` ; RLS par propriétaire + membres d'équipe, filtre `unit_id`.
- Écritures comptables générées par triggers sur `sales`, `purchases`, `pay_slips`, `cash_movements`.
- Temps réel via les canaux existants (`realtimeChannel.ts`).
- Pointage hors ligne via `offlineStorage`/`offlineSync` existants.
- SQL fourni aussi dans `docs/sql/` pour installation sur le serveur de l'utilisateur.
