/**
 * The Android stub.
 *
 * Small but not pointless: the failure this guards against is someone making these methods return
 * successfully "for now" so the app runs on Android. That would produce a build that schedules
 * nothing and reports no problem — the silent failure D25 exists to prevent, shipped deliberately.
 *
 * Every method must reject. If one of these ever passes, the stub has been softened.
 */
import { describe, expect, it } from 'vitest';

import { engine } from './engine.android';
import { UnsupportedError } from './types';

describe('the Android engine', () => {
  it('refuses every operation rather than silently doing nothing', async () => {
    await expect(engine.configure()).rejects.toThrow(UnsupportedError);
    await expect(engine.schedule('a', 1)).rejects.toThrow(UnsupportedError);
    await expect(engine.cancel('a')).rejects.toThrow(UnsupportedError);
    await expect(engine.listScheduled()).rejects.toThrow(UnsupportedError);
    await expect(engine.authorisation()).rejects.toThrow(UnsupportedError);
    await expect(engine.requestAuthorisation()).rejects.toThrow(UnsupportedError);
    await expect(engine.consumeLaunchPayload()).rejects.toThrow(UnsupportedError);
  });

  it('names the platform, so the error says why rather than just failing', async () => {
    await expect(engine.schedule('a', 1)).rejects.toThrow(/Android/);
  });
});
