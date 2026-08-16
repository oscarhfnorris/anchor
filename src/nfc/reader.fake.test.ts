/**
 * The NFC fake.
 *
 * Small, but the default matters: an unconfigured scan must fail, never succeed. A fake that
 * returned a plausible UID when a test forgot to set one would let a scan path pass while doing the
 * one thing the app must never do — turn a failed read into a dismissal (D1).
 */
import { describe, expect, it } from 'vitest';

import { FakeNfcReader } from './reader.fake';

describe('FakeNfcReader', () => {
  it('returns queued reads in order', async () => {
    const reader = new FakeNfcReader().willRead('04a2b3c4').willRead('deadbeef');
    expect(await reader.scan()).toEqual({ ok: true, uid: '04a2b3c4' });
    expect(await reader.scan()).toEqual({ ok: true, uid: 'deadbeef' });
  });

  it('fails rather than inventing a tag when nothing is queued', async () => {
    expect(await new FakeNfcReader().scan()).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('reports unavailability without consuming a queued read', async () => {
    const reader = new FakeNfcReader({ available: false }).willRead('04a2b3c4');
    expect(await reader.isAvailable()).toBe(false);
    expect(await reader.scan()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('can simulate each failure the UI has to render', async () => {
    const reader = new FakeNfcReader().willFail('cancelled').willFail('unauthorised');
    expect(await reader.scan()).toEqual({ ok: false, reason: 'cancelled' });
    expect(await reader.scan()).toEqual({ ok: false, reason: 'unauthorised' });
  });

  it('records calls so a test can assert the scan was cancelled', async () => {
    const reader = new FakeNfcReader();
    await reader.scan();
    await reader.cancel();
    expect(reader.calls).toEqual(['scan', 'cancel']);
  });
});
