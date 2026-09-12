import { loadProfileConfig } from '../cv-templates.mjs';

function integer(value, path) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${path} must be a positive integer`);
  }
  return value;
}

function range(source, minPath, maxPath) {
  const min = integer(source?.min, minPath);
  const max = integer(source?.max, maxPath);
  if (max < min) throw new Error(`${maxPath} must be greater than or equal to ${minPath}`);
  return { min, max };
}

function bounded(source, prefix) {
  const minWords = integer(source?.min_words, `${prefix}.min_words`);
  const maxWords = integer(source?.max_words, `${prefix}.max_words`);
  if (maxWords < minWords) throw new Error(`${prefix}.max_words must be greater than or equal to ${prefix}.min_words`);
  return { minWords, maxWords };
}

export function validateDocumentRules(profile) {
  const cv = profile?.cv?.constraints;
  const cover = profile?.cover_letter?.constraints;
  const audit = profile?.cv?.llm_audit;
  if (profile?.cover_letter?.llm_audit !== undefined) {
    throw new Error('cover_letter.llm_audit is not allowed; use cv.llm_audit');
  }

  const cvWords = bounded(cv, 'cv.constraints');
  const coverWords = bounded(cover, 'cover_letter.constraints');
  const bulletsPerEntry = range(cv?.bullets_per_entry, 'cv.constraints.bullets_per_entry.min', 'cv.constraints.bullets_per_entry.max');
  const maxProjects = integer(cv?.max_projects, 'cv.constraints.max_projects');
  const maxCertifications = integer(cv?.max_certifications, 'cv.constraints.max_certifications');
  const targetWords = integer(cover?.target_words, 'cover_letter.constraints.target_words');
  if (targetWords < coverWords.minWords || targetWords > coverWords.maxWords) {
    throw new Error('cover_letter.constraints.target_words must be within cover_letter.constraints.min_words and cover_letter.constraints.max_words');
  }
  const minEvidenceClaims = integer(cover?.min_evidence_claims, 'cover_letter.constraints.min_evidence_claims');
  const maxEvidenceClaims = integer(cover?.max_evidence_claims, 'cover_letter.constraints.max_evidence_claims');
  if (maxEvidenceClaims < minEvidenceClaims) {
    throw new Error('cover_letter.constraints.max_evidence_claims must be greater than or equal to cover_letter.constraints.min_evidence_claims');
  }
  if (typeof audit?.enabled !== 'boolean') throw new Error('cv.llm_audit.enabled must be a boolean');
  const maxCycles = integer(audit?.max_cycles, 'cv.llm_audit.max_cycles');
  if (maxCycles > 2) throw new Error('cv.llm_audit.max_cycles cannot exceed 2');

  return {
    cv: { ...cvWords, maxProjects, maxCertifications, bulletsPerEntry },
    coverLetter: { ...coverWords, targetWords, minEvidenceClaims, maxEvidenceClaims },
    llmAudit: { enabled: audit.enabled, maxCycles },
  };
}

export function loadDocumentRules({ profilePath } = {}) {
  return validateDocumentRules(loadProfileConfig({ profilePath }));
}

function evidenceItems(letter = {}) {
  return Array.isArray(letter.experience) ? letter.experience : (letter.achievements || []);
}

function assertCardinality(entries, max, path, label) {
  if (Array.isArray(entries) && entries.length > max) {
    throw new Error(`${path}: maximum ${max} ${label}; received ${entries.length}`);
  }
}

function assertBullets(entries, bounds, section) {
  if (!Array.isArray(entries)) return;
  entries.forEach((entry, index) => {
    const bullets = entry?.bullets;
    if (!Array.isArray(bullets) || bullets.length < bounds.min || bullets.length > bounds.max) {
      const count = Array.isArray(bullets) ? bullets.length : 0;
      throw new Error(`${section}[${index}].bullets: expected ${bounds.min}-${bounds.max}; received ${count}`);
    }
  });
}

function normalized(value) {
  return String(value ?? '').trim().toLowerCase();
}

function assertTailoringList(actual, expected, path) {
  if (!Array.isArray(actual) || actual.length !== expected.length
    || actual.some((value, index) => normalized(value) !== normalized(expected[index]))) {
    throw new Error(`${path}: must record rendered entries in rendered order`);
  }
}

export function validateTailoringMetadata(kind, payload, renderedText = '', { required = false } = {}) {
  const tailoring = payload?.tailoring;
  if (tailoring === undefined) {
    if (required) throw new Error('tailoring: required for tailored rendering');
    return;
  }
  if (!tailoring || typeof tailoring !== 'object' || Array.isArray(tailoring)) {
    throw new Error('tailoring: expected an object');
  }
  const keywords = tailoring.jd_keywords;
  if (!Array.isArray(keywords) || keywords.length === 0 || keywords.some((keyword) => !normalized(keyword))) {
    throw new Error('tailoring.jd_keywords: expected a non-empty list of text');
  }
  const visible = normalized(renderedText);
  const missing = keywords.filter((keyword) => !visible.includes(normalized(keyword)));
  if (missing.length) throw new Error(`tailoring.jd_keywords: missing from rendered ${missing.join(', ')}`);

  if (kind === 'cv') {
    assertTailoringList(tailoring.selected_project_names, (payload.projects || []).map((entry) => entry?.name), 'tailoring.selected_project_names');
    assertTailoringList(tailoring.selected_experience_roles, (payload.experience || []).map((entry) => entry?.role), 'tailoring.selected_experience_roles');
    return;
  }
  if (kind === 'cover_letter') {
    const evidence = evidenceItems(payload.letter);
    assertTailoringList(tailoring.selected_evidence_titles, evidence.map((entry) => entry?.title || entry?.lead), 'tailoring.selected_evidence_titles');
    return;
  }
  throw new Error(`Unknown document kind: ${kind}`);
}

export function validatePayloadLimits(kind, payload, rules = loadDocumentRules()) {
  if (kind === 'cv') {
    assertCardinality(payload?.projects, rules.cv.maxProjects, 'projects', 'projects');
    assertCardinality(payload?.certifications, rules.cv.maxCertifications, 'certifications', 'certifications');
    assertBullets(payload?.experience, rules.cv.bulletsPerEntry, 'experience');
    assertBullets(payload?.projects, rules.cv.bulletsPerEntry, 'projects');
    return;
  }
  if (kind === 'cover_letter') {
    const evidence = evidenceItems(payload?.letter);
    if (evidence.length < rules.coverLetter.minEvidenceClaims || evidence.length > rules.coverLetter.maxEvidenceClaims) {
      throw new Error(`Cover letter evidence requires ${rules.coverLetter.minEvidenceClaims}-${rules.coverLetter.maxEvidenceClaims} evidence blocks; received ${evidence.length}`);
    }
    return;
  }
  throw new Error(`Unknown document kind: ${kind}`);
}

export function countVisibleWords(text, format = 'md') {
  let source = String(text ?? '');
  if (format === 'tex') {
    source = source.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/)?.[1] || source;
    source = source.replace(/%[^\r\n]*/g, ' ');
  }
  const visible = source
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\\href(?:\[[^\]]*\])?\{[^{}]*\}\{([^{}]*)\}/g, '$1')
    .replace(/\\url\{[^{}]*\}/g, ' ')
    .replace(/\\[a-zA-Z]+(?:\[[^\]]*\])?/g, ' ')
    .replace(/[{}*_~`]/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/gi, ' ');
  return visible.trim().split(/\s+/).filter(Boolean).length;
}

export function validateRenderedWordCount(kind, text, rules = loadDocumentRules(), format = 'md') {
  const configured = kind === 'cv' ? rules.cv : kind === 'cover_letter' ? rules.coverLetter : null;
  if (!configured) throw new Error(`Unknown document kind: ${kind}`);
  const words = countVisibleWords(text, format);
  if (words < configured.minWords) throw new Error(`${kind} has ${words} visible words; minimum is ${configured.minWords}`);
  if (words > configured.maxWords) throw new Error(`${kind} has ${words} visible words; maximum is ${configured.maxWords}`);
  return { words, targetWords: configured.targetWords || 0 };
}
