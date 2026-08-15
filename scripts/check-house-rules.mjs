/**
 * `check:rules` — the advisory scan. **Always exits 0. Never gates.**
 *
 * Gating and advisory are different tools, and keeping them apart is what makes both worth having.
 * `check:code` gates, so every rule in it needs a zero baseline. This one surfaces conventions that
 * would otherwise be re-taught in review, including ones with a standing non-zero count.
 *
 * Everything here is text-detectable with acceptable noise. Anything needing type information
 * belongs in review, not a regex.
 *
 * It also reports how many decisions are still stubbed. A suite of `it.todo` reports green, and a
 * green suite that has verified nothing is exactly the silent success this project distrusts — so
 * the number is printed every run. It going down is the progress bar; it never moving is the finding.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = process.cwd();
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
const findings = [];
const note = (file, line, rule, msg) =>
  findings.push({ file: relative(ROOT, file), line, rule, msg });

for (const file of files) {
  const rel = relative(ROOT, file);
  if (rel.startsWith('src/db/migrations')) continue;
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const isTest = /\.test\.tsx?$/.test(rel);

  // Arbitrary Tailwind values — the 4-point spacing system is scale utilities only.
  lines.forEach((l, i) => {
    const m = l.match(/\b(?:gap|p|m|px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr)-\[[^\]]+\]/);
    if (m) note(file, i + 1, 'arbitrary-spacing', `${m[0]} — use the 4-point scale`);
  });

  // Platform *branching* outside the seam. Reading `Platform.OS` to display it is not branching —
  // flagging that trains people to ignore the scan, which costs more than the rule is worth.
  if (!rel.startsWith('src/alarm/')) {
    lines.forEach((l, i) => {
      if (/\bPlatform\.OS\s*[=!]==/.test(l) || /\bPlatform\.select\b/.test(l))
        note(file, i + 1, 'platform-branch', 'platform branching outside src/alarm/');
    });
  }

  // Comments interleaved between the fields of an object literal.
  lines.forEach((l, i) => {
    if (/^\s*\/\*\*/.test(l) && /^\s*[\w'"]+\s*:/.test(lines[i + 1] ?? '') && i > 0) {
      if (/[,{]\s*$/.test(lines[i - 1] ?? ''))
        note(file, i + 1, 'comment-in-structure', 'doc block between object fields');
    }
  });

  // Missing doc block. Every file opens with one; core/ is never exempt.
  if (!isTest && !/^\s*\/\*\*/.test(src) && !rel.endsWith('-env.d.ts')) {
    note(file, 1, 'missing-doc-block', 'file has no opening doc block');
  }

  // One export per file in UI code.
  if (/^src\/(app|ui)\//.test(rel)) {
    const exports = (src.match(/^export\s+(?:default\s+)?(?:function|const|class)\s/gm) ?? []).length;
    if (exports > 1) note(file, 1, 'one-export-per-file', `${exports} exports in a UI file`);
  }
}

for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  ${f.rule}  ${f.msg}`);
}
console.log(findings.length ? `\n${findings.length} advisory finding(s)` : '\nno advisory findings');

// The decision checklist, per D37 — real coverage, not a count of `todo`.
//
// Counting stubs would report progress for renaming a stub. This instead asks which decisions are
// named by a test that actually runs, which is the question D37 is really posing.
const planPath = join(ROOT, 'docs/plan/anchor-plan.md');
try {
  const plan = readFileSync(planPath, 'utf8');
  const decisions = [...plan.matchAll(/^\| (D\d+) \|/gm)].map((m) => m[1]);
  const all = [...new Set(decisions)];

  const covered = new Set();
  const stubbed = new Set();
  for (const file of files.filter((f) => /\.test\.tsx?$/.test(f))) {
    // Strip comments first: a worked example inside a doc block is documentation, not coverage,
    // and counting it would let a decision look tested because someone described how to test it.
    const src = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const m of src.matchAll(/(?:describe|it)(\.todo)?\(\s*['"`]([^'"`]*)/g)) {
      for (const d of (m[2].match(/\bD\d+\b/g) ?? [])) {
        (m[1] ? stubbed : covered).add(d);
      }
    }
  }
  const outstanding = all.filter((d) => !covered.has(d));
  console.log(
    `decisions: ${covered.size}/${all.length} covered by a running test` +
      (outstanding.length ? ` — outstanding: ${outstanding.join(', ')}` : ' — all covered'),
  );
} catch {
  console.log('decisions: could not read the plan to build the checklist');
}

process.exit(0);
