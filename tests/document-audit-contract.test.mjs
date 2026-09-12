import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

test('CV and cover modes delegate to one shared audit contract', () => {
  const audit = read('modes/cv-audit.md');
  const text = read('modes/text.md');
  const cover = read('modes/cover.md');

  assert.match(audit, /artifact_type` to `cv` or `cover_letter/);
  assert.match(audit, /same result contract and cycle budget apply to both/);
  for (const mode of [text, cover]) {
    assert.match(mode, /modes\/cv-audit\.md/);
    assert.match(mode, /cv\.llm_audit/);
  }
  assert.doesNotMatch(cover, /cover_letter\.llm_audit/);
});
