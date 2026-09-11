import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateArtifactDraft, assertArtifactDraft } from '../lib/artifact-draft.mjs';

const base = {
  target_job_context: { company: 'Acme', role_title: 'Analyst' },
  candidate_facts: { name: 'Jane Doe', skills: ['SQL'] },
  selected_template: 'long-dang',
  render_format: 'text',
};

test('shared draft contract accepts valid CV and cover-letter drafts', () => {
  const cv = {
    ...base,
    artifact_type: 'cv',
    tailored_content: {
      candidate: { name: 'Jane Doe' },
      summary: 'Analytics candidate.',
      experience: [{ company: 'Acme', role: 'Analyst', bullets: ['Improved reporting'] }],
    },
  };
  const cover = {
    ...base,
    artifact_type: 'cover_letter',
    tailored_content: {
      candidate: { name: 'Jane Doe' },
      letter: {
        role_title: 'Analyst',
        opening: 'I am applying for this role.',
        profile_intro: 'I improve reporting quality.',
      },
    },
  };

  assert.equal(validateArtifactDraft(cv).valid, true);
  assert.equal(validateArtifactDraft(cover).valid, true);
  assert.strictEqual(assertArtifactDraft(cv), cv);
});

test('shared draft contract rejects malformed content and provider layout', () => {
  const malformed = {
    ...base,
    artifact_type: 'cover_letter',
    tailored_content: {
      candidate: { name: 'Jane Doe', credentials: ['SQL', 7] },
      letter: {
        role_title: 'Analyst',
        opening: 'Opening',
        profile_intro: 'Profile',
        achievements: [{ lead: 'Reporting' }],
        css: '.bad { color: red }',
      },
    },
  };
  const result = validateArtifactDraft(malformed);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /credentials.*array of non-blank strings/);
  assert.match(result.errors.join('\n'), /achievements\[0\]\.impact/);
  assert.match(result.errors.join('\n'), /provider layout field/);
  assert.throws(() => assertArtifactDraft({ ...malformed, artifact_type: 'poster' }), /artifact_type/);
});

test('CV validation reuses renderer payload field rules', () => {
  const draft = {
    ...base,
    artifact_type: 'cv',
    tailored_content: {
      summary: 'Summary',
      experience: [{ company: 'Acme', role: 'Analyst', bullets: ['Good'] }],
      education: [{ institution: 'University', degree: 'MSc' }],
    },
  };
  const result = validateArtifactDraft(draft);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /tailored_content\.education\[0\].*missing required field.*title/);
});
