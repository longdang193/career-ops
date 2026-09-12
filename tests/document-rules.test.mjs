import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  countVisibleWords,
  loadDocumentRules,
  validateDocumentRules,
  validatePayloadLimits,
  validateRenderedWordCount,
} from '../lib/document-rules.mjs';

const PROFILE = {
  cv: {
    constraints: {
      min_words: 450,
      max_words: 600,
      max_projects: 3,
      max_certifications: 5,
      bullets_per_entry: { min: 3, max: 4 },
    },
    llm_audit: { enabled: false, max_cycles: 2 },
  },
  cover_letter: {
    constraints: {
      min_words: 250,
      target_words: 300,
      max_words: 350,
      min_evidence_claims: 2,
      max_evidence_claims: 4,
    },
  },
};

test('validateDocumentRules returns one normalized CV and cover policy', () => {
  assert.deepEqual(validateDocumentRules(PROFILE), {
    cv: {
      minWords: 450,
      maxWords: 600,
      maxProjects: 3,
      maxCertifications: 5,
      bulletsPerEntry: { min: 3, max: 4 },
    },
    coverLetter: {
      minWords: 250,
      targetWords: 300,
      maxWords: 350,
      minEvidenceClaims: 2,
      maxEvidenceClaims: 4,
    },
    llmAudit: { enabled: false, maxCycles: 2 },
  });
});

test('loadDocumentRules reads the existing profile file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'document-rules-'));
  const path = join(dir, 'profile.yml');
  writeFileSync(path, [
    'cv:',
    '  constraints:',
    '    min_words: 450',
    '    max_words: 600',
    '    max_projects: 3',
    '    max_certifications: 5',
    '    bullets_per_entry:',
    '      min: 3',
    '      max: 4',
    '  llm_audit:',
    '    enabled: false',
    '    max_cycles: 2',
    'cover_letter:',
    '  constraints:',
    '    min_words: 250',
    '    target_words: 300',
    '    max_words: 350',
    '    min_evidence_claims: 2',
    '    max_evidence_claims: 4',
  ].join('\n'));
  try {
    assert.deepEqual(loadDocumentRules({ profilePath: path }), validateDocumentRules(PROFILE));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('profile example carries complete document policy including shared audit settings', () => {
  const example = fileURLToPath(new URL('../config/profile.example.yml', import.meta.url));
  assert.deepEqual(loadDocumentRules({ profilePath: example }).llmAudit, {
    enabled: false,
    maxCycles: 2,
  });
});

test('validateDocumentRules rejects missing, invalid, and duplicate policy values', () => {
  assert.throws(() => validateDocumentRules({}), /cv\.constraints\.min_words/);
  assert.throws(() => validateDocumentRules({
    ...PROFILE,
    cv: { ...PROFILE.cv, constraints: { ...PROFILE.cv.constraints, max_words: 449 } },
  }), /cv\.constraints\.max_words/);
  assert.throws(() => validateDocumentRules({
    ...PROFILE,
    cv: { ...PROFILE.cv, llm_audit: { enabled: true, max_cycles: 0 } },
  }), /cv\.llm_audit\.max_cycles/);
  assert.throws(() => validateDocumentRules({
    ...PROFILE,
    cover_letter: { ...PROFILE.cover_letter, llm_audit: { max_cycles: 3 } },
  }), /cover_letter\.llm_audit/);
});

test('validatePayloadLimits rejects CV cardinality and bullet drift before rendering', () => {
  const payload = {
    projects: [{}, {}, {}, {}],
    certifications: [{}, {}, {}, {}, {}, {}],
    experience: [{ bullets: ['one', 'two'] }],
  };
  assert.throws(() => validatePayloadLimits('cv', payload, validateDocumentRules(PROFILE)), /projects.*maximum 3/);
  assert.throws(() => validatePayloadLimits('cv', {
    certifications: [{}, {}, {}, {}, {}, {}],
  }, validateDocumentRules(PROFILE)), /certifications.*maximum 5/);
  assert.throws(() => validatePayloadLimits('cv', {
    experience: [{ bullets: ['one', 'two'] }],
  }, validateDocumentRules(PROFILE)), /experience\[0\]\.bullets.*3-4/);
});

test('validatePayloadLimits enforces cover evidence bounds without template overrides', () => {
  const rules = validateDocumentRules(PROFILE);
  assert.doesNotThrow(() => validatePayloadLimits('cover_letter', {
    letter: { experience: [{}, {}] },
  }, rules));
  assert.throws(() => validatePayloadLimits('cover_letter', {
    letter: { experience: [{}] },
  }, rules), /evidence.*2-4/);
  assert.throws(() => validatePayloadLimits('cover_letter', {
    letter: { achievements: [{}, {}, {}, {}, {}] },
  }, rules), /evidence.*2-4/);
});

test('visible word validation strips document markup and enforces configured ranges', () => {
  assert.equal(countVisibleWords('<p>one <strong>two</strong> &amp; three</p>'), 3);
  assert.equal(countVisibleWords('<style>.foo { color: red; }</style><p>one two</p>'), 2);
  assert.equal(countVisibleWords('\\href{https://example.test/a-long-url}{Visible label}'), 2);
  assert.equal(countVisibleWords('\\documentclass{article}% hidden preamble\n\\begin{document}one two\\end{document}', 'tex'), 2);
  const rules = validateDocumentRules(PROFILE);
  assert.doesNotThrow(() => validateRenderedWordCount('cv', '<p>' + 'word '.repeat(450) + '</p>', rules));
  assert.throws(() => validateRenderedWordCount('cv', 'word '.repeat(601), rules), /maximum is 600/);
  assert.throws(() => validateRenderedWordCount('cover_letter', 'word '.repeat(249), rules), /minimum is 250/);
});
