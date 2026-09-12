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
      bullets: ['Built reporting workflows.'],
    }],
    projects: [{
      name: 'Decision Support',
      context: 'Python, SQL',
      dates: '2025',
      url: 'https://github.com/jane/decision-support',
      bullets: ['Added validation checks.'],
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
