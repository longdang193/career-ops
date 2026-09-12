#!/usr/bin/env node
/**
 * generate-cover-letter.mjs — Writes Markdown or renders a cover letter PDF.
 *
 * Usage:
 *   node generate-cover-letter.mjs --payload payload.json
 *   node generate-cover-letter.mjs --payload payload.json --out output/slug-cover.pdf
 *
 * Fills the selected cover-letter template. Markdown stays canonical; PDF
 * output uses the same Playwright pipeline used for CVs.
 *
 * `buildHtml` and `safeOutputPath` are exported as pure functions so the
 * template and --out path guard can be tested without loading Playwright
 * (renderHtmlToPdf is imported lazily inside main).
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, resolve, join, relative, isAbsolute } from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "util";
import { assertFacts } from "./verify-cv-facts.mjs";
import { getTemplateContract, resolveTemplate } from "./cv-templates.mjs";
import { countVisibleWords, loadDocumentRules, validatePayloadLimits, validateRenderedWordCount, validateTailoringMetadata } from "./lib/document-rules.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = resolve(__dirname, "output");

/**
 * Resolve a requested cover-letter output path.
 *
 * Paths that stay inside `output/` keep their relative subdirectory (the
 * application-bundle layout `generate-pdf.mjs` already supports). Paths that
 * would escape `output/` — `..` traversal or an absolute path outside it —
 * are rejected instead of being silently flattened to `output/<basename>`.
 *
 * @param {string} raw - Caller-supplied --out / payload.output_path value.
 * @returns {string} Absolute path inside OUTPUT_ROOT.
 */
export function safeOutputPath(raw) {
  if (raw == null || String(raw).trim() === "") {
    throw new Error("Refusing to write the cover letter outside output/: (empty path)");
  }
  const trimmed = String(raw).trim();

  const asWritten = resolve(trimmed);
  if (containedInOutput(asWritten)) return asWritten;

  // Absolute paths and any `..` segment already chose a location; if that
  // location is not inside output/, refuse instead of rewriting to a basename.
  if (isAbsolute(trimmed) || /(^|[\\/])\.\.([\\/]|$)/.test(trimmed)) {
    throw new Error(`Refusing to write the cover letter outside output/: ${raw}`);
  }

  // Bare filename or a relative path that is not already under output/
  // (e.g. --out cover.pdf, or --out output/foo/bar.pdf from another cwd).
  const posix = trimmed.replace(/\\/g, "/").replace(/^\.\//, "");
  const relativeToRoot = posix === "output" || posix === "output/"
    ? ""
    : posix.startsWith("output/")
      ? posix.slice("output/".length)
      : posix;
  const candidate = resolve(OUTPUT_ROOT, relativeToRoot);
  if (containedInOutput(candidate)) return candidate;

  throw new Error(`Refusing to write the cover letter outside output/: ${raw}`);
}

/** True when absPath is a file (not output/ itself) still inside OUTPUT_ROOT. */
function containedInOutput(absPath) {
  const rel = relative(OUTPUT_ROOT, absPath);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** Assert that a payload object contains the required keys. */
function _require(obj, keys, context) {
  for (const key of keys) {
    if (!obj || typeof obj !== "object" || !(key in obj)) {
      throw new Error(`Missing required field: ${context}.${key}`);
    }
  }
}

/** Escape user-provided text before inserting it into generated HTML. */
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Add an HTTPS scheme to a profile URL when it is omitted. */
function asUrl(value) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function profileLink(value) {
  if (typeof value === 'object' && value !== null) {
    return { url: value.url || '', display: value.display || value.url || '' };
  }
  return { url: value || '', display: value || '' };
}

/** Build the escaped contact line shown in the cover-letter header. */
function buildContactLine(candidate) {
  const parts = [];
  if (candidate.location) parts.push(escapeHtml(candidate.location));
  if (candidate.email) {
    const email = escapeHtml(candidate.email);
    parts.push(`<a href="mailto:${email}">${email}</a>`);
  }
  if (candidate.phone) parts.push(escapeHtml(candidate.phone));
  if (candidate.linkedin) {
    const link = profileLink(candidate.linkedin);
    parts.push(`<a href="${escapeHtml(asUrl(link.url))}">${escapeHtml(link.display.replace(/^https?:\/\//i, ""))}</a>`);
  }
  if (candidate.github) {
    const link = profileLink(candidate.github);
    parts.push(`<a href="${escapeHtml(asUrl(link.url))}">${escapeHtml(link.display.replace(/^https?:\/\//i, ""))}</a>`);
  }
  return parts.join(" &nbsp;|&nbsp; ");
}

/** Build the optional credentials line from the candidate payload. */
function buildCredentialsBlock(candidate) {
  const credentials = candidate.credentials || [];
  if (!credentials.length) return "";
  return `<div class="credentials">${credentials.map(escapeHtml).join(" &nbsp;|&nbsp; ")}</div>`;
}

/** Build the escaped company, city, and date line for the letter. */
function buildDateline(letter) {
  const parts = [letter.company, letter.city, letter.date].filter(Boolean).map(escapeHtml);
  return parts.join(" &nbsp;&nbsp; ");
}

/** Build the optional achievements list for the letter body. */
function buildAchievementsBlock(achievements) {
  if (!achievements || !achievements.length) return "";
  const items = achievements.map(ach => {
    // Trim a caller-supplied trailing comma (cover.md's own bullet-format
    // example shows the lead ending in a comma) so it never doubles up with
    // the comma this function always appends.
    const lead = escapeHtml((ach.lead || "").replace(/,\s*$/, ""));
    const impact = escapeHtml(ach.impact || "");
    return `    <li><b>${lead},</b> ${impact}</li>`;
  }).join("\n");
  return `<ul class="achievements">\n${items}\n  </ul>`;
}

/** Build the Markdown achievement list used by Markdown-first templates. */
function buildMarkdownAchievementsBlock(achievements) {
  if (!achievements || !achievements.length) return "";
  return achievements.map((ach) => {
    const lead = escapeHtml((ach.lead || "").replace(/,\s*$/, ""));
    const impact = escapeHtml(ach.impact || "");
    return `- **${lead},** ${impact}`;
  }).join("\n");
}

/** Build the optional footnotes block with escaped links. */
function buildFootnotesBlock(footnotes) {
  if (!footnotes || !footnotes.length) return "";
  const lines = footnotes.map(fn => {
    if (typeof fn === "object" && fn !== null) {
      const marker = escapeHtml(fn.marker || "");
      const text = escapeHtml(fn.text || "");
      const url = fn.url
        ? ` <a href="${escapeHtml(fn.url)}">${escapeHtml(fn.url)}</a>`
        : "";
      return `    <p>${marker} ${text}${url}</p>`;
    }
    return `    <p>${escapeHtml(fn)}</p>`;
  }).join("\n");
  return `<div class="footnotes">\n${lines}\n  </div>`;
}

/**
 * Build the optional sign-off block: a valediction over the signing name.
 *
 * Accepts either a plain string (used verbatim as the valediction) or an
 * object `{ valediction, name }`. `name` defaults to the candidate name so a
 * payload can set only the valediction. Returns "" when unset, which keeps
 * every pre-existing payload rendering byte-identical.
 */
function buildSignatureBlock(signature, candidateName) {
  if (!signature) return "";
  const isObject = typeof signature === "object" && signature !== null;
  const valediction = isObject ? signature.valediction : signature;
  const name = (isObject ? signature.name : "") || candidateName || "";
  if (!valediction && !name) return "";
  // Each value is escaped independently; the <br> separator is template markup
  // emitted between them, never injected into escaped content.
  const lines = [valediction, name].filter(Boolean).map(escapeHtml);
  return `<p class="signature">${lines.join("<br>")}</p>`;
}

function buildLongDangMarkdownContactLine(candidate) {
  const links = [];
  if (candidate.email) {
    const email = escapeHtml(candidate.email);
    links.push({ icon: 'tabler:mail', href: `mailto:${email}`, label: email });
  }
  if (candidate.phone) {
    const phone = escapeHtml(candidate.phone);
    links.push({ icon: 'tabler:phone', href: `tel:${phone.replace(/[^\d+]/g, '')}`, label: phone });
  }
  for (const [field, icon] of [['linkedin', 'tabler:brand-linkedin'], ['github', 'tabler:brand-github']]) {
    const link = profileLink(candidate[field]);
    const url = link.url;
    const display = link.display;
    if (!url || !display) continue;
    links.push({ icon, href: asUrl(url), label: display.replace(/^https?:\/\//i, '').replace(/\/+$/, '') });
  }
  return links.map((link, index) => {
    const separator = index === links.length - 1 ? ' no-separator' : '';
    return `<span class="resume-header-item${separator}"><span class="iconify" data-icon="${escapeHtml(link.icon)}"></span> <a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></span>`;
  }).join('\n');
}

function buildMarkdownAchievementsProseBlock(achievements) {
  if (!achievements || !achievements.length) return '';
  return achievements.map((achievement) => {
    const lead = escapeHtml((achievement.lead || '').replace(/,\s*$/, ''));
    const impact = escapeHtml(achievement.impact || '');
    return [lead && `${lead},`, impact].filter(Boolean).join(' ');
  }).filter(Boolean).join('\n\n');
}

function normalizeTimelineBlock(block) {
  if (block && typeof block === 'object') {
    return { title: block.title || '', text: block.text || block.body || '' };
  }
  return { title: '', text: block || '' };
}

function buildTimelineSection(kicker, block, { focus = false } = {}) {
  const normalized = normalizeTimelineBlock(block);
  const title = normalized.title ? `<p class="tl-title">${escapeHtml(normalized.title)}</p>` : '';
  const text = normalized.text ? `<p class="tl-text">${escapeHtml(normalized.text)}</p>` : '';
  const content = focus
    ? `<div class="tl-highlight">${title}${text}</div>`
    : `${title}${text}`;
  return `<section class="tl-item${focus ? ' tl-focus' : ''}">
<div class="tl-content">
<h2 class="tl-kicker">${escapeHtml(kicker)}</h2>
${content}
</div>
</section>`;
}

function buildReverseExperienceBlock(experience) {
  if (!experience || !experience.length) return '';
  const groups = experience.map((group) => {
    const title = escapeHtml(group.title || group.name || '');
    const bullets = Array.isArray(group.bullets)
      ? group.bullets
      : [group.text || group.impact].filter(Boolean);
    if (!title || !bullets.length) return '';
    const items = bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('\n');
    return `<div class="branch-node">
<h3 class="branch-title">${title}</h3>
<ul class="leaf-list">
${items}
</ul>
</div>`;
  }).filter(Boolean).join('\n\n');
  if (!groups) return '';
  return `<section class="tl-item">
<div class="tl-content">
<h2 class="tl-kicker">RELEVANT EXPERIENCE</h2>
<div class="branch-group">
${groups}
</div>
</div>
</section>`;
}

function buildReverseContributionBlock(contribution) {
  const normalized = normalizeTimelineBlock(contribution);
  const bullets = Array.isArray(contribution?.bullets) ? contribution.bullets : [];
  const title = normalized.title ? `<p class="tl-title">${escapeHtml(normalized.title)}</p>` : '';
  const list = bullets.length
    ? `<ul class="leaf-list contribution-list">\n${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('\n')}\n</ul>`
    : '';
  return `<section class="tl-item">
<div class="tl-content">
<h2 class="tl-kicker">WHAT I WOULD CONTRIBUTE</h2>
${title}
${list}
</div>
</section>`;
}

function validateTimelinePayload(source, letter) {
  if (!source.includes('{{ATTENTION_BLOCK}}')) return;
  for (const key of ['attention', 'challenge', 'perspective', 'contribution']) {
    if (!letter[key]) throw new Error(`Missing required field: letter.${key}`);
  }
  if (!Array.isArray(letter.experience)) {
    throw new Error('Missing required field: letter.experience');
  }
  for (const key of ['attention', 'challenge', 'perspective', 'contribution']) {
    const block = normalizeTimelineBlock(letter[key]);
    for (const field of ['title', 'text']) {
      if (/[!?]\s+[a-z]|\.\s+[a-z]{3,}/.test(block[field])) {
        throw new Error(`Invalid cover letter.${key}.${field}: sentence fragment after punctuation`);
      }
    }
  }
}

function evidenceItems(letter = {}) {
  return Array.isArray(letter.experience) ? letter.experience : (letter.achievements || []);
}

function validateEvidenceCount(achievements, hasEvidenceSlot = true) {
  if (!hasEvidenceSlot) return;
  const count = achievements?.length || 0;
  const rules = loadDocumentRules().coverLetter;
  if (count < rules.minEvidenceClaims || count > rules.maxEvidenceClaims) {
    throw new Error(`Cover letter requires ${rules.minEvidenceClaims}-${rules.maxEvidenceClaims} evidence blocks; received ${count}`);
  }
}

function coverLetterConstraints() {
  return loadDocumentRules().coverLetter;
}

function buildCoverBodyText(letter = {}) {
  const timelineBlocks = [letter.attention, letter.challenge, letter.perspective]
    .flatMap((block) => {
      const normalized = normalizeTimelineBlock(block);
      return [normalized.title, normalized.text];
    });
  const experienceText = (letter.experience || []).flatMap((group) => [
    group.title || group.name,
    ...(group.bullets || [group.text || group.impact]).filter(Boolean),
  ]);
  const contribution = normalizeTimelineBlock(letter.contribution);
  return [
    letter.opening,
    letter.profile_intro,
    letter.problems_section,
    ...timelineBlocks,
    ...experienceText,
    contribution.title,
    contribution.text,
    ...(letter.contribution?.bullets || []),
    ...(letter.achievements || []).flatMap(({ lead, impact }) => [lead, impact]),
    letter.closing,
    letter.language_closing,
  ].filter(Boolean).join('\n');
}

export function validateCoverConstraints(bodyText, achievements = [], configured = coverLetterConstraints()) {
  const words = countVisibleWords(bodyText);
  if (words < configured.minWords) {
    throw new Error(`Cover letter has ${words} body words; minimum is ${configured.minWords}`);
  }
  if (words > configured.maxWords) {
    throw new Error(`Cover letter has ${words} body words; maximum is ${configured.maxWords}`);
  }
  if (achievements.length < configured.minEvidenceClaims) {
    throw new Error(`Cover letter has ${achievements.length} evidence claims; minimum is ${configured.minEvidenceClaims}`);
  }
  if (achievements.length > configured.maxEvidenceClaims) {
    throw new Error(`Cover letter has ${achievements.length} evidence claims; maximum is ${configured.maxEvidenceClaims}`);
  }
  return { words, targetWords: configured.targetWords };
}

/** Build the Markdown sign-off used by Markdown-first templates. */
function buildMarkdownSignatureBlock(signature, candidateName) {
  if (!signature) return "";
  const isObject = typeof signature === "object" && signature !== null;
  const valediction = isObject ? signature.valediction : signature;
  const name = (isObject ? signature.name : "") || candidateName || "";
  const lines = [];
  if (valediction) lines.push(escapeHtml(valediction));
  if (name) lines.push(`**${escapeHtml(name)}**`);
  return lines.join("\n");
}

function buildMarkdownHtmlSignatureBlock(signature, candidateName) {
  if (!signature) return "";
  const isObject = typeof signature === "object" && signature !== null;
  const valediction = isObject ? signature.valediction : signature;
  const name = (isObject ? signature.name : "") || candidateName || "";
  const lines = [];
  if (valediction) lines.push(escapeHtml(valediction));
  if (name) lines.push(`<strong>${escapeHtml(name)}</strong>`);
  return `<p class="signature">${lines.join("<br>")}</p>`;
}

// Resolve the cover-letter template through the shared resolver so a
// `cover_letter.template` profile default, an explicit `payload.template`, and
// installed template packs are all honored. Resolver failures stay visible so a
// configured template cannot silently be replaced by another presentation.
export function resolveCoverTemplatePath(payload = {}, opts = {}) {
  const format = opts.format || "html";
  return resolveTemplate("cover", payload.template, { format, ...opts, fallback: false });
}

function buildReplacements(payload) {
  _require(payload, ["candidate", "letter"], "payload");
  const candidate = payload.candidate;
  const letter = payload.letter;
  _require(candidate, ["name"], "candidate");
  _require(letter, ["role_title", "opening", "profile_intro"], "letter");

  // Optional salutation (e.g. "Dear Jane Smith,"). Omitted -> no salutation,
  // preserving the original behavior for payloads that don't set it.
  const greetingBlock = letter.greeting ? `<p class="greeting">${escapeHtml(letter.greeting)}</p>` : "";
  const closingBlock = letter.closing ? `<p>${escapeHtml(letter.closing)}</p>` : "";
  const languageClosingBlock = letter.language_closing
    ? `<p class="language-closing">${escapeHtml(letter.language_closing)}</p>`
    : "";
  const problemsBlock = letter.problems_section ? `<p>${escapeHtml(letter.problems_section)}</p>` : "";

  // Optional sign-off (e.g. valediction "Sincerely," over the signing name).
  // Omitted -> no signature, preserving behavior for payloads that don't set it.
  // The name falls back to the candidate name so a payload can set only the
  // valediction. The <br> is emitted around escaped values, never inside one.
  const signatureBlock = buildSignatureBlock(letter.signature, candidate.name);

  const replacements = {
    "{{NAME}}": escapeHtml(candidate.name),
    "{{SUBTITLE}}": escapeHtml(candidate.subtitle || ""),
    "{{QUOTE}}": escapeHtml(candidate.quote || ""),
    "{{CONTACT_LINE}}": buildContactLine(candidate),
    "{{CONTACT_LINE_ICON}}": buildLongDangMarkdownContactLine(candidate),
    "{{CREDENTIALS_BLOCK}}": buildCredentialsBlock(candidate),
    "{{RECIPIENT_TEAM}}": escapeHtml(letter.recipient_team || "Recruitment Team"),
    "{{COMPANY}}": escapeHtml(letter.company || ""),
    "{{COMPANY_SHORT_NAME}}": escapeHtml(letter.company_short_name || letter.company || ""),
    "{{ROLE_TITLE}}": escapeHtml(letter.role_title),
    "{{DATELINE}}": buildDateline(letter),
    "{{GREETING_BLOCK}}": greetingBlock,
    "{{OPENING}}": escapeHtml(letter.opening),
    "{{PROFILE_INTRO}}": escapeHtml(letter.profile_intro),
    "{{ACHIEVEMENTS_BLOCK}}": buildAchievementsBlock(letter.achievements),
    "{{ACHIEVEMENTS_PROSE_BLOCK}}": buildMarkdownAchievementsProseBlock(letter.achievements),
    "{{ATTENTION_BLOCK}}": buildTimelineSection("WHAT CAUGHT MY ATTENTION", letter.attention),
    "{{CHALLENGE_BLOCK}}": buildTimelineSection("THE CHALLENGE", letter.challenge),
    "{{PERSPECTIVE_BLOCK}}": buildTimelineSection("MY PERSPECTIVE", letter.perspective, { focus: true }),
    "{{RELEVANT_EXPERIENCE_BLOCK}}": buildReverseExperienceBlock(letter.experience),
    "{{CONTRIBUTION_BLOCK}}": buildReverseContributionBlock(letter.contribution),
    "{{PROBLEMS_BLOCK}}": problemsBlock,
    "{{CLOSING_BLOCK}}": closingBlock,
    "{{LANGUAGE_CLOSING_BLOCK}}": languageClosingBlock,
    "{{SIGNATURE_BLOCK}}": signatureBlock,
    "{{SIGNATURE_HTML_BLOCK}}": buildMarkdownHtmlSignatureBlock(letter.signature, candidate.name),
    "{{FOOTNOTES_BLOCK}}": buildFootnotesBlock(letter.footnotes),
  };

  return replacements;
}

function renderTemplate(source, replacements) {

  // Single-pass substitution: each {{TOKEN}} is replaced exactly once against
  // the original template. A single regex pass (rather than iterative
  // split/join) ensures a substituted value that itself contains a {{TOKEN}}
  // sequence is left literal instead of being re-interpreted as a placeholder.
  //
  // A token with no entry in the map is a template the renderer cannot fill —
  // a custom cover-letter template (KINDS.cover in cv-templates.mjs) carrying a
  // typo'd or unsupported token. Collect those DURING the pass rather than
  // scanning the result: a scan of the output cannot tell a template token from
  // the same sequence appearing inside a substituted value, which is exactly
  // what the single pass above is careful to leave literal.
  const unresolved = new Set();
  const rendered = source.replace(/\{\{[A-Z_]+\}\}/g, (token) => {
    const value = replacements[token];
    if (value == null) {
      unresolved.add(token);
      return token;
    }
    return value;
  });

  // Fail loudly, matching build-cv-html.mjs and build-cv-latex.mjs. Shipping a
  // letter with a literal {{TOKEN}} in it is worse than not producing one.
  if (unresolved.size) {
    throw new Error(`Unresolved placeholders: ${[...unresolved].join(', ')}`);
  }
  return rendered;
}

export function buildHtml(payload, templatePath, { requireTailoring = false } = {}) {
  const resolvedPath = templatePath || resolveCoverTemplatePath(payload);
  const contract = getTemplateContract(resolvedPath);
  const source = readFileSync(resolvedPath, "utf-8");
  validatePayloadLimits('cover_letter', payload, loadDocumentRules());
  validateTimelinePayload(source, payload.letter);
  const hasEvidenceSlot = source.includes('{{ACHIEVEMENTS_BLOCK}}') || source.includes('{{ACHIEVEMENTS_PROSE_BLOCK}}');
  validateEvidenceCount(evidenceItems(payload.letter), hasEvidenceSlot || source.includes('{{RELEVANT_EXPERIENCE_BLOCK}}'));
  const html = renderTemplate(source, buildReplacements(payload));
  validateTailoringMetadata('cover_letter', payload, html, { required: requireTailoring });
  return html;
}

export function buildMarkdown(payload, templatePath, { requireTailoring = false } = {}) {
  const resolvedPath = templatePath || resolveCoverTemplatePath(payload, { format: "md" });
  const source = readFileSync(resolvedPath, "utf-8");
  const contract = getTemplateContract(resolvedPath);
  validatePayloadLimits('cover_letter', payload, loadDocumentRules());
  validateTimelinePayload(source, payload.letter);
  const evidenceToken = contract.evidenceStyle === 'prose'
    ? '{{ACHIEVEMENTS_PROSE_BLOCK}}'
    : '{{ACHIEVEMENTS_BLOCK}}';
  const hasEvidenceSlot = source.includes('{{ACHIEVEMENTS_BLOCK}}') || source.includes('{{ACHIEVEMENTS_PROSE_BLOCK}}') || source.includes('{{RELEVANT_EXPERIENCE_BLOCK}}');
  const selectedEvidenceToken = contract.evidenceSlot === 'experience'
    ? '{{RELEVANT_EXPERIENCE_BLOCK}}'
    : evidenceToken;
  if (hasEvidenceSlot && !source.includes(selectedEvidenceToken)) {
    throw new Error(`Cover template evidence_style=${contract.evidenceStyle} requires ${selectedEvidenceToken}`);
  }
  validateEvidenceCount(evidenceItems(payload.letter), hasEvidenceSlot);
  const replacements = buildReplacements(payload);
  replacements["{{GREETING_BLOCK}}"] = escapeHtml(payload.letter.greeting || "");
  replacements["{{ACHIEVEMENTS_BLOCK}}"] = buildMarkdownAchievementsBlock(payload.letter.achievements);
  replacements["{{PROBLEMS_BLOCK}}"] = escapeHtml(payload.letter.problems_section || "");
  replacements["{{CLOSING_BLOCK}}"] = escapeHtml(payload.letter.closing || "");
  replacements["{{LANGUAGE_CLOSING_BLOCK}}"] = escapeHtml(payload.letter.language_closing || "");
  replacements["{{SIGNATURE_BLOCK}}"] = buildMarkdownSignatureBlock(payload.letter.signature, payload.candidate.name);
  const markdown = renderTemplate(readFileSync(resolvedPath, "utf-8"), replacements);
  validateTailoringMetadata('cover_letter', payload, markdown, { required: requireTailoring });
  return markdown;
}

/** Parse a payload, run the fact gate, and write Markdown or render PDF. */
async function main() {
  const { values: args } = parseArgs({
    options: {
      payload: { type: "string" },
      out:     { type: "string" },
      format:  { type: "string" },
      markdown:{ type: "boolean" },
      tailored:{ type: "boolean" },
      report:  { type: "string" },
      help:    { type: "boolean", short: "h" },
    },
    strict: false,
  });

  if (args.help || !args.payload) {
    console.log(`
Usage:
  node generate-cover-letter.mjs --payload payload.json [--out output/path.pdf] [--format letter|a4] [--report NNN]
  node generate-cover-letter.mjs --payload payload.json --markdown [--out output/path.md]

  --payload   Path to the JSON payload file (required)
  --out       Override output path from payload (optional)
  --format    Override output PDF page format (letter|a4, default: a4)
  --markdown  Write the approved Markdown artifact instead of rendering PDF
  --tailored  Require tailoring metadata and JD keyword coverage
  --report    Link the PDF to a tracker report number in data/pdf-index.tsv
`);
    process.exit(args.help ? 0 : 1);
  }

  const payloadPath = resolve(args.payload);
  if (!existsSync(payloadPath)) {
    console.error(`ERROR: payload file not found: ${payloadPath}`);
    process.exit(1);
  }

  const payload = JSON.parse(readFileSync(payloadPath, "utf-8"));
  const markdown = Boolean(args.markdown);

  if (args.out) {
    payload.output_path = args.out;
  }

  if (!payload.output_path) {
    const company = (payload.letter?.company || "company").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const role    = (payload.letter?.role_title || "role").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    payload.output_path = join(OUTPUT_ROOT, `${company}-${role}-cover.${markdown ? "md" : "pdf"}`);
  } else {
    try {
      payload.output_path = safeOutputPath(payload.output_path);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  if (!existsSync(OUTPUT_ROOT)) mkdirSync(OUTPUT_ROOT, { recursive: true });

  try {
    const rules = loadDocumentRules();
    const artifact = markdown
      ? buildMarkdown(payload, undefined, { requireTailoring: args.tailored })
      : buildHtml(payload, undefined, { requireTailoring: args.tailored });
    validateRenderedWordCount("cover_letter", artifact, rules, markdown ? "md" : "html");
    // Cover letters are candidate-facing documents too. Reuse the CV fact
    // validator before importing Playwright or writing a PDF so a failed gate
    // cannot leave behind a misleading artifact.
    const factCheck = assertFacts(artifact, { label: "cover letter" });
    // Ahead of the verdict, because it qualifies it: with no config the phrase
    // lists are empty, so a silent gate here covers metrics and facts only.
    if (factCheck.configMissing) {
      console.error("No config/cv-facts.json — forbidden/advisory phrase checks did not run.");
    }
    if (factCheck.verdict === "warn") {
      console.error(`CV fact check warning: cover letter`);
      for (const phrase of factCheck.warnings) {
        console.error(`  - advisory phrase: ${phrase}`);
      }
    }
    if (markdown) {
      writeFileSync(payload.output_path, artifact, "utf-8");
      console.log(`\\nCover letter Markdown: ${payload.output_path}`);
      return;
    }
    // Imported only after fact validation so a failed gate does not load
    // Playwright or create a PDF artifact.
    const { renderHtmlToPdf } = await import("./generate-pdf.mjs");
    const outputPath = resolve(payload.output_path);
    await renderHtmlToPdf(artifact, outputPath, {
      format: args.format || "a4",
      reportNum: args.report,
      inputPath: payloadPath,
    });
    console.log(`\nCover letter PDF: ${payload.output_path}`);
  } catch (err) {
    console.error(`ERROR generating cover letter ${markdown ? "Markdown" : "PDF"}:`);
    console.error(err.message);
    process.exit(1);
  }
}

const isMain = isMainModule(import.meta.url);
if (isMain) main();
