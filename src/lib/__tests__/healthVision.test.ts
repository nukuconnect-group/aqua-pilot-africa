import { describe, it, expect } from 'vitest';
import { enforceFishPhoto, type HealthResult } from '../../../supabase/functions/aqua-health-vision/result';

const result: HealthResult = { species: 'Tilapia', observations: ['Lésion visible'], diseases: [{ name: 'Hypothèse', confidence: 30, severity: 'low' }], recommendations: ['Consulter un vétérinaire'] };
describe('AquaHealth photo eligibility', () => {
  it('analyses an explicitly identified real fish photo', () => {
    const accepted = enforceFishPhoto({ ...result, isFishPhoto: true }, 'image');
    expect(accepted.analysisAllowed).toBe(true);
    expect(accepted.diseases).toHaveLength(1);
  });
  it('identifies another object without diagnoses or treatments', () => {
    const rejected = enforceFishPhoto({ ...result, subject: 'Chat', isFishPhoto: false }, 'image');
    expect(rejected.subject).toBe('Chat');
    expect(rejected.analysisAllowed).toBe(false);
    expect(rejected.diseases).toEqual([]);
    expect(rejected.recommendations).toEqual([]);
    expect(rejected.species).toBeNull();
  });
  it('refuses writing or drawing of fish', () => {
    expect(enforceFishPhoto({ ...result, subject: 'Texte « poisson »', isFishPhoto: false }, 'image').analysisAllowed).toBe(false);
    expect(enforceFishPhoto({ ...result, subject: 'Dessin de poisson', isFishPhoto: false }, 'image').diseases).toEqual([]);
  });
  it('does not infer fish eligibility from a species name alone', () => {
    expect(enforceFishPhoto(result, 'image').analysisAllowed).toBe(false);
  });
  it('preserves species reference searches', () => {
    expect(enforceFishPhoto(result, 'species')).toEqual(result);
  });
});