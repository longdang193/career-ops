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
    '<!-- career-ops-template\nname: Long Dang\nversion: 1.0.0\n-->\n# {{NAME}}\n{{ROLE_TITLE}}\n{{OPENING}}',
  );
  const profile = join(dir, 'profile.yml');
  writeFileSync(profile, 'cover_letter:\n  template: long-dang\n');
  return { dir, profile };
}

test('Long Dang Markdown matches reference header and prose structure', () => {
  const markdown = buildMarkdown({
    candidate: {
      name: 'LONG DANG',
      subtitle: 'M.Sc. Operations Research and Business Analytics Student · Data and Analytics Candidate',
      email: 'long@example.test',
      phone: '(+49) 15560 668152',
      linkedin: 'https://www.linkedin.com/in/longdhp/',
      github: 'https://github.com/longdang193',
      quote: 'Work with discipline; let results speak.',
    },
    letter: {
      recipient_team: 'Company Recruitment Team',
      company: 'Beiersdorf AG',
      company_short_name: 'Beiersdorf',
      role_title: 'Working Student Global Shopper & Customer Marketing NIVEA (all genders)',
      greeting: 'Dear recruitment team,',
      opening: 'I am pursuing an M.Sc. in Operations Research and Business Analytics.',
      profile_intro: 'My background combines consumer research and commercial reporting.',
      problems_section: 'This position connects category growth with sales and shopper analysis.',
      achievements: [
        { lead: 'At KOKUYO Vietnam Trading', impact: 'I combined sales data and customer insights to support product decisions.' },
        { lead: 'At Long Hung ITS', impact: 'I evaluated consumer and market evidence to improve campaign recommendations.' },
      ],
      closing: 'I would welcome the opportunity to discuss my application further.',
      signature: { valediction: 'Sincerely,' },
    },
  }, LONG_DANG_TEMPLATE);

  assert.match(markdown, /<a href="#">M.Sc. Operations Research and Business Analytics Student/);
  assert.match(markdown, /<span class="resume-header-item"><span class="iconify" data-icon="tabler:mail"><\/span> <a href="mailto:long@example.test">long@example.test<\/a><\/span>/);
  assert.match(markdown, /<span class="resume-header-item no-separator"><span class="iconify" data-icon="tabler:brand-github"><\/span>/);
  assert.match(markdown, /\*\*Company Recruitment Team\*\*<br>\n\*\*Beiersdorf AG\*\*/);
  assert.match(markdown, /## WHY Beiersdorf?/);
  assert.match(markdown, /At KOKUYO Vietnam Trading, I combined sales data/);
  assert.doesNotMatch(markdown, /- \*\*At KOKUYO Vietnam Trading/);
  assert.match(markdown, /<br>\n\nSincerely,\n\*\*LONG DANG\*\*/);
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

test('reverse timeline falls back to achievements when experience is empty', () => {
  const template = fileURLToPath(new URL('../templates/cover-letter-template.reverse-timeline.md', import.meta.url));
  const markdown = buildMarkdown({
    candidate: { name: 'Example Candidate' },
    letter: {
      role_title: 'Working Student Analyst',
      company: 'Probe Analytics GmbH',
      greeting: 'Dear recruitment team,',
      opening: 'I connect evidence with decisions.',
      profile_intro: 'My background combines research and reporting.',
      attention: 'Structured analysis fits this role.',
      challenge: 'The work requires clear evidence.',
      perspective: 'I work carefully with documented inputs.',
      experience: [],
      achievements: [
        { lead: 'Research experience', impact: 'I prepared evidence for business decisions.' },
        { lead: 'Reporting experience', impact: 'I prepared clear reporting for stakeholders.' },
      ],
      contribution: { title: 'Contribution', bullets: ['Support reporting and analysis.'] },
      closing: 'Thank you for considering my application.',
      signature: { valediction: 'Kind regards,', name: 'Example Candidate' },
    },
  }, template);
  assert.match(markdown, /<h3 class="branch-title">Research experience<\/h3>[\s\S]*I prepared evidence for business decisions/);
});

test('reverse timeline rejects sentence fragments in timeline copy', () => {
  const template = fileURLToPath(new URL('../templates/cover-letter-template.reverse-timeline.md', import.meta.url));
  const payload = {
    candidate: { name: 'Example Candidate', subtitle: 'Analytics Candidate' },
    letter: {
      role_title: 'Analyst',
      company: 'Acme GmbH',
      opening: 'I improve reporting quality.',
      profile_intro: 'I bring analytics experience.',
      attention: {
        title: 'This role connects analysis with process improvement. requires reliable evidence.',
        text: 'I value clear inputs and disciplined follow-through.',
      },
      challenge: { title: 'How can analysis become useful action?', text: 'By checking data and documenting decisions.' },
      perspective: { title: 'Evidence should guide action.', text: 'That principle guides my work.' },
      experience: [
        { title: 'Analytics', bullets: ['Built reports.', 'Checked inputs.'] },
        { title: 'Research', bullets: ['Compared evidence.', 'Communicated findings.'] },
      ],
      contribution: { title: 'Clear and careful execution.', bullets: ['Document work.', 'Raise issues early.'] },
      closing: 'I would welcome the opportunity to discuss my contribution further.',
    },
  };

  assert.throws(() => buildMarkdown(payload, template), /sentence fragment/);
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
        achievements: [
          { lead: 'Reporting', impact: 'improved decision speed.' },
          { lead: 'Controls', impact: 'reduced avoidable errors.' },
        ],
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
        achievements: [
          { lead: 'Reporting', impact: 'improved decision speed.' },
          { lead: 'Controls', impact: 'reduced avoidable errors.' },
        ],
      signature: { valediction: 'Sincerely,' },
    },
  };
  assert.match(buildMarkdown(payload, template), /- \*\*Reporting,\*\* improved decision speed\./);
  assert.throws(() => buildMarkdown({ ...payload, letter: { ...payload.letter, achievements: [] } }, template), /requires 2-4 evidence blocks/);
  assert.throws(() => buildMarkdown({ ...payload, letter: { ...payload.letter, achievements: Array(5).fill(payload.letter.achievements[0]) } }, template), /requires 2-4 evidence blocks/);
  rmSync(dir, { recursive: true, force: true });
});

test('Markdown cover rendering rejects tailored payloads with unrendered JD keywords', () => {
  const template = LONG_DANG_TEMPLATE;
  const payload = {
    candidate: { name: 'Jane Doe', subtitle: 'Analytics Candidate' },
    letter: {
      role_title: 'Analyst',
      company: 'Acme GmbH',
      company_short_name: 'Acme',
      opening: 'I improve accounting reporting with Excel.',
      profile_intro: 'I bring careful analytics experience.',
      problems_section: 'I turn operational data into clear decisions.',
      achievements: [
        { lead: 'Reporting', impact: 'improved decision speed.' },
        { lead: 'Controls', impact: 'reduced avoidable errors.' },
      ],
      signature: { valediction: 'Sincerely,' },
    },
    tailoring: {
      jd_keywords: ['accounting', 'Excel'],
      selected_evidence_titles: ['Reporting', 'Controls'],
    },
  };
  assert.doesNotThrow(() => buildMarkdown(payload, template));
  assert.throws(() => buildMarkdown({
    ...payload,
    tailoring: { ...payload.tailoring, jd_keywords: ['accounting', 'onboarding'] },
  }, template), /missing from rendered onboarding/);
});

test('Markdown cover rendering requires tailoring metadata when tailored mode is explicit', () => {
  assert.throws(() => buildMarkdown({
    candidate: { name: 'Jane Doe', subtitle: 'Analytics Candidate' },
    letter: {
      role_title: 'Analyst',
      company: 'Acme GmbH',
      company_short_name: 'Acme',
      opening: 'I improve accounting reporting with Excel.',
      profile_intro: 'I bring careful analytics experience.',
      problems_section: 'I turn operational data into clear decisions.',
      achievements: [
        { lead: 'Reporting', impact: 'improved decision speed.' },
        { lead: 'Controls', impact: 'reduced avoidable errors.' },
      ],
      signature: { valediction: 'Sincerely,' },
    },
  }, LONG_DANG_TEMPLATE, { requireTailoring: true }), /tailoring: required/);
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
