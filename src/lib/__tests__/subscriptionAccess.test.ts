import { describe, it, expect } from 'vitest';
import { subscriptionAccess } from '../subscriptionAccess';

describe('Période d’essai et expiration', () => {
  const trial = { status: 'trial', start_date: '2026-09-24', end_date: '2026-10-24' };
  it('conserve le dernier jour d’essai actif', () => {
    expect(subscriptionAccess(trial, '2026-10-24').isTrial).toBe(true);
  });
  it('bloque dès le lendemain même si le statut est encore trial', () => {
    const result = subscriptionAccess(trial, '2026-10-25');
    expect(result.isActive).toBe(false);
    expect(result.isExpired).toBe(true);
  });
  it('rétablit l’accès avec un abonnement payant en cours', () => {
    expect(subscriptionAccess({ ...trial, status: 'active', end_date: '2026-11-24' }, '2026-10-25').isActive).toBe(true);
  });
});