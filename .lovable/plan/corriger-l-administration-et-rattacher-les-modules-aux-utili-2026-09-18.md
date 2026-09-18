# Corriger l’administration et rattacher les modules aux utilisateurs et aux unités

## Résultat attendu

L’accès final à un module suivra cette règle :

```text
Modules du plan
  ∩ modules compatibles avec l’unité active
  ∩ modules autorisés pour l’utilisateur
  ∩ permissions éventuelles du membre d’équipe
  = modules visibles et accessibles
```

L’administrateur conservera l’accès complet.

## Modifications prévues

### 1. Corriger les erreurs encore visibles dans l’administration
- Vérifier le journal à sa source et ne plus compter ni afficher les anciennes erreurs déjà corrigées.
- Harmoniser les compteurs, exports CSV/PDF et la liste affichée pour qu’ils utilisent tous les mêmes erreurs réellement actives.
- Sécuriser la purge : suppression en base quand elle est autorisée, puis masquage persistant côté application si une ancienne ligne ne peut pas être supprimée.
- Vérifier à nouveau Production, l’arbre d’authentification et les abonnements temps réel afin qu’une erreur corrigée ne soit pas recréée.

### 2. Ajouter la limitation des modules par utilisateur
Dans **Admin → Plans & Modules**, ajouter un espace **Utilisateurs** permettant de :
- rechercher et sélectionner un compte par nom ou e-mail ;
- voir son abonnement, ses unités et les modules disponibles ;
- autoriser ou retirer individuellement chaque module ;
- réinitialiser le compte sur les droits hérités de son abonnement ;
- appliquer les changements immédiatement dans le menu et lors de l’ouverture directe d’une page ;
- enregistrer chaque modification dans le journal d’audit.

Une restriction utilisateur ne pourra pas donner accès à un module absent de l’abonnement.

### 3. Rattacher les modules au type d’unité
Ajouter un espace **Types d’unités** dans la même page d’administration, avec une matrice claire et modifiable.

Règles initiales :
- **Fabrication d’aliments** : AquaFeed AI et fonctions nécessaires à la fabrication ; pas de modules d’élevage sans activation explicite.
- **Commercialisation** : ventes, achats, fournisseurs, comptabilité et rapports ; pas d’alimentation, AquaFeed AI, cheptel ou prophylaxie.
- **Écloserie / Grossissement (élevage)** : infrastructures, cheptel, alimentation, prophylaxie et production ; AquaFeed AI seulement s’il est autorisé dans la matrice ; AquaHealth AI reste indépendant et désactivable séparément.
- **Transformation / Conservation** : modules opérationnels adaptés, sans modules d’élevage inutiles.
- Les modules généraux comme tableau de bord, unités, paramètres et support restent accessibles selon le plan.

Lorsqu’un compte gère plusieurs unités, les modules seront recalculés selon **l’unité active**. Un changement d’unité mettra immédiatement à jour le menu et empêchera aussi l’accès par URL à un module incompatible.

### 4. Séparer correctement Prophylaxie et AquaHealth AI
- Donner à **AquaHealth AI** son propre identifiant de permission.
- Garder **Prophylaxie** indépendante.
- Permettre, par exemple, d’autoriser Prophylaxie à une unité d’élevage tout en refusant AquaHealth AI.

### 5. Persistance et sécurité
- Ajouter les structures nécessaires pour les restrictions utilisateur et les règles par type d’unité.
- Appliquer des droits explicites et des règles de sécurité : lecture de ses propres droits pour l’utilisateur, gestion complète uniquement par l’administrateur.
- Ne pas stocker de rôle administrateur dans le profil ni dans le navigateur.
- Conserver un repli sûr si les nouvelles structures ne sont pas encore disponibles, sans ouvrir davantage d’accès que l’abonnement.

## Vérifications
- Tester un administrateur, un utilisateur standard et un membre d’équipe.
- Tester au moins une unité de fabrication, une unité de commercialisation et une unité d’élevage.
- Vérifier le changement d’unité, le menu, l’accès direct par URL et la mise à jour immédiate après modification admin.
- Vérifier que les erreurs historiques ne reviennent pas et que les nouvelles erreurs réelles restent visibles/exportables.
- Vérifier l’affichage sur ordinateur et mobile.
