import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dataRoot = resolve(root, 'data.private');
const probe = `import { safeOutputPath } from './generate-cover-letter.mjs'; console.log(safeOutputPath('output/private-letter.md'));`;
const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
  cwd: root,
  env: { ...process.env, CAREER_OPS_ROOT: dataRoot },
  encoding: 'utf8',
});

assert.equal(result.status, 0, result.stderr);
assert.equal(result.stdout.trim(), join(dataRoot, 'output', 'private-letter.md'));
console.log('cover-letter private output root: pass');
