/**
 * The unsupported-platform fallback.
 *
 * In Node this is what `./engine` resolves to, and it must refuse everything. The failure it guards
 * against is the same one the Android stub guards: an engine that returns successfully would let a
 * build ship that schedules nothing and reports no problem.
 */
import { describe, expect, it } from 'vitest';

import { engine } from './engine';
import { UnsupportedError } from './types';

describe('the fallback engine', () => {
  it('refuses every operation rather than pretending to work', async () => {
    await expect(engine.configure()).rejects.toThrow(UnsupportedError);
    await expect(engine.schedule('a', 1)).rejects.toThrow(UnsupportedError);
    await expect(engine.cancel('a')).rejects.toThrow(UnsupportedError);
    await expect(engine.listScheduled()).rejects.toThrow(UnsupportedError);
    await expect(engine.authorisation()).rejects.toThrow(UnsupportedError);
    await expect(engine.requestAuthorisation()).rejects.toThrow(UnsupportedError);
    await expect(engine.consumeLaunchPayload()).rejects.toThrow(UnsupportedError);
  });
});
