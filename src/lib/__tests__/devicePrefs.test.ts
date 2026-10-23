import { describe, it, expect } from 'vitest';
import { createWedgeReader } from '../devicePrefs';
describe('lecteur code-barres clavier', () => {
  it('lit un EAN tapé rapidement puis Entrée', () => {
    const r = createWedgeReader(); let t = 0; let out: string | null = null;
    for (const k of [...'2000000000015', 'Enter']) out = r(k, (t += 10));
    expect(out).toBe('2000000000015');
  });
  it('ignore une saisie humaine lente', () => {
    const r = createWedgeReader(); let t = 0; let out: string | null = null;
    for (const k of [...'1234', 'Enter']) out = r(k, (t += 300));
    expect(out).toBeNull();
  });
});
