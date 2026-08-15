/**
 * Tag identity and role matching (D1, D22, D31, D34).
 *
 * The empty-UID cases are the ones that matter most: a failed read becoming a successful dismissal
 * is the difference between the alarm glitching and the alarm being off, and it would only ever be
 * discovered by oversleeping.
 */
import { describe, expect, it } from 'vitest';

import { canRegister, findTag, matchesRole, normaliseUid, type RegisteredTag } from './tags';

const morning: RegisteredTag = { uid: '04a2b3c4', role: 'morning', portable: true };
const kitchen: RegisteredTag = { uid: '04ffee11', role: 'morning', portable: false };
const dock: RegisteredTag = { uid: 'deadbeef', role: 'dock', portable: false };
const registry = [morning, kitchen, dock];

describe('normaliseUid — identity is the hardware UID (D1)', () => {
  it('lowercases and strips reader separators', () => {
    expect(normaliseUid('04:A2:B3:C4')).toBe('04a2b3c4');
    expect(normaliseUid('04-a2-b3-c4')).toBe('04a2b3c4');
    expect(normaliseUid(' 04A2B3C4 ')).toBe('04a2b3c4');
  });

  it('treats anything non-hex as unreadable', () => {
    expect(normaliseUid('not-a-uid')).toBe('');
    expect(normaliseUid('04a2b3zz')).toBe('');
  });

  it('treats absent input as unreadable rather than throwing', () => {
    expect(normaliseUid('')).toBe('');
    expect(normaliseUid(null)).toBe('');
    expect(normaliseUid(undefined)).toBe('');
  });
});

describe('matchesRole (D1, D31)', () => {
  it('matches a registered tag of that role regardless of formatting', () => {
    expect(matchesRole('04:A2:B3:C4', 'morning', registry)).toBe(true);
  });

  it('accepts any tag of the role, not one designated tag (D31)', () => {
    expect(matchesRole(morning.uid, 'morning', registry)).toBe(true);
    expect(matchesRole(kitchen.uid, 'morning', registry)).toBe(true);
  });

  it('rejects the dock tag presented to the wake alarm (D22)', () => {
    expect(matchesRole(dock.uid, 'morning', registry)).toBe(false);
    expect(matchesRole(morning.uid, 'dock', registry)).toBe(false);
  });

  it('never matches an empty or unreadable UID', () => {
    expect(matchesRole('', 'morning', registry)).toBe(false);
    expect(matchesRole(null, 'morning', registry)).toBe(false);
    expect(matchesRole('garbled', 'morning', registry)).toBe(false);
  });

  it('never matches against an empty registry', () => {
    expect(matchesRole(morning.uid, 'morning', [])).toBe(false);
  });

  it('ignores whether the tag is portable — place never affects matching (D22)', () => {
    expect(matchesRole(kitchen.uid, 'morning', registry)).toBe(true);
    expect(matchesRole(morning.uid, 'morning', registry)).toBe(true);
  });
});

describe('findTag', () => {
  it('finds a tag whatever its role, so callers can tell wrong-role from unknown', () => {
    expect(findTag(dock.uid, registry)?.role).toBe('dock');
    expect(findTag('00000000', registry)).toBeUndefined();
  });
});

describe('canRegister — one role per tag (D22)', () => {
  it('rejects an unreadable UID', () => {
    expect(canRegister('', 'morning', registry)).toEqual({ ok: false, reason: 'invalidUid' });
  });

  it('rejects a tag already bound to the other role (D22)', () => {
    expect(canRegister(dock.uid, 'morning', registry)).toEqual({
      ok: false,
      reason: 'alreadyOtherRole',
    });
  });

  it('allows re-registering a tag to the role it already holds', () => {
    expect(canRegister(morning.uid, 'morning', registry)).toEqual({ ok: true });
  });

  it('allows a new tag', () => {
    expect(canRegister('0a0b0c0d', 'morning', registry)).toEqual({ ok: true });
  });
});
