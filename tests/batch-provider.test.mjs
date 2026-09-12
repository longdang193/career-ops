import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveBatchProvider } from '../batch/provider.mjs';

test('auto selects OpenAI-compatible provider from project .env', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-provider-'));
  writeFileSync(join(dir, '.env'), 'OPENAI_BASE_URL=https://provider.test/v1\nOPENAI_MODEL=test-model\n');
  assert.equal(resolveBatchProvider('auto', {}, join(dir, '.env')), 'openai');
});

test('auto falls back to Claude without OpenAI settings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-provider-'));
  assert.equal(resolveBatchProvider('auto', {}, join(dir, '.env')), 'claude');
});

test('explicit provider overrides auto detection', () => {
  assert.equal(resolveBatchProvider('claude', { OPENAI_MODEL: 'ignored' }, 'missing.env'), 'claude');
  assert.equal(resolveBatchProvider('openai', {}, 'missing.env'), 'openai');
});

test('rejects unknown provider', () => {
  assert.throws(() => resolveBatchProvider('wat', {}, 'missing.env'), /provider must be auto, openai, or claude/);
});

test('OpenAI evaluator emits batch worker result JSON', () => {
  const source = readFileSync(new URL('../openai-eval.mjs', import.meta.url), 'utf8');
  assert.match(source, /status: 'completed'/);
  assert.match(source, /score: Number\.isFinite\(numericScore\) \? numericScore : null/);
});
