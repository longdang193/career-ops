import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { buildMarkdown, resolveCoverTemplatePath } from '../generate-cover-letter.mjs';

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
