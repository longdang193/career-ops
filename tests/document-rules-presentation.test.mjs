import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEducationInstitution, validateCvPresentation } from '../lib/document-rules.mjs';

const rules = {
  cv: {
    presentation: {
      educationLocation: 'country_only',
      certificateFocus: { minItems: 2, maxItems: 5 },
      projectContext: { maxItems: 3 },
      skills: {
        requiredCategories: ['business/domain knowledge', 'programming languages', 'tools/frameworks'],
        maxItems: 3,
        noCrossCategoryOverlap: true,
      },
    },
  },
};

function payload(overrides = {}) {
  return {
    education: [{ institution: 'Example University', location: 'Berlin, Germany' }],
    projects: [{ name: 'Example', context: ['Python', 'SQL', 'validation'] }],
    certifications: [{ title: 'Certificate', focus: ['SQL', 'data modeling'] }],
    skills: [
      { category: 'Business/Domain Knowledge', items: ['market research'] },
      { category: 'Programming Languages', items: ['Python', 'SQL'] },
      { category: 'Tools/Frameworks', items: ['Power BI', 'Git'] },
    ],
    ...overrides,
  };
}

test('tailored CV presentation policy accepts bounded, non-overlapping payload', () => {
  assert.doesNotThrow(() => validateCvPresentation(payload(), 'md', rules));
});

test('country-only education formatting removes city suffix from institution names', () => {
  assert.equal(formatEducationInstitution('Otto von Guericke University Magdeburg', 'Magdeburg, Germany', rules), 'Otto von Guericke University');
  assert.equal(formatEducationInstitution('Foreign Trade University', 'Hanoi, Vietnam', rules), 'Foreign Trade University');
});

test('tailored CV presentation policy rejects one-item certificate focus', () => {
  assert.throws(
    () => validateCvPresentation(payload({ certifications: [{ title: 'Certificate', focus: ['SQL'] }] }), 'md', rules),
    /certifications\[0\]\.focus: expected 2-5/,
  );
});

test('tailored CV presentation policy rejects non-text list items', () => {
  assert.throws(
    () => validateCvPresentation(payload({ certifications: [{ title: 'Certificate', focus: ['SQL', {}] }] }), 'md', rules),
    /certifications\[0\]\.focus: expected text items/,
  );
});

test('tailored CV presentation policy rejects scalar list fields', () => {
  assert.throws(
    () => validateCvPresentation(payload({ projects: [{ name: 'Example', context: 2026 }] }), 'md', rules),
    /projects\[0\]\.context: expected text items/,
  );
});

test('tailored CV presentation policy rejects project context over three items', () => {
  assert.throws(
    () => validateCvPresentation(payload({ projects: [{ name: 'Example', context: ['Python', 'SQL', 'validation', 'BigQuery'] }] }), 'md', rules),
    /projects\[0\]\.context: maximum 3/,
  );
});

test('tailored CV presentation policy rejects missing required skill category', () => {
  assert.throws(
    () => validateCvPresentation(payload({ skills: payload().skills.slice(0, 2) }), 'md', rules),
    /skills: missing required categories: tools\/frameworks/,
  );
});

test('tailored CV presentation policy rejects cross-category skill overlap', () => {
  assert.throws(
    () => validateCvPresentation(payload({
      skills: [
        { category: 'Business/Domain Knowledge', items: ['market research'] },
        { category: 'Programming Languages', items: ['Python', 'SQL'] },
        { category: 'Tools/Frameworks', items: ['SQL', 'Git'] },
      ],
    }), 'md', rules),
    /skills: item appears in multiple categories: sql/,
  );
});

test('tailored CV presentation policy rejects duplicate skill categories', () => {
  assert.throws(
    () => validateCvPresentation(payload({
      skills: [
        { category: 'Business/Domain Knowledge', items: ['market research'] },
        { category: 'Programming Languages', items: ['Python', 'SQL'] },
        { category: 'Tools/Frameworks', items: ['Power BI', 'Git'] },
        { category: 'tools-frameworks', items: ['SQLite'] },
      ],
    }), 'md', rules),
    /skills: duplicate category: tools frameworks/,
  );
});

test('tailored CV presentation policy rejects verbose skill categories', () => {
  assert.throws(
    () => validateCvPresentation(payload({
      skills: [
        { category: 'Business/Domain Knowledge', items: ['market research', 'quality assurance', 'data analysis', 'stakeholder communication'] },
        { category: 'Programming Languages', items: ['Python', 'SQL'] },
        { category: 'Tools/Frameworks', items: ['Power BI', 'Git'] },
      ],
    }), 'md', rules),
    /skills\[0\]\.items: maximum 3/,
  );
});
