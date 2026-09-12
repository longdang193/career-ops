import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const NODE = process.execPath;
const invalidProjects = Array.from({ length: 4 }, (_, index) => ({
  name: `Project ${index + 1}`,
  bullets: ['One', 'Two', 'Three'],
}));

function run(script, args) {
  return spawnSync(NODE, [join(ROOT, script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('CV HTML and LaTeX reject invalid cardinality before writing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'document-constraints-cli-'));
  try {
    const htmlInput = join(dir, 'cv-html.json');
    const htmlOutput = join(dir, 'cv.html');
    writeFileSync(htmlInput, JSON.stringify({
      candidate: { name: 'Test Candidate', email: 'test@example.com' },
      summary: 'Valid enough for cardinality gate.',
      experience: [],
      projects: invalidProjects,
      education: [],
      certifications: [],
      skills: [],
    }));
    const html = run('build-cv-html.mjs', [htmlInput, htmlOutput]);
    assert.notEqual(html.status, 0);
    assert.match(html.stderr, /projects.*maximum 3/);
    assert.equal(existsSync(htmlOutput), false);

    const latexInput = join(dir, 'cv-latex.json');
    const latexOutput = join(dir, 'cv.tex');
    writeFileSync(latexInput, JSON.stringify({
      name: 'Test Candidate',
      contact_line: 'City',
      email: { url: 'test@example.com', display: 'test@example.com' },
      education: [],
      experience: [],
      projects: invalidProjects,
      awards: [],
      skills: [],
    }));
    const latex = run('build-cv-latex.mjs', [latexInput, latexOutput]);
    assert.notEqual(latex.status, 0);
    assert.match(latex.stderr, /projects.*maximum 3/);
    assert.equal(existsSync(latexOutput), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cover PDF rejects evidence drift before writing', () => {
  const payloadPath = join(tmpdir(), 'cover-constraints-invalid.json');
  const outputPath = join('output', `cover-constraints-invalid-${process.pid}.pdf`);
  const absoluteOutput = join(ROOT, outputPath);
  writeFileSync(payloadPath, JSON.stringify({
    template: 'standard',
    candidate: { name: 'Test Candidate' },
    letter: {
      role_title: 'Engineer',
      company: 'Example',
      recipient_team: 'Recruitment Team',
      greeting: 'Dear recruitment team,',
      opening: 'Opening.',
      profile_intro: 'Profile.',
      attention: { title: 'Attention.', text: 'Text.' },
      challenge: { title: 'Challenge.', text: 'Text.' },
      perspective: { title: 'Perspective.', text: 'Text.' },
      experience: [{ title: 'Only one evidence item', bullets: ['One'] }],
      contribution: { title: 'Contribution.', bullets: ['One'] },
      closing: 'Closing.',
    },
  }));
  try {
    const result = run('generate-cover-letter.mjs', ['--payload', payloadPath, '--out', outputPath]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires 2-4 evidence blocks/);
    assert.equal(existsSync(absoluteOutput), false);
  } finally {
    rmSync(payloadPath, { force: true });
    rmSync(absoluteOutput, { force: true });
  }
});
