/**
 * The seam's entry point, and the fallback for any platform without an implementation.
 *
 * React Native's bundler resolves `./engine` to `engine.ios.ts` or `engine.android.ts`. Nothing else
 * does — Node has no platform resolution — so without this file the import does not resolve at all
 * and the iOS adapter can never be reached from anywhere. That is the state this replaced: a seam
 * fully defined and wired to nothing.
 *
 * It throws rather than returning a working-looking no-op, for the same reason the Android stub
 * does: an alarm engine that quietly succeeds is the silent failure D25 exists to prevent. Tests use
 * `engine.fake.ts` explicitly and never reach this.
 */
import { UnsupportedError, type AlarmEngine } from './types';

const unsupported = (what: string): never => {
  throw new UnsupportedError(`${what} on this platform`);
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
