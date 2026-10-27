#!/usr/bin/env node
/**
 * Copies the API contract (types, schemas and constants shared with the server) from the EDM Tasks repository
 * into src/shared. Run it whenever the API changes:
 *
 *   pnpm sync-shared                          # from ../EDM-Task-Management
 *   EDM_TASKS_DIR=/path/to/EDM-Task-Management pnpm sync-shared
 *   pnpm sync-shared --check                  # exit 1 if src/shared is out of date (nothing is written)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRepo = resolve(root, process.env.EDM_TASKS_DIR ?? '../EDM-Task-Management');
const source = join(sourceRepo, 'packages/shared/src');
const target = join(root, 'src/shared');
const check = process.argv.includes('--check');

if (!existsSync(source)) {
  console.error(`Cannot find ${source}. Set EDM_TASKS_DIR to the EDM-Task-Management folder.`);
  process.exit(2);
}

const HEADER =
  '// Copied from EDM-Task-Management/packages/shared by `pnpm sync-shared`. Do not edit here: change the server\n' +
  '// repository and run the command again.\n';

const wanted = new Map(
  readdirSync(source)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => [
      f,
      // The server compiles for Node, which needs ".js" in relative imports; Metro resolves them without.
      HEADER + readFileSync(join(source, f), 'utf8').replace(/(from\s+'\.{1,2}\/[^']+?)\.js'/g, "$1'")
    ])
);

const existing = existsSync(target) ? readdirSync(target).filter((f) => f.endsWith('.ts')) : [];
const stale = [
  ...[...wanted].filter(
    ([f, text]) => !existsSync(join(target, f)) || readFileSync(join(target, f), 'utf8') !== text
  ),
  ...existing.filter((f) => !wanted.has(f)).map((f) => [f, null])
].map(([f]) => f);

if (check) {
  if (stale.length === 0) {
    console.log('src/shared is up to date.');
    process.exit(0);
  }
  console.error(`src/shared is out of date (${stale.join(', ')}). Run pnpm sync-shared.`);
  process.exit(1);
}

mkdirSync(target, { recursive: true });
for (const f of existing) if (!wanted.has(f)) rmSync(join(target, f));
for (const [f, text] of wanted) writeFileSync(join(target, f), text);
console.log(stale.length ? `Updated src/shared: ${stale.join(', ')}` : 'src/shared was already up to date.');
