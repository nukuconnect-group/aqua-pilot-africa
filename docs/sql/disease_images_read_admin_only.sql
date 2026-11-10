-- Restreindre la lecture du dossier de photos de maladies aux administrateurs.
-- Avant : tout compte connecté pouvait télécharger les fichiers de disease-images.
-- Après : seuls les administrateurs peuvent les lire, comme pour l'ajout, la
-- modification et la suppression (disease_imgs_admin_write / _update / _delete).
-- Aucune donnée n'est supprimée ; le dossier était vide et aucun écran de
-- l'application ne le lit.

BEGIN;

DROP POLICY IF EXISTS disease_imgs_read ON storage.objects;

CREATE POLICY disease_imgs_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'disease-images'
    AND has_role(auth.uid(), 'admin'::app_role)
  );

COMMIT;
