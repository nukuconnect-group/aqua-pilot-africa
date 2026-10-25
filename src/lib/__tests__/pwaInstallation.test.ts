import { describe, it, expect } from 'vitest';
import { installationStatus, canInvite, INSTALL_DISMISS_MS } from '../pwaInstallation';

describe('installation evidence and invitations', () => {
  it('requires confirmation to mark installed', () => {
    expect(installationStatus(true, false)).toBe('installed');
    expect(installationStatus(false, false)).toBe('unknown');
  });
  it('native invitation is evidence of current install availability', () => {
    expect(installationStatus(false, true)).toBe('not-installed');
  });
  it('never automatically invites a confirmed installation', () => {
    expect(canInvite('installed', false, 0, 100)).toBe(false);
  });
  it('does not invite unknown browser or autonomous app sessions', () => {
    expect(canInvite('unknown', false, 0, 100)).toBe(false);
    expect(canInvite('not-installed', true, 0, 100)).toBe(false);
  });
  it('respects dismissal for seven days', () => {
    expect(INSTALL_DISMISS_MS).toBe(604800000);
    expect(canInvite('not-installed', false, 100, 100 + INSTALL_DISMISS_MS - 1)).toBe(false);
    expect(canInvite('not-installed', false, 100, 100 + INSTALL_DISMISS_MS)).toBe(true);
  });
});