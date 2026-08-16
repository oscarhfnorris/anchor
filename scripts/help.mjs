/**
 * `npm run help` — what each script is for, and which one you actually want.
 *
 * This exists because the distinction that matters is not discoverable from the script names alone:
 * `dev` starts Metro against an app already installed on the device, while `build:*` recompiles the
 * native binary. Picking the wrong one costs either a confusing stale-bundle bug or ten minutes of
 * unnecessary Xcode.
 */
const GROUPS = [
  {
    title: 'Everyday — JavaScript changes only',
    note: 'The native app is already on the device. Metro serves your edits; nothing recompiles.',
    items: [
      ['dev', 'Start Metro. Open the app on the device yourself.'],
      ['dev:ios', 'Start Metro and open the iOS simulator.'],
      ['dev:android', 'Start Metro and open Android.'],
      ['dev:clear', "Same, with the Metro cache cleared. Reach for this when a change won't show up."],
    ],
  },
  {
    title: 'Native rebuild — slow, and only sometimes needed',
    note: 'Compiles, installs, then starts Metro. Needed after adding a native dependency or\n  changing app.json / entitlements. NOT needed for ordinary JS or style edits.',
    items: [
      ['build:ios', 'Compile and install on the iOS simulator.'],
      ['build:ios:device', 'Same, on a physical iPhone. Needs a provisioning profile.'],
      ['build:android', 'Compile and install on Android.'],
      ['native:regenerate', 'Throw away ios/ and android/ and regenerate them from app config.'],
    ],
  },
  {
    title: 'Before you call it done',
    note: 'Both must be green. Tests prove behaviour; check:code proves the rules it depends on.',
    items: [
      ['check:code', 'The gate: lint + types + tests + expo-doctor, run concurrently.'],
      ['test', 'Unit tests, once.'],
      ['test:watch', 'Unit tests, watching.'],
      ['check:rules', 'Advisory scan. Never fails the build. Prints how many decisions are stubbed.'],
    ],
  },
  {
    title: 'Individual checks',
    note: 'check:code runs all of these — reach for them directly when chasing one failure.',
    items: [
      ['lint', 'ESLint, including the src/core/ purity rule.'],
      ['lint:fix', 'ESLint with --fix.'],
      ['type-check', 'tsc over the app, scripts, tests and config.'],
      ['doctor', 'Expo SDK and native dependency compatibility.'],
      ['db:generate', 'Regenerate SQL migrations after editing src/db/schema/tables.ts. Commit the output.'],
    ],
  },
];

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const bold = (s) => (useColour ? `[1m${s}[0m` : s);
const dim = (s) => (useColour ? `[2m${s}[0m` : s);
const cyan = (s) => (useColour ? `[36m${s}[0m` : s);

const width = Math.max(...GROUPS.flatMap((g) => g.items.map(([n]) => n.length)));

console.log(`\n${bold('Anchor')} ${dim('— npm scripts')}`);
for (const group of GROUPS) {
  console.log(`\n${bold(group.title)}`);
  console.log(dim(`  ${group.note}`));
  for (const [name, description] of group.items) {
    console.log(`  ${cyan(name.padEnd(width))}  ${description}`);
  }
}
console.log(
  `\n${dim('Not sure? If you only changed .ts/.tsx, you want')} ${cyan('npm run dev')}${dim('.')}\n`,
);
