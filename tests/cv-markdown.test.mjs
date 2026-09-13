import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { buildMarkdown } from '../build-cv-markdown.mjs';

const TEMPLATE = resolve('templates/cv-template.long-dang.md');

test('buildMarkdown renders configured CV template without changing its HTML structure', () => {
  const markdown = buildMarkdown({
    name: 'Jane Doe',
    email: { url: 'jane@example.com', display: 'jane@example.com' },
    phone: '+49 123 456789',
    location: 'Berlin, Germany',
    linkedin: { url: 'https://linkedin.com/in/jane', display: 'linkedin.com/in/jane' },
    github: { url: 'https://github.com/jane', display: 'github.com/jane' },
    summary: 'Analytics candidate who improves decision quality.',
    education: [{
      institution: 'Example University',
      location: 'Berlin, Germany',
      degree: 'M.Sc. Analytics',
      dates: '2024 - Present',
      coursework: ['Databases', 'Machine Learning'],
    }],
    experience: [{
      company: 'Example GmbH',
      role: 'Analyst',
      location: 'Berlin, Germany',
      dates: '2022 - 2024',
      bullets: ['Built reporting workflows.', 'Improved reporting consistency.', 'Reduced manual reporting effort.'],
    }],
    projects: [{
      name: 'Decision Support',
      context: 'Python, SQL',
      dates: '2025',
      url: 'https://github.com/jane/decision-support',
      bullets: ['Added validation checks.', 'Documented validation rules.', 'Reduced avoidable data errors.'],
    }],
    certifications: [{ title: 'Azure AI Engineer', org: 'Microsoft', year: '2026' }],
    skills: [{ category: 'Programming', items: ['SQL', 'Python'] }],
  }, TEMPLATE);

  assert.match(markdown, /<span class="iconify" data-icon="tabler:mail"><\/span>/);
  assert.match(markdown, /\*\*M\.Sc\. Analytics\*\*/);
  assert.match(markdown, /- Built reporting workflows\./);
  assert.match(markdown, /\[Decision Support\]\(https:\/\/github\.com\/jane\/decision-support\)/);
  assert.match(markdown, /## Summary[\s\S]*## Education[\s\S]*## Experience[\s\S]*## Projects[\s\S]*## Certificates[\s\S]*## Skills/);
  assert.equal((markdown.match(/\{\{[A-Z_]+\}\}/g) || []).length, 0);
  assert.doesNotMatch(markdown, /\[(?:FULL NAME|email@example\.com|City, Country)\]/);
});

test('buildMarkdown rejects payload sections the Markdown template cannot render', () => {
  assert.throws(
    () => buildMarkdown({
      name: 'Jane Doe',
      education: [],
      experience: [],
      projects: [],
      certifications: [],
      skills: [],
      awards: [{ title: 'Unrendered Award' }],
    }, TEMPLATE),
    /will not appear in the output/
  );
});

test('buildMarkdown rejects tailored payloads that omit JD keywords from rendered CV', () => {
  const payload = {
    name: 'Jane Doe',
    summary: 'Accounting analyst with Excel experience.',
    education: [],
    experience: [{ company: 'Example GmbH', role: 'Analyst', bullets: ['Built reports.', 'Checked data.', 'Documented results.'] }],
    projects: [{ name: 'Analytics', bullets: ['Built models.', 'Validated inputs.', 'Shared findings.'] }],
    certifications: [],
    skills: [{ category: 'Tools', items: ['Excel'] }],
    tailoring: {
      jd_keywords: ['accounting', 'Excel'],
      selected_project_names: ['Analytics'],
      selected_experience_roles: ['Analyst'],
    },
  };
  assert.doesNotThrow(() => buildMarkdown(payload, TEMPLATE));
  assert.throws(() => buildMarkdown({
    ...payload,
    tailoring: { ...payload.tailoring, jd_keywords: ['accounting', 'onboarding'] },
  }, TEMPLATE), /missing from rendered onboarding/);
});

test('buildMarkdown requires tailoring metadata when tailored mode is explicit', () => {
  assert.throws(() => buildMarkdown({
    name: 'Jane Doe',
    summary: 'Accounting analyst.',
    education: [],
    experience: [{ company: 'Example GmbH', role: 'Analyst', bullets: ['Built reports.', 'Checked data.', 'Documented results.'] }],
    projects: [{ name: 'Analytics', bullets: ['Built models.', 'Validated inputs.', 'Shared findings.'] }],
    certifications: [],
    skills: [{ category: 'Tools', items: ['Excel'] }],
  }, TEMPLATE, { requireTailoring: true }), /tailoring: required/);
});

test('tailored Markdown applies profile presentation policy', () => {
  const markdown = buildMarkdown({
    name: 'Jane Doe',
    summary: 'Business analyst with market research and Python experience.',
    education: [{ institution: 'Example University', location: 'Berlin, Germany', degree: 'M.Sc. Analytics', dates: '2024 - Present' }],
    experience: [{ company: 'Example GmbH', role: 'Analyst', bullets: ['Built reports.', 'Checked data.', 'Documented results.'] }],
    projects: [{ name: 'Analytics', context: ['Python', 'SQL', 'validation'], bullets: ['Built models.', 'Validated inputs.', 'Shared findings.'] }],
    certifications: [{ title: 'Certificate', focus: ['SQL', 'data modeling'] }],
    skills: [
      { category: 'Business/Domain Knowledge', items: ['market research'] },
      { category: 'Programming Languages', items: ['Python', 'SQL'] },
      { category: 'Tools/Frameworks', items: ['Power BI', 'Git'] },
    ],
    tailoring: {
      jd_keywords: ['business analyst', 'Python'],
      selected_project_names: ['Analytics'],
      selected_experience_roles: ['Analyst'],
    },
  }, TEMPLATE, { requireTailoring: true });

  assert.match(markdown, /Example University, Germany/);
  assert.doesNotMatch(markdown, /Example University, Berlin, Germany/);
  assert.match(markdown, /Focus: SQL, data modeling/);
  assert.match(markdown, /Python, SQL, validation/);
});

test('tailored Markdown rejects non-canonical skill categories', () => {
  assert.throws(() => buildMarkdown({
    name: 'Jane Doe',
    summary: 'Business analyst with Excel and Python experience.',
    education: [],
    experience: [{ company: 'Example GmbH', role: 'Analyst', bullets: ['Built reports.', 'Checked data.', 'Shared findings.'] }],
    projects: [],
    certifications: [],
    skills: [
      { category: 'reporting and analysis tools', items: ['Excel', 'data analysis'] },
      { category: 'business intelligence tools', items: ['Power BI'] },
      { category: 'reporting and communication tools', items: ['PowerPoint'] },
    ],
    tailoring: {
      jd_keywords: ['business analyst', 'Python'],
      selected_project_names: [],
      selected_experience_roles: ['Analyst'],
    },
  }, TEMPLATE, { requireTailoring: true }), /skills: missing required categories/);
});
