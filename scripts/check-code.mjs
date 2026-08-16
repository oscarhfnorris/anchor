/**
 * `check:code` — the gate, and half the definition of done alongside `npm test`.
 *
 * One orchestrator rather than a chain of `&&`, so the output is ours to control: tasks run
 * concurrently, each task's output stays grouped under its own tag instead of interleaving, and the
 * run closes with a duration-sorted summary so the slow step is obvious.
 *
 * `doctor` is network-dependent, so it degrades to a warning rather than failing the gate. A check
 * that cannot run on a train is a check that gets bypassed, and a bypassed gate protects nothing.
 *
 * CI runs this same command with no extra flags. The moment local and CI diverge, a green local run
 * stops meaning anything.
 */
import { spawn } from 'node:child_process';

const TASKS = [
  { name: 'lint', cmd: 'npm', args: ['run', '--silent', 'lint'] },
  { name: 'types', cmd: 'npm', args: ['run', '--silent', 'type-check'] },
  { name: 'test', cmd: 'npm', args: ['run', '--silent', 'test'] },
  { name: 'docs', cmd: 'npm', args: ['run', '--silent', 'docs:progress:check'] },
  { name: 'doctor', cmd: 'npm', args: ['run', '--silent', 'doctor'], softFail: true },
];

const COLOURS = { lint: 36, types: 35, test: 32, docs: 34, doctor: 33 };
const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const tag = (n) => (useColour ? `[${COLOURS[n] ?? 37}m${n}[0m` : n);

function run(task) {
  return new Promise((resolve) => {
    const startedAt = process.hrtime.bigint();
    const child = spawn(task.cmd, task.args, { shell: false });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('error', (err) => resolve({ ...task, code: 1, output: String(err), ms: 0 }));
    child.on('close', (code) => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      resolve({ ...task, code: code ?? 1, output, ms });
    });
  });
}

const results = await Promise.all(TASKS.map(run));

let failed = false;
for (const r of results) {
  const soft = r.softFail && r.code !== 0;
  const status = r.code === 0 ? 'ok' : soft ? 'warn' : 'FAIL';
  if (r.code !== 0 && !soft) failed = true;
  console.log(`\n[${tag(r.name)}] ${status} (${Math.round(r.ms)}ms)`);
  const body = r.output.trimEnd();
  if (body && (r.code !== 0 || process.env.VERBOSE)) {
    console.log(body.replace(/^/gm, `  `));
  }
  if (soft) {
    console.log(`  ↑ ${r.name} did not pass; treated as a warning (often just offline).`);
  }
}

console.log('\ntimings');
for (const r of [...results].sort((a, b) => b.ms - a.ms)) {
  console.log(`  ${r.name.padEnd(8)} ${Math.round(r.ms)}ms`);
}

console.log(failed ? '\ncheck:code FAILED' : '\ncheck:code passed');
process.exit(failed ? 1 : 0);
