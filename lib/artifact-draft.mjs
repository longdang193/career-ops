/**
 * Provider-neutral content contract consumed before any template renderer.
 *
 * Providers may return tailored content only. The application owns facts,
 * template selection, and output format; layout-bearing provider fields are
 * rejected at this boundary.
 */

import { validatePayload, hasText } from './cv-payload-schema.mjs';

export const ARTIFACT_TYPES = Object.freeze(['cv', 'cover_letter']);
export const RENDER_FORMATS = Object.freeze(['text', 'html', 'pdf']);

const ENVELOPE_KEYS = new Set([
  'artifact_type',
  'target_job_context',
  'candidate_facts',
  'tailored_content',
  'selected_template',
  'render_format',
]);

const LAYOUT_KEYS = new Set([
  'css',
  'html',
  'layout',
  'markup',
  'page_breaks',
  'style',
  'styles',
  'template',
  'template_html',
]);

const CV_CONTENT_KEYS = new Set([
  'candidate',
  'summary',
  'competencies',
  'experience',
  'projects',
  'education',
  'certifications',
  'awards',
  'interests',
  'skills',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function addRequiredError(errors, object, key, path) {
  if (!isRecord(object) || !hasText(object[key])) {
    errors.push(`${path}.${key}: required non-blank string`);
  }
}

function inspectLayoutKeys(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectLayoutKeys(entry, `${path}[${index}]`, errors));
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (LAYOUT_KEYS.has(key.toLowerCase())) {
      errors.push(`${path}.${key}: provider layout field is not allowed`);
    }
    inspectLayoutKeys(child, `${path}.${key}`, errors);
  }
}

function validateCoverContent(content, errors) {
  if (!isRecord(content)) {
    errors.push('tailored_content: expected an object for cover_letter');
    return;
  }

  const candidate = content.candidate;
  const letter = content.letter;
  if (!isRecord(candidate)) errors.push('tailored_content.candidate: expected an object');
  if (!isRecord(letter)) errors.push('tailored_content.letter: expected an object');
  addRequiredError(errors, candidate, 'name', 'tailored_content.candidate');
  for (const key of ['role_title', 'opening', 'profile_intro']) {
    addRequiredError(errors, letter, key, 'tailored_content.letter');
  }

  if (candidate?.credentials !== undefined) {
    if (!Array.isArray(candidate.credentials) || !candidate.credentials.every(hasText)) {
      errors.push('tailored_content.candidate.credentials: expected an array of non-blank strings');
    }
  }

  if (letter?.achievements !== undefined) {
    if (!Array.isArray(letter.achievements)) {
      errors.push('tailored_content.letter.achievements: expected an array');
    } else {
      letter.achievements.forEach((achievement, index) => {
        if (!isRecord(achievement)) {
          errors.push(`tailored_content.letter.achievements[${index}]: expected an object`);
          return;
        }
        addRequiredError(errors, achievement, 'lead', `tailored_content.letter.achievements[${index}]`);
        addRequiredError(errors, achievement, 'impact', `tailored_content.letter.achievements[${index}]`);
      });
    }
  }

  if (letter?.footnotes !== undefined && !Array.isArray(letter.footnotes)) {
    errors.push('tailored_content.letter.footnotes: expected an array');
  }
}

function validateCvContent(content, errors, warnings) {
  if (!isRecord(content)) {
    errors.push('tailored_content: expected an object for cv');
    return;
  }
  if (!Object.keys(content).some(key => CV_CONTENT_KEYS.has(key))) {
    errors.push('tailored_content: expected at least one CV content field');
  }
  const result = validatePayload(content, 'html');
  errors.push(...result.errors.map(error => `tailored_content.${error}`));
  warnings.push(...result.warnings.map(warning => `tailored_content.${warning}`));
}

/**
 * Validate one shared CV/cover-letter draft envelope.
 *
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
export function validateArtifactDraft(draft) {
  const errors = [];
  const warnings = [];

  if (!isRecord(draft)) {
    return {
      valid: false,
      errors: ['draft: expected an object'],
      warnings,
    };
  }

  for (const key of Object.keys(draft)) {
    if (!ENVELOPE_KEYS.has(key)) errors.push(`${key}: unknown draft field`);
  }

  if (!ARTIFACT_TYPES.includes(draft.artifact_type)) {
    errors.push(`artifact_type: expected one of ${ARTIFACT_TYPES.join(', ')}`);
  }
  if (!isRecord(draft.target_job_context)) {
    errors.push('target_job_context: expected an object');
  }
  if (!isRecord(draft.candidate_facts)) {
    errors.push('candidate_facts: expected an object');
  }
  if (!isRecord(draft.tailored_content)) {
    errors.push('tailored_content: expected an object');
  }
  if (!hasText(draft.selected_template)) {
    errors.push('selected_template: required non-blank string');
  }
  if (!RENDER_FORMATS.includes(draft.render_format)) {
    errors.push(`render_format: expected one of ${RENDER_FORMATS.join(', ')}`);
  }

  inspectLayoutKeys(draft.tailored_content, 'tailored_content', errors);

  if (draft.artifact_type === 'cv') validateCvContent(draft.tailored_content, errors, warnings);
  if (draft.artifact_type === 'cover_letter') validateCoverContent(draft.tailored_content, errors);

  return { valid: errors.length === 0, errors, warnings };
}

/** Validate and return draft, throwing before any renderer can run. */
export function assertArtifactDraft(draft) {
  const result = validateArtifactDraft(draft);
  if (!result.valid) throw new Error(`Invalid artifact draft:\n- ${result.errors.join('\n- ')}`);
  return draft;
}
