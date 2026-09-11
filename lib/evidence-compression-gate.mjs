const MAX_BULLETS = 4;
const REVIEW_BULLET_WORDS = 24;
const HARD_BULLET_WORDS = 36;
const REVIEW_DESCRIPTION_WORDS = 32;
const MAX_SUMMARY_WORDS = 60;
const MIN_CERTIFICATIONS = 2;
const MAX_CERTIFICATIONS = 5;
import { MAX_CERTIFICATE_FOCUS, MIN_CERTIFICATE_FOCUS } from './cv-payload-schema.mjs';

const MAX_PROJECTS = 3;
const MAX_EDUCATION_SUBJECTS = 5;
const MIN_CV_WORDS = 500;
const MAX_CV_WORDS = 650;

const EVIDENCE_RE = /\b(?:data|sales|customer|market|campaign|product|pipeline|model|report|analysis|research|metric|stakeholder|portfolio|SQL|Python|Excel|Power BI|BigQuery|Azure|GitHub|Buzzmetrics|Google Brand Lift|Decisions Lab)\b|\d|%/i;
const OUTCOME_RE = /\b(?:to|for|support\w*|enable\w*|improv\w*|reduc\w*|increas\w*|deliver\w*|produc\w*|creat\w*|build\w*|launch\w*|expand\w*|rank\w*|result\w*|achiev\w*|strengthen\w*)\b/i;
const WEAK_ACTION_RE = /^(?:responsible|worked|helped|assisted|participated|involved)\b/i;

function words(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

function normalized(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function addWords(values, value) {
  if (typeof value === 'string' && value.trim()) values.push(value);
}

function countCvWords(content) {
  const values = [];
  const candidate = content?.candidate;
  for (const key of ['name', 'subtitle', 'email', 'phone', 'location']) addWords(values, candidate?.[key]);
  for (const key of ['linkedin', 'github']) addWords(values, candidate?.[key]?.display);
  addWords(values, content?.summary);

  if (Array.isArray(content?.competencies)) content.competencies.forEach(value => addWords(values, value));
  const sections = {
    experience: ['company', 'role', 'location', 'dates', 'period', 'description', 'bullets'],
    projects: ['name', 'badge', 'description', 'tech', 'methodology', 'domain', 'dates', 'period', 'bullets'],
    education: ['title', 'org', 'location', 'year', 'description', 'coursework', 'subjects', 'gpa'],
    certifications: ['title', 'org', 'year', 'focus', 'description'],
    awards: ['title', 'org', 'year'],
  };
  for (const [section, keys] of Object.entries(sections)) {
    if (!Array.isArray(content?.[section])) continue;
    for (const entry of content[section]) {
      for (const key of keys) {
        if (Array.isArray(entry?.[key])) entry[key].forEach(value => addWords(values, value));
        else addWords(values, entry?.[key]);
      }
    }
  }
  if (Array.isArray(content?.interests)) content.interests.forEach(value => addWords(values, value));
  if (Array.isArray(content?.skills)) {
    for (const entry of content.skills) {
      addWords(values, entry?.category);
      if (Array.isArray(entry?.items)) entry.items.forEach(value => addWords(values, value));
    }
  }
  return words(values.join(' ')).length;
}

function educationSubjects(entry) {
  const value = entry?.coursework ?? entry?.subjects;
  if (Array.isArray(value)) return value.filter(value => String(value || '').trim());
  return String(value || '').split(/\s*;\s*|\r?\n/).map(value => value.trim()).filter(Boolean);
}

function addBulletFindings(report, text, path) {
  const value = String(text || '').trim();
  if (!value) {
    report.hardErrors.push(`${path}: empty bullet`);
    return;
  }

  const count = words(value).length;
  if (count > HARD_BULLET_WORDS) {
    report.hardErrors.push(`${path}: ${count} words exceeds hard limit ${HARD_BULLET_WORDS}`);
  } else if (count > REVIEW_BULLET_WORDS) {
    report.reviewFindings.push(`${path}: ${count} words; compress toward ${REVIEW_BULLET_WORDS} words`);
  }

  if (WEAK_ACTION_RE.test(value)) report.reviewFindings.push(`${path}: weak action opening`);
  if (!EVIDENCE_RE.test(value)) report.reviewFindings.push(`${path}: no concrete evidence signal`);
  if (!OUTCOME_RE.test(value)) report.reviewFindings.push(`${path}: no outcome signal`);
}

function addEntryBullets(report, entries, section) {
  if (!Array.isArray(entries)) return;
  entries.forEach((entry, index) => {
    const bullets = Array.isArray(entry?.bullets) ? entry.bullets : [];
    const path = `${section}[${index}].bullets`;
    if (bullets.length > MAX_BULLETS) report.hardErrors.push(`${path}: ${bullets.length} bullets exceeds limit ${MAX_BULLETS}`);

    const seen = new Set();
    bullets.forEach((bullet, bulletIndex) => {
      const key = normalized(bullet);
      if (key && seen.has(key)) report.hardErrors.push(`${path}[${bulletIndex}]: duplicate bullet`);
      if (key) seen.add(key);
      addBulletFindings(report, bullet, `${path}[${bulletIndex}]`);
    });

    const descriptionWords = words(entry?.description).length;
    if (descriptionWords > REVIEW_DESCRIPTION_WORDS) {
      report.reviewFindings.push(`${section}[${index}].description: ${descriptionWords} words; compress toward ${REVIEW_DESCRIPTION_WORDS} words`);
    }
  });
}

function auditCv(content, report, { strict = false } = {}) {
  const summaryWords = words(content?.summary).length;
  if (summaryWords > MAX_SUMMARY_WORDS) {
    const finding = `summary: ${summaryWords} words; compress toward ${MAX_SUMMARY_WORDS} words`;
    if (strict) report.hardErrors.push(finding.replace('; compress toward', ' exceeds maximum'));
    else report.reviewFindings.push(finding);
  }
  if (!strict) {
    addEntryBullets(report, content?.experience, 'experience');
    addEntryBullets(report, content?.projects, 'projects');
    return;
  }
  const certifications = Array.isArray(content?.certifications) ? content.certifications : [];
  if (certifications.length < MIN_CERTIFICATIONS) report.hardErrors.push(`certifications: ${certifications.length} entries below minimum ${MIN_CERTIFICATIONS}`);
  if (certifications.length > MAX_CERTIFICATIONS) report.hardErrors.push(`certifications: ${certifications.length} entries exceeds maximum ${MAX_CERTIFICATIONS}`);
  certifications.forEach((entry, index) => {
    const focus = entry?.focus;
    const path = `certifications[${index}].focus`;
    if (!Array.isArray(focus)) {
      report.hardErrors.push(`${path}: expected an array of ${MIN_CERTIFICATE_FOCUS}-${MAX_CERTIFICATE_FOCUS} items`);
      return;
    }
    if (focus.length < MIN_CERTIFICATE_FOCUS) report.hardErrors.push(`${path}: ${focus.length} items below minimum ${MIN_CERTIFICATE_FOCUS}`);
    if (focus.length > MAX_CERTIFICATE_FOCUS) report.hardErrors.push(`${path}: ${focus.length} items exceeds maximum ${MAX_CERTIFICATE_FOCUS}`);
    focus.forEach((item, itemIndex) => {
      if (typeof item !== 'string' || !item.trim()) report.hardErrors.push(`${path}[${itemIndex}]: must be non-empty text`);
    });
  });
  if (Array.isArray(content?.projects) && content.projects.length > MAX_PROJECTS) report.hardErrors.push(`projects: ${content.projects.length} entries exceeds maximum ${MAX_PROJECTS}`);
  if (Array.isArray(content?.education)) {
    content.education.forEach((entry, index) => {
      const subjects = educationSubjects(entry);
      if (subjects.length > MAX_EDUCATION_SUBJECTS) report.hardErrors.push(`education[${index}]: ${subjects.length} subjects exceeds maximum ${MAX_EDUCATION_SUBJECTS}`);
      if (typeof entry?.location === 'string' && entry.location.includes(',')) report.hardErrors.push(`education[${index}].location: use country only`);
    });
  }
  if (Array.isArray(content?.projects)) {
    content.projects.forEach((entry, index) => {
      if (![entry?.tech, entry?.methodology, entry?.domain].some(value => typeof value === 'string' && value.trim())) {
        report.hardErrors.push(`projects[${index}]: technology, methodology, or domain is required`);
      }
    });
  }
  addEntryBullets(report, content?.experience, 'experience');
  addEntryBullets(report, content?.projects, 'projects');
  const totalWords = countCvWords(content);
  if (totalWords < MIN_CV_WORDS) report.hardErrors.push(`cv: ${totalWords} words below minimum ${MIN_CV_WORDS}`);
  if (totalWords > MAX_CV_WORDS) report.hardErrors.push(`cv: ${totalWords} words exceeds maximum ${MAX_CV_WORDS}`);
  report.totalWords = totalWords;
}

function auditCoverLetter(content, report) {
  const achievements = content?.letter?.achievements;
  if (!Array.isArray(achievements)) return;
  achievements.forEach((achievement, index) => {
    const lead = String(achievement?.lead || '').trim();
    const impact = String(achievement?.impact || '').trim();
    if (!lead || !impact) report.hardErrors.push(`letter.achievements[${index}]: lead and impact are required`);
    if (words(lead).length > REVIEW_BULLET_WORDS) report.reviewFindings.push(`letter.achievements[${index}].lead: compress toward ${REVIEW_BULLET_WORDS} words`);
    addBulletFindings(report, impact, `letter.achievements[${index}].impact`);
  });
}

export function auditEvidenceCompression(content, artifactType = 'cv', options = {}) {
  const report = {
    artifact_type: artifactType,
    hardErrors: [],
    reviewFindings: [],
    totalWords: null,
  };
  if (artifactType === 'cover_letter') auditCoverLetter(content, report);
  else auditCv(content, report, options);
  report.status = report.hardErrors.length ? 'fail' : report.reviewFindings.length ? 'review' : 'pass';
  report.valid = report.hardErrors.length === 0;
  return report;
}

export function assertEvidenceCompression(content, artifactType = 'cv', options = {}) {
  const report = auditEvidenceCompression(content, artifactType, options);
  if (!report.valid) throw new Error(`Evidence compression gate failed:\n- ${report.hardErrors.join('\n- ')}`);
  return report;
}

export const EVIDENCE_COMPRESSION_LIMITS = Object.freeze({
  maxBullets: MAX_BULLETS,
  reviewBulletWords: REVIEW_BULLET_WORDS,
  hardBulletWords: HARD_BULLET_WORDS,
  reviewDescriptionWords: REVIEW_DESCRIPTION_WORDS,
  maxSummaryWords: MAX_SUMMARY_WORDS,
  minCertifications: MIN_CERTIFICATIONS,
  maxCertifications: MAX_CERTIFICATIONS,
  minCertificateFocus: MIN_CERTIFICATE_FOCUS,
  maxCertificateFocus: MAX_CERTIFICATE_FOCUS,
  maxProjects: MAX_PROJECTS,
  maxEducationSubjects: MAX_EDUCATION_SUBJECTS,
  minCvWords: MIN_CV_WORDS,
  maxCvWords: MAX_CV_WORDS,
});
