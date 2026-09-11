import test from 'node:test';
import assert from 'node:assert/strict';
import { auditEvidenceCompression, assertEvidenceCompression, EVIDENCE_COMPRESSION_LIMITS } from '../lib/evidence-compression-gate.mjs';

function validCv() {
  return {
    summary: Array(45).fill('analytics').join(' '),
    education: [{ title: 'MSc Analytics', org: 'Example University', location: 'Germany', coursework: ['Data Mining', 'Statistics', 'Optimization', 'Reporting', 'SQL'] }],
    experience: [{ description: Array(30).fill('reporting').join(' '), bullets: ['Built data reports with Excel to support decisions.'] }],
    projects: [{ description: Array(30).fill('analytics').join(' '), tech: 'SQL', bullets: ['Built data models with SQL to support reporting.'] }],
    certifications: [{ title: 'Certificate One', focus: ['Analytics', 'Reporting'] }, { title: 'Certificate Two', focus: ['Data analysis', 'Reporting'] }],
    skills: [{ category: 'Tools', items: Array.from({ length: 400 }, (_, index) => `Skill${index}`) }],
  };
}

test('CV gate enforces four bullets and reports evidence quality', () => {
  const report = auditEvidenceCompression(validCv());
  assert.equal(report.status, 'pass');
  assert.equal(EVIDENCE_COMPRESSION_LIMITS.maxBullets, 4);
  assert.equal(EVIDENCE_COMPRESSION_LIMITS.maxSummaryWords, 60);
  assert.equal(EVIDENCE_COMPRESSION_LIMITS.minCertifications, 2);
  assert.equal(EVIDENCE_COMPRESSION_LIMITS.maxCertifications, 5);
  assert.equal(EVIDENCE_COMPRESSION_LIMITS.minCertificateFocus, 2);
  assert.equal(EVIDENCE_COMPRESSION_LIMITS.maxCertificateFocus, 5);
  assert.equal(EVIDENCE_COMPRESSION_LIMITS.maxProjects, 3);
  assert.equal(EVIDENCE_COMPRESSION_LIMITS.maxEducationSubjects, 5);
  assert.equal(EVIDENCE_COMPRESSION_LIMITS.minCvWords, 500);
  assert.equal(EVIDENCE_COMPRESSION_LIMITS.maxCvWords, 650);

  const review = auditEvidenceCompression({ ...validCv(),
    experience: [{ bullets: ['Worked on things.'] }],
  });
  assert.equal(review.status, 'review');
  assert.ok(review.reviewFindings.some((finding) => finding.includes('weak action opening')));
  assert.ok(review.reviewFindings.some((finding) => finding.includes('no concrete evidence signal')));
});

test('CV gate blocks long summaries, excess certifications, and total overflow', () => {
  const report = auditEvidenceCompression({ ...validCv(),
    summary: 'word '.repeat(61),
    certifications: [{ title: 'One', focus: ['A', 'B'] }, { title: 'Two', focus: ['A', 'B'] }, { title: 'Three', focus: ['A', 'B'] }, { title: 'Four', focus: ['A', 'B'] }, { title: 'Five', focus: ['A', 'B'] }, { title: 'Six', focus: ['A', 'B'] }],
    experience: [{ company: 'Acme', role: 'Analyst', bullets: ['Built reports with Excel to support decisions.'] }],
  }, 'cv', { strict: true });
  assert.equal(report.status, 'fail');
  assert.ok(report.hardErrors.some(error => error.includes('summary')));
  assert.ok(report.hardErrors.some(error => error.includes('certifications')));
  assert.ok(report.totalWords >= 500);

  const overflow = auditEvidenceCompression({ ...validCv(), summary: 'word '.repeat(700) }, 'cv', { strict: true });
  assert.ok(overflow.hardErrors.some(error => error.includes('exceeds maximum 650')));
  assert.ok(overflow.totalWords > 700);
});

test('CV gate requires two to five focus items per certification', () => {
  const tooFew = auditEvidenceCompression({ ...validCv(), certifications: [{ title: 'One', focus: ['A'] }, { title: 'Two', focus: ['A', 'B'] }] }, 'cv', { strict: true });
  assert.ok(tooFew.hardErrors.some(error => error.includes('certifications[0].focus')));

  const tooMany = auditEvidenceCompression({ ...validCv(), certifications: [{ title: 'One', focus: ['A', 'B', 'C', 'D', 'E', 'F'] }, { title: 'Two', focus: ['A', 'B'] }] }, 'cv', { strict: true });
  assert.ok(tooMany.hardErrors.some(error => error.includes('exceeds maximum 5')));

  const stringFocus = auditEvidenceCompression({ ...validCv(), certifications: [{ title: 'One', focus: 'A and B' }, { title: 'Two', focus: ['A', 'B'] }] }, 'cv', { strict: true });
  assert.ok(stringFocus.hardErrors.some(error => error.includes('expected an array')));
});

test('CV gate blocks overflow and duplicate bullets', () => {
  const bullets = ['Built data reports to support decisions.', 'Built data reports to support decisions.', 'A '.repeat(40), 'Built pipelines with SQL to improve reporting.', 'Created dashboards with Power BI to support analysis.'];
  const report = auditEvidenceCompression({
    experience: [{ bullets }],
  });
  assert.equal(report.status, 'fail');
  assert.throws(() => assertEvidenceCompression({ experience: [{ bullets }] }), /Evidence compression gate failed/);
  assert.ok(report.hardErrors.some((error) => error.includes('exceeds limit 4')));
  assert.ok(report.hardErrors.some((error) => error.includes('duplicate bullet')));
});

test('cover-letter gate uses same evidence contract', () => {
  const report = auditEvidenceCompression({
    letter: {
      achievements: [{ lead: 'Built analytics workflow', impact: 'Produced decision-ready datasets with SQL for reporting.' }],
    },
  }, 'cover_letter');
  assert.equal(report.status, 'pass');

  const invalid = auditEvidenceCompression({ letter: { achievements: [{ lead: '', impact: '' }] } }, 'cover_letter');
  assert.equal(invalid.status, 'fail');
  assert.ok(invalid.hardErrors[0].includes('lead and impact are required'));
});
