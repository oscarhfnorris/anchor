# Expo guidelines

What Expo's own docs say, pinned to a date, so agents stop guessing. **This is a snapshot, not a
source of truth** — the source of truth is `docs.expo.dev`, and this file is stale the moment Expo
ships an SDK. Re-retrieve before acting on anything below that looks version-shaped.

**Retrieved 2026-08-15.** Use the Expo MCP server (`docs.expo.dev/mcp`), Expo Skills
(`github.com/expo/skills`), or `llms.txt` to refresh it.

## Versions at time of writing

| | |
| --- | --- |
| Current SDK | **57**, released 30 June 2026 |
| React Native | 0.86 (SDK 57), 0.86.2 from `expo@57.0.9` |
| Previous | SDK 56 (21 May 2026), SDK 55 (25 Feb 2026) |

Anchor targets **iOS 26.0** because of AlarmKit, which is a floor set by the alarm bridge, not by
Expo. That is independent of the SDK version and does not move when the SDK does.

## Project structure — routes live in `src/app`

Expo's default template on **SDK 55 and later already ships a top-level `src/` directory**
containing `app`, `components`, `constants` and `hooks`. No configuration is needed to get it.

Three rules that come with it:

- **Config files stay at the root.** `app.config.ts`, `app.json`, `package.json`,
  `metro.config.js`, `tsconfig.json` — none of these move into `src/`.
- **`src/app` takes precedence over a root `app/`.** Having both is a silent trap; have one.
- **Do not change the root directory to anything else.** Expo's wording is blunt: *"Changing the
  default root directory is highly discouraged. We will not accept bug reports regarding projects
  with custom root directories."*

For Anchor this settles a question the plan left open: routes go in `src/app`, which puts them under
the same `src/` root as `core/`, `alarm/` and `db/`, and matches the architecture tree in plan §10.
`src/ui/` is then shared components, not screens.

## Development build, not Expo Go

A development build is *"essentially your own version of Expo Go where you are free to use any
native libraries and change any native configuration."* Expo Go only runs a pre-approved set of
native modules.

Anchor needs three that Expo Go cannot load — the AlarmKit bridge, `react-native-nfc-manager`, and
the beacon module — so the dev client is mandatory from the first build, not an optimisation to
adopt later. `expo-dev-client` goes in at Phase 0 and `npx expo prebuild` runs from day one.

## Continuous Native Generation — `ios/` and `android/` are build output

Prebuild regenerates the native projects from the app config and config plugins. Expo's model is
*"short-lived native projects generated only when needed"* rather than directories you maintain.

- **Both directories are gitignored** and are not the source of truth. Anchor's `.gitignore`
  already has them.
- **Never hand-edit them.** *"If you modify the generated directories manually then you risk losing
  your changes the next time you run `npx expo prebuild --clean`."*
- The failure mode is silent: the app keeps working locally until someone runs `--clean` or CI
  builds fresh, and then the change is simply gone.

### Why this matters more here than in most projects

Everything that makes Anchor's alarms work is native configuration: the
`com.apple.developer.alarmkit` entitlement, `NSAlarmKitUsageDescription`, the NFC and
Motion & Fitness usage strings, and the App Group that lets the widget extension read what the app
wrote.

If any of those is added by hand in Xcode, it survives until the next prebuild and then vanishes —
and the symptom is *the alarm stops firing*, with no build error and no warning. That is the exact
silent failure D25 exists to catch, arriving through the toolchain instead of the bridge.

**So: every entitlement, usage-description string and App Group is declared in the app config or a
config plugin. Xcode is for reading, never for editing.**

## Config plugins are the mechanism for that

A config plugin is *"a top-level custom configuration point that is not built into the app config"* —
a JS function run during prebuild that edits the native projects. They exist to *"configure
`AndroidManifest.xml` and `Info.plist`, and so on"* reproducibly.

Expo's guidance for CNG projects is explicit: *"it is best to avoid modifying these native projects
manually, because you cannot regenerate them safely."*

Most libraries ship their own plugin, so adding one is usually a dependency plus an entry in the
`plugins` array. Write a custom plugin only when a native change has no library behind it. The
widget extension in plan §9 is configured this way rather than through Xcode.

## Checklist before adding any native dependency

1. Does it work in a dev build without Expo Go? (Assume Expo Go is not an option here.)
2. Does it ship a config plugin, or does it need native config added by hand? If by hand, that
   config goes in a plugin.
3. Does it change the iOS deployment target? Anchor is already pinned at 26.0 by AlarmKit.
4. Does `npx expo-doctor` still pass? It validates SDK and native dependency compatibility, and with
   young community modules that is a real gate, not a formality.

## Sources

- [Top-level `src` directory](https://docs.expo.dev/router/reference/src-directory/)
- [Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)
- [Development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Config plugins](https://docs.expo.dev/config-plugins/introduction/)
- [Expo SDK reference](https://docs.expo.dev/versions/latest/) · [changelog](https://expo.dev/changelog)
