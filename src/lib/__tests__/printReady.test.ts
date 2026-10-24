import { describe, expect, it, vi } from 'vitest';
import { printWhenReady } from '../printReady';

describe('Print readiness', () => {
  it('does not print before a pending image finishes loading', async () => {
    const image = new EventTarget();
    const print = vi.fn();
    const target = {
      document: { images: [Object.assign(image, { complete: false })], fonts: { ready: Promise.resolve() } },
      closed: false, focus: vi.fn(), print,
      requestAnimationFrame: (callback: FrameRequestCallback) => { callback(0); return 1; },
    } as unknown as Window;
    const ready = printWhenReady(target);
    await Promise.resolve();
    expect(print).not.toHaveBeenCalled();
    image.dispatchEvent(new Event('load'));
    await ready;
    expect(print).toHaveBeenCalledTimes(1);
  });
  it('does not print a closed window', async () => {
    const print = vi.fn();
    const target = { document: { images: [], fonts: { ready: Promise.resolve() } }, closed: true, print } as unknown as Window;
    await printWhenReady(target);
    expect(print).not.toHaveBeenCalled();
  });
});