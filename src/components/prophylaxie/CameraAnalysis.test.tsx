import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/integrations/supabase/appClient', () => ({ supabase: { auth: { getSession: state.getSession } } }));
import { analyzeWithAI, VisionResultView } from './CameraAnalysis';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('AquaHealth request flow', () => {
  it('requires the existing application session without sending a photo anonymously', async () => {
    state.getSession.mockResolvedValue({ data: { session: null } });
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(analyzeWithAI({ mode: 'image' })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('calls the deployed vision function using the existing application token', async () => {
    state.getSession.mockResolvedValue({ data: { session: { access_token: 'isolated-test-token' } } });
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ isFishPhoto: true, analysisAllowed: true, diseases: [], recommendations: [] }) });
    vi.stubGlobal('fetch', fetcher);
    await analyzeWithAI({ mode: 'image', imageBase64: 'data:image/jpeg;base64,/9j/' });
    expect(fetcher).toHaveBeenCalledWith(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aqua-health-vision`, expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer isolated-test-token' }) }));
  });
  it('propagates a terminal safe denial without retry', async () => {
    state.getSession.mockResolvedValue({ data: { session: { access_token: 'isolated-test-token' } } });
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Accès IA désactivé' }) });
    vi.stubGlobal('fetch', fetcher);
    await expect(analyzeWithAI({ mode: 'image' })).rejects.toThrow('Accès IA désactivé');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('never renders disease details for an ineligible image', async () => {
    const div = document.createElement('div'); const root = createRoot(div);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => root.render(<VisionResultView result={{ analysisAllowed: false, subject: 'Chat', diseases: [{ name: 'Must not display', confidence: 50, severity: 'high' }], recommendations: ['Must not display'] }} />));
      expect(div.textContent).not.toContain('Must not display');
      expect(div.querySelectorAll('[role="status"]')).toHaveLength(1);
    } finally { await act(async () => root.unmount()); }
  });
});