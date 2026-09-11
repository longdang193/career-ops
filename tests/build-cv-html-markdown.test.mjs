import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_CV_CERTIFICATIONS, MAX_CV_ENTRY_BULLETS, MAX_CV_PROJECTS, MAX_EDUCATION_SUBJECTS, normalizeCvPayload } from '../lib/cv-payload-schema.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LONG_DANG_TEMPLATE = join(ROOT, 'templates', 'cv-template.long-dang.md');
const HTML_TEMPLATE = join(ROOT, 'templates', 'cv-template.html');

function payload() {
  const block = (word, count) => Array(count).fill(word).join(' ');
  return {
    candidate: {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+49 123 456789',
      location: 'Berlin, Germany',
      linkedin: { display: 'linkedin.com/in/jane', url: 'https://linkedin.com/in/jane' },
      github: { display: 'github.com/jane', url: 'https://github.com/jane' },
    },
    summary: block('Analytics', 35),
    education: [
      { title: 'MSc Analytics', org: 'Example University', location: 'Germany', year: '2026', coursework: ['Business Decision Making', 'Data Mining', 'Statistics', 'Optimization', 'Reporting'], gpa: '1.7' },
      { title: 'BSc Business', org: 'Example College', location: 'Germany', year: '2024', coursework: ['Marketing', 'Supply Chain', 'Finance', 'Research', 'Management'] },
    ],
    experience: [{
      company: 'Acme',
      role: 'Analyst',
      location: 'Germany',
      dates: '2024 — Present',
      description: block('commercial reporting decisions', 15),
      bullets: [block('Built data reports with Excel to support decisions', 1), block('Analyzed customer data with SQL to improve reporting', 1), block('Created dashboards with Power BI to support analysis', 1), block('Prepared stakeholder recommendations from market evidence', 1), 'Role bullet 5'],
    }, {
      company: 'Beta',
      role: 'Business Analyst',
      location: 'Germany',
      dates: '2022 — 2024',
      description: block('market analysis stakeholder communication', 15),
      bullets: [block('Built market reports with Excel to support decisions', 1), block('Analyzed sales data with SQL to improve reporting', 1), block('Created dashboards with Power BI to support analysis', 1), block('Prepared recommendations from customer evidence', 1), 'Role bullet 5'],
    }],
    projects: [{
      name: 'Forecasting',
      description: block('Demand forecasting project for business analysis', 15),
      tech: 'SQL, Python, BigQuery',
      dates: '2026 — Present',
      url: 'https://github.com/jane/forecasting',
      bullets: [block('Built forecasting models with SQL to support planning', 1), block('Validated data with Python to improve analysis', 1), block('Created reporting outputs with BigQuery for decisions', 1), block('Documented analytical methods for repeatable delivery', 1), 'Project bullet 5'],
    }],
    certifications: [
      { title: 'Certificate', org: 'Issuer', year: '2025', url: 'https://example.test/certificate', focus: ['Analytics', 'Reporting'] },
      { title: 'Certificate Two', org: 'Issuer', year: '2024', url: 'https://example.test/certificate-two', focus: ['Data analysis', 'Reporting'] },
    ],
    skills: [{ category: 'Tools', items: Array.from({ length: 115 }, (_, index) => `Skill${index}`) }],
  };
}

function build(input, template, markdown) {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-cv-'));
  const inputPath = join(dir, 'input.json');
  const outputPath = join(dir, markdown ? 'output.md' : 'output.html');
  writeFileSync(inputPath, JSON.stringify(input), 'utf8');
  execFileSync(process.execPath, [
    'build-cv-html.mjs', inputPath, outputPath, template, ...(markdown ? ['--markdown'] : []),
  ], { cwd: ROOT, encoding: 'utf8' });
  const output = readFileSync(outputPath, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  return output;
}

test('normalizeCvPayload caps role and project bullets without mutating input', () => {
  const source = payload();
  const normalized = normalizeCvPayload(source);

  assert.equal(MAX_CV_ENTRY_BULLETS, 4);
  assert.equal(normalized.experience[0].bullets.length, 4);
  assert.equal(normalized.projects[0].bullets.length, 4);
  assert.equal(MAX_CV_CERTIFICATIONS, 5);
  assert.equal(MAX_CV_PROJECTS, 3);
  assert.equal(MAX_EDUCATION_SUBJECTS, 5);
  assert.equal(source.experience[0].bullets.length, 5);
  assert.equal(source.projects[0].bullets.length, 5);
});

test('normalizeCvPayload caps certifications without mutating input', () => {
  const source = payload();
  source.certifications = [1, 2, 3, 4, 5, 6];
  const normalized = normalizeCvPayload(source);
  assert.equal(normalized.certifications.length, 5);
  assert.equal(source.certifications.length, 6);
});

test('normalizeCvPayload caps projects, subjects, and education location without mutating input', () => {
  const source = payload();
  source.projects.push({ name: 'Third' }, { name: 'Fourth' }, { name: 'Fifth' });
  source.education[0].coursework = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  source.education[0].location = 'Berlin, Germany';
  const normalized = normalizeCvPayload(source);
  assert.equal(normalized.projects.length, 3);
  assert.equal(normalized.education[0].coursework.split('; ').length, 5);
  assert.equal(normalized.education[0].location, 'Germany');
  assert.equal(source.projects.length, 4);
  assert.equal(source.education[0].coursework.length, 6);
});

test('Markdown keeps Long Dang HTML and caps raw and artifact-draft output', () => {
  const source = payload();
  const raw = build(source, LONG_DANG_TEMPLATE, true);
  const artifact = build({
    artifact_type: 'cv',
    target_job_context: { company: 'Acme', role_title: 'Analyst' },
    candidate_facts: { name: 'Jane Doe' },
    tailored_content: source,
    selected_template: 'long-dang',
    render_format: 'text',
  }, LONG_DANG_TEMPLATE, true);

  for (const output of [raw, artifact]) {
    assert.match(output, /<span class="iconify" data-icon="tabler:mail"><\/span>/);
    assert.match(output, /<span class="iconify" data-icon="tabler:brand-github"><\/span>/);
    assert.match(output, /\[jane@example\.com\]\(mailto:jane@example\.com\)/);
    assert.match(output, /Relevant subjects: Business Decision Making; Data Mining/);
    assert.match(output, /commercial reporting decisions/);
    assert.match(output, /SQL, Python, BigQuery/);
    assert.match(output, /2026 — Present/);
    assert.match(output, /forecasting/);
    assert.match(output, /Focus: Analytics, Reporting/);
    assert.match(output, /Built data reports with Excel to support decisions/);
    assert.doesNotMatch(output, /Role bullet 5/);
    assert.match(output, /Built forecasting models with SQL to support planning/);
    assert.doesNotMatch(output, /Project bullet 5/);
    assert.doesNotMatch(output, /\[FULL NAME\]|\[email@example\.com\]/);
  }
});

test('HTML output uses same four-bullet cap', () => {
  const output = build(payload(), HTML_TEMPLATE, false);

  assert.match(output, /Built data reports with Excel to support decisions/);
  assert.doesNotMatch(output, /Role bullet 5/);
    assert.match(output, /Demand forecasting project for business analysis/);
});

test('reference Markdown keeps arbitrary template HTML elements', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-template-'));
  const template = join(dir, 'cv-template.fixture.md');
  writeFileSync(template, [
    '# [FULL NAME]',
    '',
    '<a class="profile-link" href="https://example.test">Profile</a><br>',
    '',
    '## Summary',
    '',
    'placeholder',
    '',
    '## Education',
    '',
    'placeholder',
    '',
    '## Experience',
    '',
    'placeholder',
    '',
    '## Projects',
    '',
    'placeholder',
    '',
    '## Certificates',
    '',
    'placeholder',
    '',
    '## Skills',
    '',
    'placeholder',
    '',
  ].join('\n'), 'utf8');

  try {
    const output = build(payload(), template, true);
    assert.match(output, /<a class="profile-link" href="https:\/\/example\.test">Profile<\/a><br>/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Markdown matches prototype spacing and metadata format', () => {
  const source = payload();
  source.education[0].year = '2024-10 - present';
  source.experience.push({
    company: 'Beta',
    role: 'Senior Analyst',
    dates: '2025-02 - present',
    bullets: ['Second role bullet'],
  });
  source.projects[0].dates = '2026-01 - present';
  source.certifications[0].url = 'https://example.test/certificate';
  source.certifications[0].focus = ['Analytics', 'Reporting'];

  const output = build(source, LONG_DANG_TEMPLATE, true);

  assert.doesNotMatch(output, /Reference-only template/);
  assert.match(output, /tel:\+49123456789/);
  assert.match(output, /## Summary\n\nAnalytics Analytics Analytics/);
  assert.doesNotMatch(output, /## Summary\n\n\n/);
  assert.match(output, /: \*\*Oct 2024 — Present\*\*/);
  assert.match(output, /: \*\*Jan 2026 — Present\*\*/);
  assert.match(output, /\*\*\[Certificate\]\(https:\/\/example\.test\/certificate\)\*\*\n  : \*\*Issuer\*\*\n  : \*\*2025\*\*\n\nFocus: Analytics, Reporting/);
  assert.match(output, /\*\*Senior Analyst\*\*/);
  assert.match(output, /Feb 2025 — Present/);
});
