import { describe, expect, it } from 'vitest';
import { moduleParamToTabId, tabToModuleId } from '../moduleAccess';

describe('navigation Stock séparée de l’Alimentation', () => {
  it('ouvre Stock sans le rediriger vers Alimentation', () => {
    expect(moduleParamToTabId('stock')).toBe('stock');
  });
  it('conserve les droits existants du groupe Alimentation pour Stock', () => {
    expect(tabToModuleId('stock')).toBe('feeding');
  });
  it('ouvre toujours Alimentation depuis son propre lien', () => {
    expect(moduleParamToTabId('feeding')).toBe('feeding');
  });
});