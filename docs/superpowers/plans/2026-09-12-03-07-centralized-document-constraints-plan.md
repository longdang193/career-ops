---
artifact_type: plan
template_id: implementation-plan
contract_version: "1"
status: completed
layer: change
name: centralized-document-constraints
targets:
  - config/profile.yml
  - config/profile.example.yml
  - lib/document-rules.mjs
  - build-cv-markdown.mjs
  - build-cv-html.mjs
  - build-cv-latex.mjs
  - generate-cover-letter.mjs
  - cv-templates.mjs
  - modes/text.md
  - modes/pdf.md
  - modes/latex.md
  - modes/cover.md
  - modes/cv-audit.md
  - templates/cover-letter-template.reverse-timeline.md
  - templates/README.md
  - tests/document-rules.test.mjs
  - tests/document-audit-contract.test.mjs
  - tests/cv-markdown.test.mjs
  - tests/cover-markdown.test.mjs
  - tests/cv-templates.test.mjs
---

# Centralized Document Constraints

## Goal

Make `config/profile.yml` the single source of truth for CV and cover-letter
content limits. Make every document renderer consume the same validated rules,
prevent invalid artifacts from being written, preserve template-specific
presentation only, and keep workflow instructions free of duplicated numeric
limits.

## Implementation Outcomes

### One policy owner

`config/profile.yml` owns CV word limits, project and certification caps,
bullet-count bounds, cover-letter word limits, cover evidence bounds, and the
existing CV audit cycle cap. `config/profile.example.yml` mirrors the schema
without candidate data. No renderer, mode, or template stores a second global
numeric policy.

### Symmetric renderer enforcement

Markdown, HTML, LaTeX, and cover-letter renderers validate the same payload
cardinality and bullet rules before rendering, then validate visible rendered
word counts before writing. Invalid payloads fail with field-specific errors;
no renderer silently truncates projects, certifications, evidence, or bullets.

### Template and workflow alignment

Templates declare structure and presentation tokens only. Cover evidence count
comes from profile configuration, while the selected cover template retains
evidence slot and evidence style. Existing HTML structure remains unchanged.
Text, PDF, LaTeX, cover, and audit modes read limits from profile configuration
instead of repeating fixed numbers. The existing `cv.llm_audit` policy is the
shared mode-level contract for CV and cover-letter audits; when enabled, both
artifact types use the same maximum two review cycles.

### Regression and live proof

Focused tests prove lower and upper boundaries, invalid configuration, shared
behavior across renderers, template metadata separation, and fail-before-write
behavior. Live probes process captured jobs from
`C:\Users\HOANG PHI LONG DANG\repos\career-ops\data.private\jobs.filtered.jsonl`
and verify generated CVs and cover letters satisfy the active policy.

## Execution Approach

- Mode: `inline sequential`
- Coordination: `none`
- Required skills: `skill-central-config-layer`, `skill-code-standards`, `skill-systematic-debugging`, `skill-test-driven-development`, `skill-backend-verification`, `skill-private-data-handling`, `skill-verification-before-completion`
- Isolation: `current workspace`
- Commit policy: `no commits during execution`
- Preauthorized local actions: edit listed system code, configuration examples, modes, templates, and focused tests; run local syntax checks, tests, dry-run probes, and private artifact generation using existing captured input
- User-approval actions: commit, push, publication, external network access, authentication, edits to canonical candidate facts, deletion outside run-owned temporary probe files, or changes outside listed targets
- Parallel ownership: `none`
- Sequential fallback: execute Tasks 1–5 in order; same-workspace writers remain sequential

## Task Breakdown

### Task 1: Define canonical document policy

**Purpose:**
- Add missing limits to the existing profile configuration without creating a second configuration architecture.

**Task Function:**
- Establish and validate one shared configuration contract for generated document constraints.

**Template Profile:**
- Controller-selected: `none (lead controller)`
- Selection basis: bounded configuration and schema work with low ambiguity and direct existing ownership.

**Validator Profile:**
- Controller-selected: `none`
- Selection basis: focused configuration tests provide sufficient validation.

**Specification Coverage:**
- Preserve `cv.constraints.min_words: 450` and `cv.constraints.max_words: 600`.
- Preserve `cv.llm_audit.max_cycles: 2` as the only audit-cycle setting.
- Apply `cv.llm_audit.enabled` and `cv.llm_audit.max_cycles: 2` symmetrically to CV and cover-letter audits; do not create `cover_letter.llm_audit`.
- Add `cv.constraints.max_projects: 3`.
- Add `cv.constraints.max_certifications: 5`.
- Add symmetric `cv.constraints.bullets_per_entry.min: 3` and `cv.constraints.bullets_per_entry.max: 4`.
- Preserve cover word limits `250–350` and `max_evidence_claims: 4`.
- Add `cover_letter.constraints.min_evidence_claims: 2`.
- Reject missing, non-integer, non-positive, inverted, or inconsistent rule values with actionable configuration errors.

**Required Skills:**
- `skill-central-config-layer`
- `skill-code-standards`

**Files And Symbols:**
- Inspect: `config/profile.yml`, `config/profile.example.yml`, `cv-templates.mjs:loadProfileConfig`
- Modify: `config/profile.yml`, `config/profile.example.yml`, `lib/document-rules.mjs`
- Verify: `tests/document-rules.test.mjs`

**Dependencies:**
- Existing `loadProfileConfig()` remains the profile reader.
- Existing `cv.llm_audit.max_cycles` remains unchanged and is not duplicated under another key.

**Authority:**
- Preauthorized local actions: edit the listed configuration files and create `lib/document-rules.mjs`; run focused rule tests.
- Stop for: candidate-fact changes, external provider calls, private artifact publication, or a second policy file.

**Steps:**
- [x] Step 1: Add `max_projects`, `max_certifications`, and `bullets_per_entry` under `cv.constraints`; add `min_evidence_claims` under `cover_letter.constraints`.
- [x] Step 2: Implement `loadDocumentRules()` in `lib/document-rules.mjs` by reading the existing profile config and returning normalized CV and cover-letter rule objects.
- [x] Step 3: Implement `validateDocumentRules()` with strict integer and range checks for all configured bounds.
- [x] Step 4: Add focused tests for valid defaults, boundary values, missing keys, non-integer values, inverted ranges, and duplicate audit-cycle settings.

**Verification:**
- [x] `node --test tests/document-rules.test.mjs`
- Expected: valid profile rules load once; malformed or incomplete rules fail with the offending config path; `cv.llm_audit.max_cycles` remains `2`.

**Exit Criteria:**
- Every required numeric rule exists in one profile schema.
- No new global rule file or duplicate audit-cycle setting exists.
- Rule loader returns validated values usable by every renderer.

### Task 2: Enforce shared limits in all renderers

**Purpose:**
- Prevent invalid CV and cover-letter payloads from reaching file writes, regardless of output format.

**Task Function:**
- Integrate shared pre-render cardinality checks and post-render visible-word checks into existing renderer entry points.

**Template Profile:**
- Controller-selected: `none (lead controller)`
- Selection basis: shared behavior change across known renderer entry points; no profile delegation needed.

**Validator Profile:**
- Controller-selected: `none`
- Selection basis: focused renderer tests and existing renderer self-tests cover success and failure paths.

**Specification Coverage:**
- CV projects are capped at `cv.constraints.max_projects`.
- CV certifications are capped at `cv.constraints.max_certifications`.
- Every CV experience and project entry has `cv.constraints.bullets_per_entry.min–max` bullets.
- CV visible words stay within `cv.constraints.min_words–max_words`.
- Cover evidence stays within `cover_letter.constraints.min_evidence_claims–max_evidence_claims`.
- Cover visible words stay within `cover_letter.constraints.min_words–max_words`.
- When `cv.llm_audit.enabled` is true, cover-letter output runs the same audit policy and stops after `cv.llm_audit.max_cycles`.
- Invalid payloads fail before output writes; existing unresolved-placeholder and fact-gate failures remain intact.

**Required Skills:**
- `skill-code-standards`
- `skill-systematic-debugging`
- `skill-test-driven-development`
- `skill-backend-verification`

**Files And Symbols:**
- Inspect: `lib/document-rules.mjs:loadDocumentRules`, `build-cv-markdown.mjs:buildMarkdown`, `build-cv-markdown.mjs:buildExperience`, `build-cv-markdown.mjs:buildProjects`, `build-cv-markdown.mjs:buildCertifications`, `build-cv-html.mjs:renderHtml`, `build-cv-html.mjs:writeAndReport`, `build-cv-latex.mjs:main`, `generate-cover-letter.mjs:buildMarkdown`, `generate-cover-letter.mjs:buildHtml`, `generate-cover-letter.mjs:validateCoverConstraints`
- Modify: `lib/document-rules.mjs`, `build-cv-markdown.mjs`, `build-cv-html.mjs`, `build-cv-latex.mjs`, `generate-cover-letter.mjs`
- Verify: `tests/document-rules.test.mjs`, `tests/cv-markdown.test.mjs`, `tests/cover-markdown.test.mjs`, `build-cv-html.mjs --test`, `build-cv-latex.mjs --test`

**Dependencies:**
- Task 1 rule loader and schema validation complete.
- Existing payload field contracts in `lib/cv-payload-schema.mjs` remain authoritative for format-specific fields.

**Authority:**
- Preauthorized local actions: edit listed renderer and shared-rule files; add or update focused tests; run local builders and self-tests.
- Stop for: silent truncation, changes to candidate source ownership, changes to output-path security, or new renderer branches selected by template filename.

**Steps:**
- [x] Step 1: Add shared `validatePayloadLimits(kind, payload, rules)` for CV and cover payload cardinality and bullet bounds; report exact payload paths and configured limits.
- [x] Step 2: Add shared `countVisibleWords(text, format)` and `validateRenderedWordCount(kind, text, rules)` using visible document content rather than Markdown, HTML, or LaTeX syntax.
- [x] Step 3: Call shared CV validation before `buildMarkdown`, `renderHtml`, and LaTeX document assembly; call rendered-word validation immediately before each output write or returned artifact.
- [x] Step 4: Replace cover-local numeric evidence enforcement with profile-configured min/max values while preserving template-local evidence slot and style checks.
- [x] Step 5: Keep `buildExperience`, `buildProjects`, and `buildCertifications` deterministic; they must receive already-validated payloads and must not silently slice arrays.
- [x] Step 6: Preserve existing fact-gate, unresolved-placeholder, output-path, and template-resolution behavior.
- [x] Step 7: Route cover-letter audit through the same audit entry point and cycle counter used by CV audit; do not create a cover-specific audit setting.

**Verification:**
- [x] `node --test tests/document-rules.test.mjs tests/cv-markdown.test.mjs tests/cover-markdown.test.mjs`
- Expected: valid lower and upper boundaries render; four projects, six certifications, two-or-five bullets, one-or-five cover evidence items, and out-of-range word counts fail before output creation.
- [x] `node build-cv-html.mjs --test`
- Expected: HTML self-test passes with shared limits active.
- [x] `node build-cv-latex.mjs --test`
- Expected: LaTeX self-test passes with shared limits active.

**Exit Criteria:**
- All CV formats and both cover output formats use same configured limits.
- Invalid payloads produce explicit errors and no artifact file.
- No renderer contains hardcoded project, certification, bullet, evidence, or word-count limits.

### Task 3: Remove policy duplication from templates and modes

**Purpose:**
- Keep global rules in profile configuration while preserving template-specific structure and presentation.

**Task Function:**
- Align prompts, template metadata, and documentation with the shared policy API.

**Template Profile:**
- Controller-selected: `none (lead controller)`
- Selection basis: bounded text and metadata edits after renderer behavior is established.

**Validator Profile:**
- Controller-selected: `none`
- Selection basis: repository search plus focused template tests verify no numeric drift.

**Specification Coverage:**
- `templates/cover-letter-template.reverse-timeline.md` retains evidence slot/style but no global evidence min/max values.
- `modes/text.md`, `modes/pdf.md`, and `modes/latex.md` reference profile-configured project, certificate, bullet, and word limits instead of fixed numbers.
- `modes/cover.md` invokes the shared audit procedure and reads cover limits from profile configuration.
- `modes/cv-audit.md` is the shared audit procedure for CV and cover letters; both artifact types read `cv.llm_audit.enabled` and `cv.llm_audit.max_cycles`.
- `templates/README.md` documents profile ownership and template-local presentation metadata.

**Required Skills:**
- `skill-central-config-layer`
- `skill-code-standards`

**Files And Symbols:**
- Inspect: `templates/cover-letter-template.reverse-timeline.md`, `cv-templates.mjs:getTemplateContract`, `modes/text.md`, `modes/pdf.md`, `modes/latex.md`, `modes/cover.md`, `modes/cv-audit.md`, `templates/README.md`
- Modify: `templates/cover-letter-template.reverse-timeline.md`, `cv-templates.mjs:getTemplateContract`, `modes/text.md`, `modes/pdf.md`, `modes/latex.md`, `modes/cover.md`, `modes/cv-audit.md`, `templates/README.md`
- Verify: `tests/cv-templates.test.mjs`, `tests/cover-markdown.test.mjs`, repository-wide fixed-limit search

**Dependencies:**
- Task 2 shared enforcement API is complete.
- Template routing still resolves `long-dang` and `reverse-timeline` through existing profile defaults.

**Authority:**
- Preauthorized local actions: edit listed modes, template metadata, resolver contract, and documentation; run focused tests and search checks.
- Stop for: candidate-specific content in system templates, removal of required structural tokens, or changes to template presentation beyond numeric-policy ownership.

**Steps:**
- [x] Step 1: Remove `evidence_min` and `evidence_max` from the reverse-timeline template metadata; retain `evidence_style: prose` and `evidence_slot: experience`.
- [x] Step 2: Make `getTemplateContract()` return presentation metadata only; keep compatibility failure for invalid `evidence_style` or unsupported `evidence_slot`.
- [x] Step 3: Replace fixed-count prompt text with instructions to read the corresponding `config/profile.yml` constraint before selecting content.
- [x] Step 4: Update template documentation to distinguish global profile policy from template-local structure.
- [x] Step 5: Add or update resolver tests proving a template cannot override global evidence counts.
- [x] Step 6: Update `modes/cover.md` and `modes/cv-audit.md` to name the shared `cv.llm_audit.enabled` and `cv.llm_audit.max_cycles` contract; do not add cover-specific audit settings.

**Verification:**
- [x] `node --test tests/cv-templates.test.mjs tests/cover-markdown.test.mjs`
- Expected: resolver and cover tests pass; numeric evidence limits come from profile configuration; presentation metadata still selects the correct evidence token.
- [x] `rg -n "top 3-4|top 3–4|evidence_min|evidence_max|max_projects|max_certifications|bullets_per_entry" modes templates cv-templates.mjs build-cv-markdown.mjs build-cv-html.mjs build-cv-latex.mjs generate-cover-letter.mjs`
- Expected: numeric policy definitions appear only in `config/profile.yml`, `config/profile.example.yml`, and shared rule tests; mode text references config keys without second values.

**Exit Criteria:**
- Templates no longer own global numeric limits.
- Modes no longer duplicate numeric policy.
- Adding another template does not require editing renderer conditionals or global modes.

### Task 4: Add focused regression proof

**Purpose:**
- Lock the SSOT contract and prevent future renderer-specific drift.

**Task Function:**
- Build compact boundary tests that fail when any consumer bypasses shared rules.

**Template Profile:**
- Controller-selected: `none (lead controller)`
- Selection basis: deterministic test fixture work with clear failure contracts.

**Validator Profile:**
- Controller-selected: `none`
- Selection basis: the same focused tests validate the shared rule surface.

**Specification Coverage:**
- Configuration schema and default values are tested.
- CV project, certification, bullet, and word boundaries are tested.
- Cover evidence, bullet, and word boundaries are tested.
- Markdown, HTML, LaTeX, and cover renderers reject the same invalid cardinality.
- Shared audit policy is regression-tested for both CV and cover modes; the deterministic renderers do not invoke an LLM audit themselves.
- Invalid artifacts are not written.
- Existing template, fact-gate, and placeholder regressions remain covered.

**Required Skills:**
- `skill-test-driven-development`

**Files And Symbols:**
- Inspect: `tests/cv-markdown.test.mjs`, `tests/cover-markdown.test.mjs`, `tests/cv-templates.test.mjs`, `tests/cv-named-templates.test.mjs`, `tests/shipped-cv-templates-render.test.mjs`
- Modify: `tests/document-rules.test.mjs`, `tests/cv-markdown.test.mjs`, `tests/cover-markdown.test.mjs`, `tests/cv-templates.test.mjs`
- Verify: the focused test commands in this task and Task 5

**Dependencies:**
- Tasks 1–3 complete.
- Tests use temporary directories and synthetic payloads; they do not read or write `data.private/`.

**Authority:**
- Preauthorized local actions: add focused test fixtures and update assertions required by the centralized contract; run Node test commands.
- Stop for: broad fixture rewrites, network calls, private data access, or weakening a failure assertion to accommodate a renderer defect.

**Steps:**
- [x] Step 1: Add valid boundary fixtures at `450` and `600` CV words and `250` and `350` cover words.
- [x] Step 2: Add failure fixtures for four projects, six certifications, two and five bullets, one and five evidence items, and out-of-range word counts.
- [x] Step 3: Assert failures occur before output files are created.
- [x] Step 4: Assert profile configuration is the only numeric source and custom template metadata cannot widen global limits.
- [x] Step 5: Run existing CV and cover template tests to prove unrelated structure remains stable.
- [x] Step 6: Add focused coverage for `cv.llm_audit` validation and shared delegation from both document modes; assert cycle three is rejected.

**Verification:**
- [x] `node --test tests/document-rules.test.mjs tests/document-constraints-cli.test.mjs tests/cv-markdown.test.mjs tests/cover-markdown.test.mjs tests/cv-templates.test.mjs tests/cv-named-templates.test.mjs tests/shipped-cv-templates-render.test.mjs`
- Expected: all focused tests pass, including every boundary and fail-before-write assertion.

**Exit Criteria:**
- Regression suite fails if any renderer bypasses shared rules, silently truncates payloads, or accepts template-local numeric overrides.

### Task 5: Regenerate and conduct live acceptance probes

**Purpose:**
- Prove current captured jobs generate compliant artifacts under the centralized policy without URL retrieval or private-source mutation.

**Task Function:**
- Execute the approved local generation path and inspect final private artifacts against active configuration.

**Template Profile:**
- Controller-selected: `none (lead controller)`
- Selection basis: bounded local generation and acceptance verification using already captured job descriptions.

**Validator Profile:**
- Controller-selected: `none`
- Selection basis: renderer checks, structural assertions, and fact-gate output provide direct evidence.

**Specification Coverage:**
- Captured input uses `raw_job.description` as JD source; URL retrieval is not required.
- Generated CVs use `long-dang` template and active CV limits.
- Generated cover letters use `reverse-timeline` template and active cover limits.
- Four final artifacts contain no unresolved placeholders and match required structure.
- If `cv.llm_audit.enabled` is enabled for the probe, both CV and cover-letter artifacts receive the same audit treatment and maximum-two-cycle cap.
- Private candidate sources remain unchanged.

**Required Skills:**
- `skill-private-data-handling`
- `skill-verification-before-completion`

**Files And Symbols:**
- Inspect: `C:\Users\HOANG PHI LONG DANG\repos\career-ops\data.private\jobs.filtered.jsonl`, `C:\Users\HOANG PHI LONG DANG\repos\career-ops\cv.md`, `C:\Users\HOANG PHI LONG DANG\repos\career-ops\config\profile.yml`, `C:\Users\HOANG PHI LONG DANG\repos\career-ops\reports\002-trade-republic-2026-09-12.md`, `C:\Users\HOANG PHI LONG DANG\repos\career-ops\reports\003-almetra-2026-09-12.md`
- Modify: `C:\Users\HOANG PHI LONG DANG\repos\career-ops\output\cv-long-dang-trade-republic-accounting-intern-2026-09-11.md`, `C:\Users\HOANG PHI LONG DANG\repos\career-ops\output\cv-long-dang-almetra-applied-ai-intern-2026-09-11.md`, `C:\Users\HOANG PHI LONG DANG\repos\career-ops\output\trade-republic-accounting-intern-cover.md`, `C:\Users\HOANG PHI LONG DANG\repos\career-ops\output\almetra-applied-ai-intern-cover.md`
- Verify: `output/` artifacts, source hashes, renderer logs, and Git status

**Dependencies:**
- Tasks 1–4 complete.
- Current `config/profile.yml` resolves `long-dang` and `reverse-timeline`.
- Existing captured jobs contain non-empty `raw_job.description` values.

**Authority:**
- Preauthorized local actions: read canonical private sources, run the existing JSONL dry-run, create payloads only under `C:\Users\HOANG PHI LONG DANG\repos\career-ops\data.private\probes\centralized-document-constraints\`, regenerate the four ignored `output/` artifacts, run local fact and structure checks, and remove only files under that probe directory.
- Stop for: URL retrieval, external network/authentication, edits to `cv.md`, profile facts, `jobs.filtered.jsonl`, reports, tracker files, or any publication/push action.

**Steps:**
- [x] Step 1: Capture hashes and modification times for `cv.md`, `config/profile.yml`, `data.private/jobs.filtered.jsonl`, and the two evaluation reports.
- [x] Step 2: Run `bash batch/batch-runner.sh --jsonl "C:\Users\HOANG PHI LONG DANG\repos\career-ops\data.private\jobs.filtered.jsonl" --dry-run --limit 2`; confirm both captured records are selected and no URL retrieval is attempted.
- [x] Step 3: Build role-specific payloads from `cv.md`, `config/profile.yml`, and `raw_job.description` into the task-owned private probe directory; do not read legacy output artifacts as factual sources.
- [x] Step 4: Render both CV and cover-letter artifacts with the configured `long-dang` and `reverse-timeline` templates.
- [x] Step 5: Run structural checks for section order, required reverse-timeline blocks, inline contact markup, evidence count, and unresolved placeholders.
- [x] Step 6: Read `cv.llm_audit.enabled`; it is `false` for this probe, so no live model audit runs. Shared policy validation and CV/cover mode delegation are covered by focused tests.
- [x] Step 7: Run `node verify-cv-facts.mjs` against all four outputs with `cv.md` as source; record optional fact-gate configuration warnings separately from verdict.
- [x] Step 8: Confirm canonical sources remain unchanged; task-owned probe directory is absent after cleanup.

**Verification:**
- [x] `bash batch/batch-runner.sh --jsonl "C:\Users\HOANG PHI LONG DANG\repos\career-ops\data.private\jobs.filtered.jsonl" --dry-run --limit 2`
- Expected: two records selected from captured descriptions; no URL retrieval.
- [x] `node verify-cv-facts.mjs output/cv-long-dang-trade-republic-accounting-intern-2026-09-11.md --source cv.md --json`
- [x] `node verify-cv-facts.mjs output/cv-long-dang-almetra-applied-ai-intern-2026-09-11.md --source cv.md --json`
- [x] `node verify-cv-facts.mjs output/trade-republic-accounting-intern-cover.md --source cv.md --json`
- [x] `node verify-cv-facts.mjs output/almetra-applied-ai-intern-cover.md --source cv.md --json`
- Expected: no invented or unsupported candidate facts; missing optional `config/cv-facts.json` is recorded as a warning, not treated as complete coverage.
- [x] `git diff --check`
- Expected: no whitespace errors; only approved system files and the implementation plan are tracked changes; private output remains ignored.

**Exit Criteria:**
- Four regenerated artifacts pass centralized limits and structural checks.
- Captured JDs are used without redundant URL retrieval.
- Canonical candidate and job source files remain unchanged.
- Any fact-gate coverage limitation is explicit and not misreported as full verification.

## Execution Evidence (2026-09-12)

- Focused regression suite: `57` passed, `0` failed; web suite: `52` passed, `0` failed; HTML and LaTeX self-tests passed; `scripts/check-syntax.mjs` passed for `704` `.mjs` files; `git diff --check` passed.
- Live JSONL dry-run through installed Git Bash selected `2` captured offers (`Trade Republic`, `Almetra`), reported no offers requiring processing, and used zero-token local paths; no URL retrieval occurred.
- Final artifacts passed shared visible-word validation: CVs `519` words each against `450–600`; cover letters `290` and `292` against `250–350`; no unresolved `{{TOKEN}}` placeholders.
- `cv.llm_audit.enabled` is `false` in active profile. No live model audit was required; shared policy validation and CV/cover mode delegation are regression-tested. The renderer remains deterministic; LLM audit execution stays in the shared mode workflow when explicitly enabled.
- Fact gate: all four commands completed without invented or unsupported facts. `config/cv-facts.json` is absent, so advisory coverage warning remains explicit; cover outputs also report count-like claims outside extractor coverage.
- Canonical source hashes at verification: `cv.md` `C67F9011CB4B6D0957D064E66FCCC22E994A5156C78C90988EC2379D06555F92`; `config/profile.yml` `BC63D5ECAD03717EE2B6AB2D77A341855C55A62271E6F346FC1FEF2B5E56B315`; `data.private/jobs.filtered.jsonl` `F24D74948861DAABFA1F7EAE86E12B045CC4665938B4968A8950D6F6A102A8CC`.
- Fresh-agent review found no artifact compliance failure. It flagged relative `postedTime` values in the captured JSONL as stale versus `publishedAt`; batch normalization does not copy either field, so generated CVs and cover letters remain unaffected.
- Task-owned probe directory was removed after final verification; no private generated artifact was deleted.

## Verification

- `node --test tests/document-rules.test.mjs tests/document-audit-contract.test.mjs tests/document-constraints-cli.test.mjs tests/cv-markdown.test.mjs tests/cover-markdown.test.mjs tests/cv-templates.test.mjs tests/cv-named-templates.test.mjs tests/shipped-cv-templates-render.test.mjs`
- `node build-cv-html.mjs --test`
- `node build-cv-latex.mjs --test`
- `node scripts/check-syntax.mjs`
- `bash batch/batch-runner.sh --jsonl "C:\Users\HOANG PHI LONG DANG\repos\career-ops\data.private\jobs.filtered.jsonl" --dry-run --limit 2`
- `git diff --check`
- Verify generated output files contain no `{{TOKEN}}` placeholders and match configured section/evidence limits.

## Completion Criteria

The plan is ready for completion verification when:

1. All document limits live in `config/profile.yml` and its example schema.
2. All CV and cover renderers consume the same validated rules.
3. No renderer silently truncates invalid payloads.
4. Templates contain presentation metadata only; modes contain no duplicated numeric policy.
5. Focused regression tests prove valid boundaries, invalid boundaries, and fail-before-write behavior.
6. Live probes using `data.private/jobs.filtered.jsonl` regenerate compliant artifacts without URL retrieval.
7. Shared audit policy applies to CV and cover-letter modes under `cv.llm_audit`, with no cover-specific duplicate; renderer-level LLM execution is out of scope.
8. Fact-gate limitations, source immutability, generated output status, and any scope deviation are recorded.
9. Final verification commands pass with fresh output.
10. Plan status is `completed` after execution and fresh verification returned `verified`.
