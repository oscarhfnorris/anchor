/**
 * `npm run docs:progress` — regenerate `docs/progress.md` from the repo itself.
 *
 * Generated rather than written, because a hand-maintained status doc is a promise to update it
 * later and nobody ever does. Twice in this project's first day the plan and the README drifted from
 * the code inside a single session; a progress report is the document most exposed to that, since it
 * is *only* claims about state.
 *
 * Everything here is derived: decisions come from the plan's own table, coverage from scanning test
 * titles, counts from the files on disk. If a number here is wrong, the fix is in the source it was
 * read from, not in the output.
 *
 * Run with `--check` to fail when the committed file is out of date, so CI can catch a stale one.
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'docs/progress.md');
const SKIP = new Set(['node_modules', '.git', 'ios', 'android', '.expo', 'dist', 'assets']);

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (['.ts', '.tsx'].includes(extname(full))) acc.push(full);
  }
  return acc;
}

const files = walk(ROOT);
const testFiles = files.filter((f) => /\.test\.tsx?$/.test(f));

// --- decisions, straight from the plan's table -------------------------------------------------
const plan = readFileSync(join(ROOT, 'docs/plan/anchor-plan.md'), 'utf8');
const decisions = new Map();
for (const m of plan.matchAll(/^\| (D\d+) \| (.+?) \| (.+?) \|\s*$/gm)) {
  const summary = m[2].replace(/\*\*|`|\*/g, '').replace(/\s+/g, ' ').trim();
  decisions.set(m[1], summary.length > 88 ? `${summary.slice(0, 85).trimEnd()}…` : summary);
}

// --- coverage, from test titles (comments stripped: describing a test is not writing one) -------
const covered = new Set();
for (const file of testFiles) {
  const src = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const m of src.matchAll(/(?:describe|it)(\.todo)?\(\s*['"`]([^'"`]*)/g)) {
    if (m[1]) continue;
    for (const d of m[2].match(/\bD\d+\b/g) ?? []) covered.add(d);
  }
}

// --- test counts -------------------------------------------------------------------------------
const countIn = (src) => (src.match(/^\s*it\(/gm) ?? []).length;
const perFile = testFiles
  .map((f) => ({ file: relative(ROOT, f), tests: countIn(readFileSync(f, 'utf8')) }))
  .filter((r) => r.tests > 0)
  .sort((a, b) => a.file.localeCompare(b.file));
const totalTests = perFile.reduce((n, r) => n + r.tests, 0);

const sourceModules = files
  .filter((f) => /^src\/(core|alarm|db)\//.test(relative(ROOT, f)) && !/\.test\./.test(f))
  .map((f) => relative(ROOT, f))
  .sort();

const commits = execSync('git log --oneline --no-merges', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean).length;

// --- phases ------------------------------------------------------------------------------------
const PHASES = [
  ['0', 'The template', 'Complete', 'Runs on device; migrations, round trip and build info verified'],
  ['1', 'The alarm core', 'Partly built', 'All logic a fake can verify. Device steps blocked'],
  ['2', 'Places and geofencing', 'Not started', 'Blocked by the fortnight gate, then Phase 1'],
  ['3', 'Feature A — the dock alarm', 'Not started', 'Needs Phase 2'],
  ['4', 'Sessions and proximity', 'Not started', 'Needs Phase 3, hardware, and nights of observation'],
];

const BLOCKED = [
  ['NFC read on device', 'Core NFC returns *Sandbox restriction* on a free Personal Team', 'Paid Apple Developer account'],
  ['AlarmKit on device', 'Needs the `com.apple.developer.alarmkit` entitlement', 'Account, then an approval queue of unknown length'],
  ['The AlarmKit bridge at all', '`expo-alarm-kit`\'s `configure()` wants an App Group', 'Account. May or may not be enforced in the simulator — unverified'],
  ['Widget extension', 'Needs App Groups', 'Account'],
  ['Phase 2 onward', '§3 requires using Phase 1 for a fortnight first', 'A fortnight of actual mornings'],
];

const outstanding = [...decisions.keys()].filter((d) => !covered.has(d));
const pct = Math.round((covered.size / decisions.size) * 100);

const lines = [];
const w = (s = '') => lines.push(s);

w('# Progress');
w();
w('**Generated — do not edit by hand.** Run `npm run docs:progress` to refresh.');
w();
w('Every figure below is derived from the repo: decisions from the plan\'s own table, coverage from');
w('scanning test titles, counts from the files on disk. A status doc maintained by hand is a promise');
w('to update it later, and this project has already watched two documents drift from the code inside');
w('a single day.');
w();
w(`At a glance: **Phase 0 complete, Phase 1 partly built.** ${covered.size} of ${decisions.size} decisions (${pct}%) are`);
w(`covered by a running test, across ${totalTests} tests in ${perFile.length} files and ${commits} commits.`);
w();
w('## Phases');
w();
w('| | Phase | Status | Notes |');
w('| --- | --- | --- | --- |');
for (const [n, name, status, note] of PHASES) w(`| **${n}** | ${name} | ${status} | ${note} |`);
w();
w('## What is blocked, and on what');
w();
w('None of these are matters of effort. Listing them here so "not done" never reads as "forgotten".');
w();
w('| Blocked | Why | Waiting on |');
w('| --- | --- | --- |');
for (const [what, why, on] of BLOCKED) w(`| ${what} | ${why} | ${on} |`);
w();
w('## Decision coverage');
w();
w('D37 makes the plan\'s decision table the test checklist: a rule in `core/` without a test is');
w('unfinished, not merely untested. Coverage is measured by scanning test titles for decision');
w('references, with comments stripped — describing how to test something does not count as testing it.');
w();
w(`**${covered.size} / ${decisions.size} covered.**`);
w();
w('<details><summary>Covered</summary>');
w();
for (const d of [...covered].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))) {
  w(`- **${d}** — ${decisions.get(d) ?? '(not in the plan table)'}`);
}
w();
w('</details>');
w();
w('<details><summary>Outstanding</summary>');
w();
for (const d of outstanding) w(`- **${d}** — ${decisions.get(d)}`);
w();
w('</details>');
w();
w('## Modules');
w();
w('Tests are co-located, so a module with no test file beside it is visible here.');
w();
w('| Module | Co-located tests |');
w('| --- | --- |');
for (const m of sourceModules) {
  const twin = perFile.find((r) => r.file === m.replace(/\.tsx?$/, '.test.ts'));
  w(`| \`${m}\` | ${twin ? `${twin.tests}` : '—'} |`);
}
w();
w('## Tests');
w();
w('| File | Tests |');
w('| --- | --- |');
for (const r of perFile) w(`| \`${r.file}\` | ${r.tests} |`);
w(`| **Total** | **${totalTests}** |`);
w();

const output = `${lines.join('\n')}\n`;

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUT, 'utf8');
  } catch {
    /* missing counts as stale */
  }
  if (current !== output) {
    console.error('docs/progress.md is out of date — run `npm run docs:progress`');
    process.exit(1);
  }
  console.log('docs/progress.md is up to date');
  process.exit(0);
}

writeFileSync(OUT, output);
console.log(`docs/progress.md — ${covered.size}/${decisions.size} decisions, ${totalTests} tests`);
