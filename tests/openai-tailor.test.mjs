import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const run = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

async function runTailor(providerContent) {
  const root = await mkdtemp(join(tmpdir(), 'career-ops-tailor-'));
  await mkdir(join(root, 'config'), { recursive: true });
  await mkdir(join(root, 'jds'), { recursive: true });
  await mkdir(join(root, 'reports'), { recursive: true });
  await writeFile(join(root, 'cv.md'), '# Test Candidate\n\nData analyst.\n');
  await writeFile(join(root, 'config', 'profile.yml'), [
    'cv:',
    '  template: long-dang',
    '  output_format: text',
  ].join('\n'));
  const jdPath = join(root, 'jds', 'job.txt');
  const reportPath = join(root, 'reports', '001-example-2026-09-11.md');
  await writeFile(jdPath, 'Analyst role.');
  await writeFile(reportPath, '# Evaluation: Example - Analyst\n');

  const server = createServer(async (_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(providerContent) } }] }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    return await run(process.execPath, ['openai-tailor.mjs', '--url', `http://127.0.0.1:${address.port}/v1`, '--model', 'mock', '--jd', jdPath, '--report', reportPath], {
      cwd: repoRoot,
      env: { ...process.env, CAREER_OPS_ROOT: root, OPENAI_API_KEY: '' },
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('provider layout fields fail before any draft output is written', async () => {
  await assert.rejects(
    runTailor({ html: '<!doctype html>' }),
    /provider layout field is not allowed/,
  );
});

test('structured provider content writes a draft, not provider HTML', async () => {
  const result = await runTailor({ candidate: { name: 'Test Candidate' }, summary: 'Data analyst.' });
  assert.match(result.stdout, /Structured CV draft saved/);
});

test('unsupported provider facts fail before draft persistence', async () => {
  await assert.rejects(
    runTailor({ candidate: { name: 'Test Candidate' }, summary: 'Managed 99 teams.' }),
    /Fact check failed for provider CV draft/,
  );
});
