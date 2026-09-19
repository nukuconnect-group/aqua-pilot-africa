import React, { useContext } from 'react';
import { SettingsContext } from '@/contexts/SettingsContext';
import { useAutoTranslate } from './useAutoTranslate';

/** Applique la traduction automatique de l'interface selon la langue choisie. */
const AutoTranslate: React.FC = () => {
  // Tolérant : ne plante pas si le provider n'est pas encore monté (HMR, etc.)
  const settings = useContext(SettingsContext);
  useAutoTranslate(settings?.language ?? 'fr');
  return null;
};

export default AutoTranslate;
