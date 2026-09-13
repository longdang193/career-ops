import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('HTML tailored mode requires tailoring metadata', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-cv-html-tailoring-'));
  const input = join(dir, 'payload.json');
  const output = join(dir, 'cv.html');
  writeFileSync(input, JSON.stringify({
    lang: 'en',
    candidate: { name: 'Jane Doe', email: 'jane@example.com' },
    summary: Array(540).fill('analysis').join(' '),
    experience: [{ company: 'Example GmbH', role: 'Analyst', bullets: ['Built reports.', 'Checked data.', 'Documented results.'] }],
    projects: [{ name: 'Analytics', tech: ['Python', 'SQL', 'validation'], bullets: ['Built models.', 'Validated inputs.', 'Shared findings.'] }],
    education: [{ title: 'M.Sc. Analytics', org: 'Example University', year: '2024' }],
    skills: [
      { category: 'Business/Domain Knowledge', items: ['market research'] },
      { category: 'Programming Languages', items: ['Python', 'SQL'] },
      { category: 'Tools/Frameworks', items: ['Power BI', 'Git'] },
    ],
  }));
  try {
    assert.throws(
      () => execFileSync(process.execPath, [
        resolve('build-cv-html.mjs'), input, output, resolve('templates/cv-template.html'), '--tailored',
      ], { encoding: 'utf8', stdio: 'pipe' }),
      /tailoring: required/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('HTML tailored mode applies shared presentation policy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-ops-cv-html-policy-'));
  const input = join(dir, 'payload.json');
  const output = join(dir, 'cv.html');
  writeFileSync(input, JSON.stringify({
    lang: 'en',
    candidate: { name: 'Jane Doe', email: 'jane@example.com' },
    summary: Array(540).fill('analysis').join(' '),
    experience: [{ company: 'Example GmbH', role: 'Analyst', bullets: ['Built reports.', 'Checked data.', 'Documented results.'] }],
    projects: [{ name: 'Analytics', tech: ['Python', 'SQL', 'validation'], bullets: ['Built models.', 'Validated inputs.', 'Shared findings.'] }],
    education: [{ title: 'M.Sc. Analytics', org: 'Example University', location: 'Berlin, Germany', year: '2024' }],
    skills: [
      { category: 'Business/Domain Knowledge', items: ['market research'] },
      { category: 'Programming Languages', items: ['Python', 'SQL'] },
      { category: 'Tools/Frameworks', items: ['Power BI', 'Git'] },
    ],
    tailoring: {
      jd_keywords: ['analysis', 'Python'],
      selected_project_names: ['Analytics'],
      selected_experience_roles: ['Analyst'],
    },
  }));
  try {
    execFileSync(process.execPath, [
      resolve('build-cv-html.mjs'), input, output, resolve('templates/cv-template.html'), '--tailored',
    ], { encoding: 'utf8', stdio: 'pipe' });
    const html = readFileSync(output, 'utf8');
    assert.match(html, /Example University[\s\S]*Germany/);
    assert.doesNotMatch(html, /Example University[\s\S]*Berlin, Germany/);
    assert.match(html, /Python, SQL, validation/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
