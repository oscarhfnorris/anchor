/**
 * Android's alarm engine — deliberately not implemented.
 *
 * The seam exists so that adding Android means writing this file plus one full-screen-intent
 * Activity, and touching nothing else. Android is out of scope (plan §16), so every method throws
 * rather than silently doing nothing: an alarm app whose scheduler quietly no-ops is the exact
 * silent failure D25 exists to prevent, and a stub that returns successfully would ship that.
 */
import { UnsupportedError, type AlarmEngine } from './types';

const unsupported = (what: string): never => {
  throw new UnsupportedError(`${what} on Android`);
};

export const engine: AlarmEngine = {
  configure: async () => unsupported('configure'),
  schedule: async () => unsupported('schedule'),
  cancel: async () => unsupported('cancel'),
  listScheduled: async () => unsupported('listScheduled'),
  authorisation: async () => unsupported('authorisation'),
  requestAuthorisation: async () => unsupported('requestAuthorisation'),
  consumeLaunchPayload: async () => unsupported('consumeLaunchPayload'),
};
