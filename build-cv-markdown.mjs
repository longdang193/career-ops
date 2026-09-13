#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { hasRequiredFields, validatePayload } from './lib/cv-payload-schema.mjs';
import { formatCvList, formatEducationInstitution, formatEducationLocation, formatSkillItems, loadDocumentRules, validateCvPresentation, validatePayloadLimits, validateRenderedWordCount, validateTailoringMetadata } from './lib/document-rules.mjs';
import { resolveTemplate, validateTemplate } from './cv-templates.mjs';
import { isMainModule } from './lib/is-main-module.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const TOKEN_RE = /\{\{[A-Z_]+\}\}/g;

function escapeHtml(value) {
  if (value === null || value === undefined || typeof value === 'object') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function markdownText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function safeUrl(value) {
  const url = markdownText(value);
  if (/^(?:https?:|mailto:|tel:)/i.test(url)) return url;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
  return '';
}

function linkValue(value) {
  if (value && typeof value === 'object') {
    return { url: safeUrl(value.url), display: markdownText(value.display || value.url) };
  }
  const url = safeUrl(value);
  return { url, display: markdownText(value) };
}

function markdownLink(value) {
  const link = linkValue(value);
  if (!link.display) return '';
  return link.url ? `[${link.display}](${link.url})` : link.display;
}

function contactItem(icon, value) {
  const link = linkValue(value);
  if (!link.display) return '';
  return `<span class="iconify" data-icon="${icon}"></span> ${markdownLink(value)}`;
}

function buildContact(payload) {
  const first = [
    contactItem('tabler:mail', payload.email),
    contactItem('tabler:phone', payload.phone ? { url: `tel:${String(payload.phone).replace(/[^\d+]/g, '')}`, display: payload.phone } : ''),
    contactItem('tabler:brand-linkedin', payload.linkedin),
  ].filter(Boolean);
  const second = [
    contactItem('tabler:brand-github', payload.github),
    contactItem('ic:outline-location-on', payload.location),
  ].filter(Boolean);
  return [first.join('\n  : '), second.join('\n  : ')].filter(Boolean).join('\n\n');
}

function buildEducation(entries = []) {
  return entries.filter((entry) => hasRequiredFields(entry, 'education', 'md')).map((entry) => {
    const institution = [formatEducationInstitution(entry.institution, entry.location), formatEducationLocation(entry.location)].filter(Boolean).join(', ');
    const coursework = Array.isArray(entry.coursework) && entry.coursework.length
      ? `\n\nRelevant subjects: ${entry.coursework.map(markdownText).filter(Boolean).join(', ')}`
      : '';
    return `**${markdownText(entry.degree)}**\n  : **${institution}**\n  : **${markdownText(entry.dates)}**${coursework}`;
  }).join('\n\n');
}

function buildExperience(entries = []) {
  return entries.filter((entry) => hasRequiredFields(entry, 'experience', 'md')).map((entry) => {
    const employer = [markdownText(entry.company), markdownText(entry.location)].filter(Boolean).join(', ');
    const bullets = (Array.isArray(entry.bullets) ? entry.bullets : []).map((bullet) => `- ${markdownText(bullet)}`).filter((line) => line !== '-');
    return `**${markdownText(entry.role)}**\n  : **${employer}**\n  : **${markdownText(entry.dates)}**${bullets.length ? `\n\n${bullets.join('\n')}` : ''}`;
  }).join('\n\n');
}

function buildProjects(entries = []) {
  return entries.filter((entry) => hasRequiredFields(entry, 'projects', 'md')).map((entry) => {
    const context = formatCvList(entry.context);
    const dates = markdownText(entry.dates);
    const meta = [context, dates].filter(Boolean).map((value) => `  : **${value}**`).join('\n');
    const repository = entry.url
      ? `\n\n<span class="iconify" data-icon="tabler:brand-github"></span>: ${markdownLink({ url: entry.url, display: entry.name })}`
      : '';
    const bullets = (Array.isArray(entry.bullets) ? entry.bullets : []).map((bullet) => `- ${markdownText(bullet)}`).filter((line) => line !== '-');
    return `**${markdownText(entry.name)}**${meta ? `\n${meta}` : ''}${repository}${bullets.length ? `\n\n${bullets.join('\n')}` : ''}`;
  }).join('\n\n');
}

function buildCertifications(entries = []) {
  return entries.filter((entry) => hasRequiredFields(entry, 'certifications', 'md')).map((entry) => {
    const title = entry.url ? `**${markdownLink({ url: entry.url, display: entry.title })}**` : `**${markdownText(entry.title)}**`;
    const issuer = markdownText(entry.org);
    const year = markdownText(entry.year);
    const focus = formatCvList(entry.focus);
    return `${title}${issuer ? `\n  : **${issuer}**` : ''}${year ? `\n  : **${year}**` : ''}${focus ? `\n\nFocus: ${focus}` : ''}`;
  }).join('\n\n');
}

function buildSkills(categories = []) {
  return categories.filter((entry) => hasRequiredFields(entry, 'skills', 'md')).map((entry) => {
    const items = formatSkillItems(entry.items);
    return `**${markdownText(entry.category)}:** ${items}`;
  }).join('\n\n');
}

function renderTemplate(source, replacements) {
  const unresolved = new Set();
  const rendered = source.replace(TOKEN_RE, (token) => {
    if (!(token in replacements)) {
      unresolved.add(token);
      return token;
    }
    return replacements[token];
  });
  if (unresolved.size) throw new Error(`Unresolved placeholders: ${[...unresolved].join(', ')}`);
  return rendered;
}

export function buildMarkdown(payload, templatePath, { requireTailoring = false } = {}) {
  const path = templatePath || resolveTemplate('cv', undefined, { format: 'md' });
  if (!existsSync(path)) throw new Error(`Template not found: ${path}`);
  const validity = validateTemplate(path, 'cv');
  if (!validity.ok) throw new Error(`Template missing required placeholders: ${validity.missing.map((name) => `{{${name}}}`).join(', ')}`);
  const { errors, warnings } = validatePayload(payload, 'md');
  if (errors.length) throw new Error(`Invalid CV payload: ${errors.join('; ')}`);
  if (warnings.length) throw new Error(`CV payload cannot be rendered safely: ${warnings.join('; ')}`);
  const rules = loadDocumentRules();
  validatePayloadLimits('cv', payload, rules);
  const markdown = renderTemplate(readFileSync(path, 'utf8'), {
    '{{NAME}}': markdownText(payload.name),
    '{{CONTACT_BLOCK}}': buildContact(payload),
    '{{SUMMARY}}': markdownText(payload.summary),
    '{{EDUCATION}}': buildEducation(payload.education),
    '{{EXPERIENCE}}': buildExperience(payload.experience),
    '{{PROJECTS}}': buildProjects(payload.projects),
    '{{CERTIFICATIONS}}': buildCertifications(payload.certifications),
    '{{SKILLS}}': buildSkills(payload.skills),
  });
  validateTailoringMetadata('cv', payload, markdown, { required: requireTailoring });
  if (requireTailoring) validateCvPresentation(payload, 'md', rules);
  return markdown;
}

function main() {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      output: { type: 'string' },
      template: { type: 'string' },
      tailored: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help || !values.input || !values.output) {
    console.error('Usage: node build-cv-markdown.mjs --input payload.json --output output.md [--template name] [--tailored]');
    process.exit(values.help ? 0 : 1);
  }
  const input = resolve(values.input);
  const output = resolve(values.output);
  if (!existsSync(input)) throw new Error(`Input file not found: ${input}`);
  const markdown = buildMarkdown(JSON.parse(readFileSync(input, 'utf8')), values.template
    ? resolveTemplate('cv', values.template, { format: 'md' })
    : undefined, { requireTailoring: values.tailored });
  validateRenderedWordCount('cv', markdown, loadDocumentRules(), 'md');
  writeFileSync(output, markdown, 'utf8');
  console.log(`CV Markdown: ${output}`);
}

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(`ERROR generating CV Markdown: ${err.message}`);
    process.exit(1);
  }
}
