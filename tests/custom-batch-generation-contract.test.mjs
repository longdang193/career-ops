import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const customRules = readFileSync(new URL('../modes/_custom.template.md', import.meta.url), 'utf8');

test('custom batch generation contract keeps one symmetric job report schema', () => {
  for (const field of [
    'raw_job.id',
    'raw_job.url',
    'raw_job.description',
    'cv_path',
    'cover_letter_path',
    'status',
    'validation',
    'llm_audit',
    'skipped_existing',
    'failed_partial',
  ]) {
    assert.match(customRules, new RegExp(field.replace('.', '\\.'), 'i'));
  }
  assert.match(customRules, /never fetch, retrieve, resolve, or open.*URL/i);
  assert.match(customRules, /never\s+write one artifact without its pair/i);
});
