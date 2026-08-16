/**
 * iOS's alarm engine, over `expo-alarm-kit`.
 *
 * **Written against the bridge's source, not run on a device.** Core NFC, App Groups and the
 * AlarmKit entitlement all need a paid Apple account, so this has never been exercised — build step
 * 5's spike is what will confirm it. Treat every behaviour below as a claim about the bridge's Swift
 * rather than an observation.
 *
 * Two things read from that source shape this file:
 *
 * - `configure(appGroupIdentifier)` returns false without a reachable App Group, and the bridge then
 *   degrades silently: `sharedDefaults` is optional-chained everywhere, so writes vanish rather than
 *   throwing. We surface that as a hard false so the caller can refuse to arm, per the plan's rule
 *   that a degraded capability is a loud blocking state and never a quiet one.
 * - `getAllAlarms()` lists keys the bridge wrote into that App Group — it never asks AlarmKit what
 *   is scheduled. It is a second mirror, so an empty result means "unknown", not "nothing is
 *   scheduled", and reconciliation re-issues blind rather than trusting it.
 */
import * as AlarmKit from 'expo-alarm-kit';

import type { AlarmEngine, AuthorisationState, LaunchPayload } from './types';

/**
 * Must match the App Group in the native project exactly.
 *
 * A mismatch is not a build error — it surfaces as `configure()` returning false and every alarm
 * silently failing to persist, which is why `configure` is checked rather than fired and forgotten.
 */
export const APP_GROUP = 'group.com.oscarnorris.anchor';

const toAuthorisation = (status: string): AuthorisationState =>
  status === 'authorized' ? 'granted' : status === 'denied' ? 'denied' : 'notDetermined';

export const engine: AlarmEngine = {
  async configure() {
    return AlarmKit.configure(APP_GROUP);
  },

  async schedule(id, at) {
    // The bridge takes seconds; the rest of the app works in milliseconds, and mixing the two is
    // how an alarm ends up scheduled in 1970 or fifty years out.
    const ok = await AlarmKit.scheduleAlarm({
      id,
      epochSeconds: Math.floor(at / 1000),
      title: 'Anchor',
      // The whole re-arm mechanism (D2): the OS launches the app on dismissal, JS runs, and the app
      // decides whether the alarm was satisfied. Without this there is no enforcement at all.
      launchAppOnDismiss: true,
      dismissPayload: id,
    });
    if (!ok) throw new Error(`Failed to schedule alarm ${id}`);
  },

  async cancel(id) {
    await AlarmKit.cancelAlarm(id);
  },

  async listScheduled() {
    return AlarmKit.getAllAlarms();
  },

  async authorisation() {
    // The bridge exposes only a request; asking is the same call, and it returns the current state
    // without prompting once a decision has been made.
    return toAuthorisation(await AlarmKit.requestAuthorization());
  },

  async requestAuthorisation() {
    return toAuthorisation(await AlarmKit.requestAuthorization());
  },

  async consumeLaunchPayload(): Promise<LaunchPayload | null> {
    const payload = AlarmKit.getLaunchPayload();
    if (!payload) return null;
    // Reading must be destructive, or every foreground would re-process the same dismissal and
    // re-arm repeatedly. The bridge does not clear it, so we do.
    AlarmKit.removeAlarm(payload.alarmId);
    return { alarmId: payload.alarmId, payload: payload.payload };
  },
};
