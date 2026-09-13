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

function presentation(source) {
  if (source === undefined) return undefined;
  const educationLocation = source?.education_location || 'preserve';
  if (!['preserve', 'country_only'].includes(educationLocation)) {
    throw new Error('cv.presentation.education_location must be preserve or country_only');
  }

  const focus = source?.certificate_focus;
  const focusMin = integer(focus?.min_items, 'cv.presentation.certificate_focus.min_items');
  const focusMax = integer(focus?.max_items, 'cv.presentation.certificate_focus.max_items');
  if (focusMax < focusMin) throw new Error('cv.presentation.certificate_focus.max_items must be greater than or equal to cv.presentation.certificate_focus.min_items');

  const projectContext = source?.project_context;
  const projectMax = integer(projectContext?.max_items, 'cv.presentation.project_context.max_items');

  const skills = source?.skills;
  if (!Array.isArray(skills?.required_categories) || skills.required_categories.length === 0
    || skills.required_categories.some((category) => typeof category !== 'string' || !category.trim())) {
    throw new Error('cv.presentation.skills.required_categories must be a non-empty list of text');
  }
  if (new Set(skills.required_categories.map((category) => normalized(category))).size !== skills.required_categories.length) {
    throw new Error('cv.presentation.skills.required_categories must not contain duplicates');
  }
  if (typeof skills.no_cross_category_overlap !== 'boolean') {
    throw new Error('cv.presentation.skills.no_cross_category_overlap must be a boolean');
  }
  const skillMaxItems = integer(skills.max_items, 'cv.presentation.skills.max_items');

  return {
    educationLocation,
    certificateFocus: { minItems: focusMin, maxItems: focusMax },
    projectContext: { maxItems: projectMax },
    skills: {
      requiredCategories: skills.required_categories.map((category) => category.trim()),
      maxItems: skillMaxItems,
      noCrossCategoryOverlap: skills.no_cross_category_overlap,
    },
  };
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
    cv: {
      ...cvWords,
      maxProjects,
      maxCertifications,
      bulletsPerEntry,
      ...(profile?.cv?.presentation === undefined ? {} : { presentation: presentation(profile.cv.presentation) }),
    },
    coverLetter: { ...coverWords, targetWords, minEvidenceClaims, maxEvidenceClaims },
    llmAudit: { enabled: audit.enabled, maxCycles },
  };
}

function listItems(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  if (typeof value === 'string') return value.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function assertTextList(value, path) {
  if (value !== undefined && value !== null && value !== '' && !Array.isArray(value) && typeof value !== 'string') {
    throw new Error(`${path}: expected text items`);
  }
  if (Array.isArray(value) && value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${path}: expected text items`);
  }
}

function categoryKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[\/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatEducationLocation(value, rules = loadDocumentRules()) {
  const location = String(value ?? '').trim();
  if (!location || rules?.cv?.presentation?.educationLocation !== 'country_only') return location;
  return location.split(',').map((part) => part.trim()).filter(Boolean).at(-1) || location;
}

export function formatEducationInstitution(value, location, rules = loadDocumentRules()) {
  const institution = String(value ?? '').trim();
  if (!institution || rules?.cv?.presentation?.educationLocation !== 'country_only') return institution;
  const city = String(location ?? '').split(',')[0].trim();
  if (!city) return institution;
  const suffix = new RegExp(`\\s${city.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i');
  return institution.replace(suffix, '').trim();
}

export function formatCvList(value) {
  return listItems(value).join(', ');
}

export function formatSkillItems(value) {
  const items = listItems(value);
  const rendered = items.join(', ');
  return rendered ? rendered.charAt(0).toLowerCase() + rendered.slice(1) : '';
}

export function validateCvPresentation(payload, format, rules = loadDocumentRules()) {
  const policy = rules?.cv?.presentation;
  if (!policy) return;

  const certifications = Array.isArray(payload?.certifications) ? payload.certifications : [];
  if (format === 'md') {
    certifications.forEach((entry, index) => {
      assertTextList(entry?.focus, `certifications[${index}].focus`);
      const items = listItems(entry?.focus);
      if (items.length < policy.certificateFocus.minItems || items.length > policy.certificateFocus.maxItems) {
        throw new Error(`certifications[${index}].focus: expected ${policy.certificateFocus.minItems}-${policy.certificateFocus.maxItems}; received ${items.length}`);
      }
    });
  }

  const projects = Array.isArray(payload?.projects) ? payload.projects : [];
  const projectField = format === 'html' ? 'tech' : 'context';
  projects.forEach((entry, index) => {
    const value = entry?.[projectField];
    if (value === undefined || value === null || value === '') return;
    assertTextList(value, `projects[${index}].${projectField}`);
    const items = listItems(value);
    if (items.length > policy.projectContext.maxItems) {
      throw new Error(`projects[${index}].${projectField}: maximum ${policy.projectContext.maxItems}; received ${items.length}`);
    }
  });

  const skills = Array.isArray(payload?.skills) ? payload.skills : [];
  const categories = new Map();
  for (const [index, entry] of skills.entries()) {
    assertTextList(entry?.items, `skills[${index}].items`);
    const items = listItems(entry?.items);
    if (items.length > policy.skills.maxItems) {
      throw new Error(`skills[${index}].items: maximum ${policy.skills.maxItems}; received ${items.length}`);
    }
    const key = categoryKey(entry?.category);
    if (key) {
      if (categories.has(key)) throw new Error(`skills: duplicate category: ${key}`);
      categories.set(key, entry);
    }
  }
  const missing = policy.skills.requiredCategories
    .filter((category) => !categories.has(categoryKey(category)));
  if (missing.length) throw new Error(`skills: missing required categories: ${missing.join(', ')}`);

  if (policy.skills.noCrossCategoryOverlap) {
    const owners = new Map();
    for (const [category, entry] of categories) {
      for (const item of listItems(entry?.items)) {
        const key = normalized(item);
        const previous = owners.get(key);
        if (previous && previous !== category) {
          throw new Error(`skills: item appears in multiple categories: ${key}`);
        }
        owners.set(key, category);
      }
    }
  }
}

export function loadDocumentRules({ profilePath } = {}) {
  return validateDocumentRules(loadProfileConfig({ profilePath }));
}

function evidenceItems(letter = {}) {
  return Array.isArray(letter.experience) && letter.experience.length
    ? letter.experience
    : (letter.achievements || []);
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
    let withoutComments = '';
    let backslashes = 0;
    for (const character of source) {
      if (character === '\\') {
        withoutComments += character;
        backslashes++;
        continue;
      }
      if (character === '%' && backslashes % 2 === 0) {
        withoutComments += ' ';
        backslashes = 0;
        continue;
      }
      withoutComments += character;
      backslashes = 0;
    }
    source = withoutComments;
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
