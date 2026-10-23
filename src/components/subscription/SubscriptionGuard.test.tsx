import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import SubscriptionGuard from './SubscriptionGuard';

vi.mock('@/hooks/useCurrentSubscription', () => ({ useCurrentSubscription: () => ({ subscription: { isActive: false }, loading: false }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'user', isTeamMember: false }, isDemoMode: false }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

describe('AquaAssistant et abonnement expiré', () => {
  it.each([['aqua-assistant', true], ['sales', false]])('accès au module %s : %s', async (moduleId, accessible) => {
    const container = document.createElement('div');
    const root = createRoot(container);
    let mounted = false;
    function ProtectedContent() { mounted = true; return null; }
    await act(async () => root.render(<SubscriptionGuard moduleId={String(moduleId)}><ProtectedContent /></SubscriptionGuard>));
    expect(mounted).toBe(accessible);
    await act(async () => root.unmount());
  });
});