# Anchor

An alarm you cannot dismiss from bed, at either end of the night.

Two independent alarms, each silenced only by getting up and physically scanning an NFC tag placed
somewhere else — across the room, or in another room entirely.

- **Bedtime.** Rings until the phone is docked away from the bed, then keeps it there: a beacon at
  the dock notices if the phone is picked up again, and the alarm comes back.
- **Morning.** Fires from that dock, across the room, and is cleared only by a second tag somewhere
  else — the bathroom, the kettle, the front door. Walking that far is the point.

The premise is that the only proof the app accepts is physical presence at a specific object. A
notification can be swiped away half asleep; a tag on the kettle cannot.

Personal tool, iOS first. Everything on-device — no account, no server, no sync, nothing to run.

## Tech Stack

### Core
- **Framework:** [Expo](https://expo.dev) SDK 57 (dev client, [prebuild](https://docs.expo.dev/workflow/continuous-native-generation/)) + [React Native](https://reactnative.dev) 0.86
- **Language:** [TypeScript](https://www.typescriptlang.org) 6
- **Routing:** [Expo Router](https://docs.expo.dev/router/introduction/) (file-based, `src/app`)
- **UI:** [NativeWind](https://www.nativewind.dev) v5 (Tailwind v4 via PostCSS)
- **Database:** on-device SQLite ([expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)) with [Drizzle ORM](https://orm.drizzle.team) + [drizzle-zod](https://orm.drizzle.team/docs/zod) validation
- **Alarms (iOS):** Apple [AlarmKit](https://developer.apple.com/documentation/alarmkit) via a community bridge, behind a platform seam
- **NFC:** [react-native-nfc-manager](https://github.com/revtel/react-native-nfc-manager) — matched on hardware UID only, never the tag's payload
- **Testing:** [Vitest](https://vitest.dev) with [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for the database layer

### Hardware
Roughly £10, none of it needed to run the app: NTAG213 stickers (~£5 for 10–20) and an ESP32 board
(~£3–5) flashed as an iBeacon and run off USB at the dock. Not a payment card — those randomise
their UID by design.

## Quick Start

### Prerequisites

- **Node.js** — the version in [`.nvmrc`](./.nvmrc), and npm
- **Xcode** with the iOS platform installed (`xcodebuild -downloadPlatform iOS`), and a simulator
- **A paid Apple Developer account** for anything involving real NFC or alarms on a device. The app
  builds and runs on a simulator without one

```bash
npm install
npm run help          # what every script is for — start here
npm run build:ios     # compile and install on the simulator (slow, first time only)
npm run dev           # Metro for an app already installed (the everyday one)
```

`dev` and `build:*` are the distinction worth knowing: `dev` serves JavaScript to an app already on
the device, `build:*` recompiles the native binary. You only need the latter after adding a native
dependency or changing app config.

### Checks

```bash
npm test              # the whole suite
npm run check:code    # lint (incl. the core/ purity rule) · types · expo-doctor
npm run check:rules   # advisory scan, plus how many design decisions still lack a test
```

Both `npm test` and `npm run check:code` must be green. They are separate on purpose: tests prove
behaviour, `check:code` proves the rules that behaviour depends on are still enforced.

## How it is put together

The standard mobile layering — UI, domain, data — with two platform seams.

| | |
| --- | --- |
| `src/app/` | Screens (Expo Router) |
| `src/core/` | **Every rule about when an alarm fires or clears.** Pure TypeScript, imports nothing platform-specific, enforced by a lint rule that fails the build |
| `src/db/` | `schema/` describes the data, `repositories/` are its only entry points |
| `src/services/` | The few things that hold a domain decision and a platform handle at once |
| `src/alarm/`, `src/nfc/` | Platform seams, each with a hand-written fake so the flow can be tested without hardware |

`core/` being pure is not a style preference. It is the only part of this app that can be verified
without sleeping — no CI runner can tap an NFC tag or walk away from a beacon — so every behaviour
rule lives there and gets a test, and a `core/` rule without one is treated as unfinished.

## Docs

| | |
| --- | --- |
| What it is, and every design decision with its reasoning | [`docs/plan/anchor-plan.md`](./docs/plan/anchor-plan.md) |
| Where the build has got to, and what is blocked | [`docs/status.md`](./docs/status.md) |
| Conventions for AI agents | [`CLAUDE.md`](./CLAUDE.md) |
| Expo conventions, pinned to the date they were checked | [`docs/development/expo-guidelines.md`](./docs/development/expo-guidelines.md) |

## Licence

Proprietary — see [`LICENSE`](./LICENSE). Copyright © 2026 Oscar Norris, all rights reserved. The
source being visible grants no licence to use, copy, modify or redistribute it.

---

> **Work in progress — this does not wake anyone up yet.**
>
> The logic is written and tested, and the app builds and runs. What it cannot yet do is ring: NFC
> reading and AlarmKit both need a paid Apple Developer account, and AlarmKit additionally needs an
> entitlement Apple has to approve. Until then the alarm path is unverified on a real device.
>
> Do not rely on this to wake you for anything that matters.
