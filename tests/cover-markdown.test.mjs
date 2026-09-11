import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const LONG_DANG_TEMPLATE = fileURLToPath(new URL('../templates/cover-letter-template.long-dang.md', import.meta.url));
import { buildMarkdown, resolveCoverTemplatePath, validateCoverConstraints } from '../generate-cover-letter.mjs';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'cover-markdown-'));
  writeFileSync(
    join(dir, 'cover-letter-template.md'),
    '# {{NAME}}\n\n{{SUBTITLE}}\n\n## WHY {{COMPANY_SHORT_NAME}}?\n\n{{PROBLEMS_BLOCK}}\n\n{{OPENING}}\n\n{{ACHIEVEMENTS_BLOCK}}\n\n{{SIGNATURE_BLOCK}}\n',
  );
  writeFileSync(
    join(dir, 'cover-letter-template.long-dang.md'),
    '<!-- career-ops-template\nname: Example Candidate\nversion: 1.0.0\n-->\n# {{NAME}}\n{{ROLE_TITLE}}\n{{OPENING}}',
  );
  const profile = join(dir, 'profile.yml');
  writeFileSync(profile, 'cover_letter:\n  template: long-dang\n');
  return { dir, profile };
}

test('Markdown matches reference header and prose structure', () => {
  const markdown = buildMarkdown({
    candidate: {
      name: 'Example Candidate',
      subtitle: 'Analytics Candidate',
      email: 'candidate@example.test',
      phone: '+00 00000 000000',
      linkedin: 'https://example.com/in/candidate',
      github: 'https://github.com/example',
      quote: 'Work with discipline; let results speak.',
    },
    letter: {
      recipient_team: 'Company Recruitment Team',
      company: 'Example Consumer Goods AG',
      company_short_name: 'Example Consumer Goods',
      role_title: 'Working Student Commercial Analytics',
      greeting: 'Dear recruitment team,',
      opening: 'I am pursuing a master’s degree in operations research and business analytics.',
      profile_intro: 'My background combines consumer research and commercial reporting.',
      problems_section: 'This position connects category growth with sales and shopper analysis.',
      achievements: [
        { lead: 'At Example Company One', impact: 'I combined sales data and customer insights to support product decisions.' },
        { lead: 'At Example Company Two', impact: 'I evaluated consumer and market evidence to improve campaign recommendations.' },
      ],
      closing: 'I would welcome the opportunity to discuss my application further.',
      signature: { valediction: 'Sincerely,' },
    },
  }, LONG_DANG_TEMPLATE);

  assert.match(markdown, /<a href="#">Analytics Candidate/);
  assert.match(markdown, /<span class="resume-header-item"><span class="iconify" data-icon="tabler:mail"><\/span> <a href="mailto:candidate@example.test">candidate@example.test<\/a><\/span>/);
  assert.match(markdown, /<span class="resume-header-item no-separator"><span class="iconify" data-icon="tabler:brand-github"><\/span>/);
  assert.match(markdown, /\*\*Company Recruitment Team\*\*<br>\n\*\*Example Consumer Goods AG\*\*/);
  assert.match(markdown, /## WHY Example Consumer Goods?/);
  assert.match(markdown, /At Example Company One, I combined sales data/);
  assert.doesNotMatch(markdown, /- \*\*At Example Company One/);
  assert.match(markdown, /<br>\n\nSincerely,\n\*\*Example Candidate\*\*/);
});

test('reverse timeline template renders structured sections and experience branches', () => {
  const template = fileURLToPath(new URL('../templates/cover-letter-template.reverse-timeline.md', import.meta.url));
  const markdown = buildMarkdown({
    candidate: {
      name: 'Example Candidate',
      subtitle: 'Analytics Candidate',
      email: 'candidate@example.test',
      phone: '+00 00000 000000',
      linkedin: 'https://example.com/in/candidate',
      github: 'https://github.com/example',
    },
    letter: {
      role_title: 'Working Student Commercial Analytics',
      company: 'Probe Analytics GmbH',
      recipient_team: 'Company Recruitment Team',
      greeting: 'Dear recruitment team,',
      opening: 'I connect commercial questions with analytical decision support.',
      profile_intro: 'My experience spans research, reporting, and process improvement.',
      attention: {
        title: 'This role connects commercial questions with analytical decision support.',
        text: 'It brings data, market understanding, and business decisions together.',
      },
      challenge: {
        title: 'How can scattered signals become timely action?',
        text: 'The value lies in identifying what matters for the next decision.',
      },
      perspective: {
        title: 'Useful analysis shortens the distance between evidence and action.',
        text: 'That principle guides my work across research and analytics.',
      },
      experience: [
        { title: 'Consumer Research', bullets: ['Combined consumer and market evidence.', 'Identified meaningful patterns.'] },
        { title: 'Analytics', bullets: ['Worked with sales and campaign data.', 'Built structured decision support.'] },
      ],
      contribution: {
        title: 'A perspective connecting context, evidence, and execution.',
        bullets: ['Structure commercial questions.', 'Translate findings into concise outputs.'],
      },
      closing: 'I would welcome the opportunity to discuss my contribution further.',
      signature: { valediction: 'Sincerely,' },
    },
  }, template);

  assert.match(markdown, /<div class="reverse-letter">/);
  assert.match(markdown, /<h2 class="tl-kicker">WHAT CAUGHT MY ATTENTION<\/h2>/);
  assert.match(markdown, /<h2 class="tl-kicker">THE CHALLENGE<\/h2>/);
  assert.match(markdown, /<h2 class="tl-kicker">MY PERSPECTIVE<\/h2>/);
  assert.equal((markdown.match(/class="branch-node"/g) || []).length, 2);
  assert.match(markdown, /<h3 class="branch-title">Consumer Research<\/h3>/);
  assert.match(markdown, /<h2 class="tl-kicker">WHAT I WOULD CONTRIBUTE<\/h2>/);
  assert.match(markdown, /<strong>Example Candidate<\/strong>/);
  assert.doesNotMatch(markdown, /\*\*Example Candidate\*\*/);
  assert.doesNotMatch(markdown, /\{\{[A-Z_]+\}\}/);
});

test('Markdown cover templates resolve and render through shared replacements', () => {
  const { dir, profile } = fixture();
  try {
    const template = resolveCoverTemplatePath({}, { dir, profilePath: profile, format: 'md' });
    assert.equal(basename(template), 'cover-letter-template.long-dang.md');

    const markdown = buildMarkdown({
      candidate: { name: 'Jane Doe', subtitle: 'Analytics Candidate' },
      letter: {
        role_title: 'Analyst',
        company: 'Acme GmbH',
        company_short_name: 'Acme',
        opening: 'I improve reporting quality.',
        profile_intro: 'Five years of analytics work.',
        problems_section: 'I would help turn operational data into clear decisions.',
        achievements: [{ lead: 'Reporting', impact: 'improved decision speed.' }],
        signature: { valediction: 'Sincerely,' },
      },
    }, join(dir, 'cover-letter-template.md'));

    assert.match(markdown, /# Jane Doe/);
    assert.match(markdown, /## WHY Acme\?/);
    assert.match(markdown, /- \*\*Reporting,\*\* improved decision speed\./);
    assert.match(markdown, /\*\*Jane Doe\*\*/);
    assert.doesNotMatch(markdown, /\{\{[A-Z_]+\}\}/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('template contract controls evidence count and presentation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cover-contract-'));
  const template = join(dir, 'cover-letter-template.compact.md');
  writeFileSync(template, `<!-- career-ops-template
name: Compact
evidence_min: 1
evidence_max: 2
evidence_style: bullets
-->
# {{NAME}}
{{OPENING}}
{{ACHIEVEMENTS_BLOCK}}
{{SIGNATURE_BLOCK}}
`);
  const payload = {
    candidate: { name: 'Jane Doe' },
    letter: {
      role_title: 'Analyst',
      company: 'Acme GmbH',
      opening: 'I improve reporting quality.',
      profile_intro: 'I bring analytics experience.',
      achievements: [{ lead: 'Reporting', impact: 'improved decision speed.' }],
      signature: { valediction: 'Sincerely,' },
    },
  };
  assert.match(buildMarkdown(payload, template), /- \*\*Reporting,\*\* improved decision speed\./);
  assert.throws(() => buildMarkdown({ ...payload, letter: { ...payload.letter, achievements: [] } }, template), /requires 1-2 evidence blocks/);
  assert.throws(() => buildMarkdown({ ...payload, letter: { ...payload.letter, achievements: [payload.letter.achievements[0], payload.letter.achievements[0], payload.letter.achievements[0]] } }, template), /requires 1-2 evidence blocks/);
  rmSync(dir, { recursive: true, force: true });
});

test('cover constraints count semantic body words, not header markup', () => {
  assert.deepEqual(validateCoverConstraints('one two three', [], {
    minWords: 3,
    targetWords: 3,
    maxWords: 3,
    maxEvidenceClaims: 1,
  }), { words: 3, targetWords: 3 });
  assert.throws(() => validateCoverConstraints('one two', [], {
    minWords: 3,
    maxWords: 3,
    maxEvidenceClaims: 1,
  }), /minimum is 3/);
});
