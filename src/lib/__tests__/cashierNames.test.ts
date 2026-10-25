import { describe, expect, it } from 'vitest';
import { resolveCashierNames } from '../cashierNames';

describe('resolveCashierNames', () => {
  const directory = [
    { id: 'u1', name: 'KOMI SENA AFANDONOUGBO' },
    { id: 'u2', name: 'Afi Mensah' },
  ];

  it('retourne les noms longs intégralement, sans troncature', () => {
    const names = resolveCashierNames(['u1'], directory);
    expect(names).toEqual(['KOMI SENA AFANDONOUGBO']);
    expect(names[0]).not.toContain('…');
    expect(names[0]).not.toContain('...');
  });

  it('résout plusieurs caissiers dans l’ordre des identifiants', () => {
    expect(resolveCashierNames(['u2', 'u1'], directory)).toEqual(['Afi Mensah', 'KOMI SENA AFANDONOUGBO']);
  });

  it('ignore les identifiants inconnus et les noms vides', () => {
    expect(resolveCashierNames(['u1', 'inconnu'], [...directory, { id: 'u3', name: '  ' }])).toEqual(['KOMI SENA AFANDONOUGBO']);
  });

  it('ne duplique pas un même nom affecté deux fois', () => {
    expect(resolveCashierNames(['u1', 'u1'], directory)).toEqual(['KOMI SENA AFANDONOUGBO']);
  });
});
