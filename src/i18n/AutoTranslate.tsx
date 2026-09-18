import React from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useAutoTranslate } from './useAutoTranslate';

/** Applique la traduction automatique de l'interface selon la langue choisie. */
const AutoTranslate: React.FC = () => {
  const { language } = useSettings();
  useAutoTranslate(language);
  return null;
};

export default AutoTranslate;
