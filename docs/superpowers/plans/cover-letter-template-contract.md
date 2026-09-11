---
artifact_type: plan
template_id: implementation-plan
contract_version: "1"
status: completed
layer: change
---

# Cover Letter Template Contract

## Goal

Support multiple Markdown cover-letter templates without duplicating content
rules, fact-validation logic, or generator branches. Keep candidate facts in
`cv.md`, keep global cover-letter constraints in profile configuration, and let
each template declare only its own presentation and evidence-block limits.

## Implementation Outcomes

### Shared cover-letter policy

All cover-letter templates use one configured policy for word limits and
evidence quality, plus the existing shared fact-validation and optional LLM
review settings. No global policy depends on literal section headings.

### Template-local presentation contract

Each cover-letter template can declare evidence minimum, evidence maximum, and
presentation style (`prose` or `bullets`). The selected template controls
layout and block distribution without changing source facts or workflow rules.

### Branch-free rendering and proof

Cover-letter generation renders reusable tokens for every supported presentation
and validates the selected contract before writing Markdown or PDF. Regression
tests prove that Long Dang prose and another bullet template use the same global
policy with different block shapes.

## Execution Approach

- Mode: `inline sequential`
- Coordination: `git-tracked`
- Required skills: `skill-executing-plans`, `skill-private-data-handling`, `skill-verification-before-completion`
- Isolation: `current workspace`
- Commit policy: `no commits during execution`
- Preauthorized local actions: inspect and edit listed repository files, run declared local tests and syntax checks, and update this plan's task ledger after accepted proof
- User-approval actions: commit, push, publication, discard, cleanup of unrelated `.serena/` files, or changes outside listed files
- Parallel ownership: `none`
- Sequential fallback: execute Tasks 1–4 in order in the current workspace

## Coordination State

- Coordination owner: `single lead controller`
- Coordination schema: `2`
- Branch: `private/cv-local`
- Base commit: `32c052d991ec22e3b18d486f91d8ced74a758f86`
- Expected workspace: `preserve current uncommitted cover-letter alignment changes; leave .serena/ untracked and untouched`
- Next action: `implementation verified; await separate commit or publication authorization`
- Blockers: `none`

| Task | State | Workspace | Executor | Depends On | Required Proof | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Task 1: Policy and contract | `completed` | current | `codex` | none | focused resolver/config tests | `27/27 tests passed; contract defaults and invalid metadata covered` |
| Task 2: Renderer refactor | `completed` | current | `codex` | Task 1 | cover generator tests and no filename branch | `41/41 focused tests passed; contract validation and shared tokens covered` |
| Task 3: Mode and template alignment | `completed` | current | `codex` | Task 2 | template inspection and cover-mode consistency check | `stale fixed-count and filename assumptions absent; diff check passed` |
| Task 4: Final regression proof | `completed` | current | `codex` | Tasks 1–3 | cover tests, syntax check, diff check | `42/42 tests passed; 694 .mjs syntax checks passed; git diff --check passed` |

## Task Breakdown

### Task 1: Add shared policy and template contract

**Purpose:**
- Define global cover-letter limits once and add typed template-local evidence metadata without changing candidate facts.

**Task Function:**
- Establish configuration and resolver contracts for multi-template rendering.

**Template Profile:**
- Controller-selected: `none (lead controller)`
- Selection basis: low-risk, bounded configuration and parser change with existing tests.

**Validator Profile:**
- Controller-selected: `none`
- Selection basis: focused resolver tests are sufficient.

**Specification Coverage:**
- Global policy is shared across templates.
- Evidence block count and style belong to the selected template contract.
- Existing template discovery and fallback behavior remain compatible.

**Required Skills:**
- `skill-private-data-handling`

**Files And Symbols:**
- Inspect: `config/profile.yml`, `config/profile.example.yml`, `cv-templates.mjs:KINDS`, `cv-templates.mjs:parseMeta`
- Modify: `config/profile.yml`, `config/profile.example.yml`, `cv-templates.mjs`
- Verify: `tests/cv-templates.test.mjs`

**Dependencies:**
- Current branch and existing uncommitted cover alignment remain intact.

**Authority:**
- Preauthorized local actions: edit only the listed configuration and resolver files, plus focused resolver tests if required; run local tests.
- Stop for: any need to modify candidate facts, public publication, commit/push, or a contract broader than cover-letter evidence metadata.

**Steps:**
- [x] Step 1: Add global `cover_letter.constraints` values without adding template-specific limits or duplicating the existing `cv.llm_audit.max_cycles` setting.
- [x] Step 2: Extend template metadata parsing with typed `evidence_min`, `evidence_max`, and `evidence_style` values and safe defaults.
- [x] Step 3: Reject invalid contract values and preserve existing resolver behavior for templates without metadata.

**Verification:**
- [x] `node --test tests/cv-templates.test.mjs`
- Expected: existing resolver tests pass; typed contract values parse; invalid values fail clearly; metadata-free templates use defaults.

**Exit Criteria:**
- Global limits have one configuration owner.
- Template contract API is available to the generator.
- No candidate content changes.

### Task 2: Remove filename-specific rendering logic

**Purpose:**
- Make the generator render selected template presentation from contract and tokens rather than template filename.

**Task Function:**
- Refactor cover-letter rendering and contract validation.

**Template Profile:**
- Controller-selected: `none (lead controller)`
- Selection basis: bounded single-file behavior change with existing cover tests.

**Validator Profile:**
- Controller-selected: `none`
- Selection basis: generator regression tests cover success and failure paths.

**Specification Coverage:**
- Same semantic payload feeds prose and bullet layouts.
- Selected template may use different evidence block counts.
- Generation must fail rather than silently discard over-limit evidence.

**Required Skills:**
- `skill-private-data-handling`

**Files And Symbols:**
- Inspect: `generate-cover-letter.mjs:buildReplacements`, `generate-cover-letter.mjs:buildMarkdown`, `generate-cover-letter.mjs:renderTemplate`
- Modify: `generate-cover-letter.mjs`
- Verify: `tests/cover-markdown.test.mjs`, `tests/cover-unresolved-placeholders.test.mjs`

**Dependencies:**
- Task 1 contract API complete.

**Authority:**
- Preauthorized local actions: edit only `generate-cover-letter.mjs` and related focused tests; run local generator tests.
- Stop for: changes to fact ownership, output publication, or silent truncation behavior not covered by this plan.

**Steps:**
- [x] Step 1: Remove the `basename(resolvedPath)` Long Dang branch.
- [x] Step 2: Populate reusable generic and Iconify contact tokens plus prose and bullet evidence tokens for every template.
- [x] Step 3: Read the selected contract, validate evidence count, and render the selected template without altering source facts.
- [x] Step 4: Preserve unresolved-placeholder failure and fact-gate behavior for Markdown and PDF paths.

**Verification:**
- [x] `node --test tests/cover-markdown.test.mjs tests/cover-unresolved-placeholders.test.mjs tests/cover-letter-signature.test.mjs`
- Expected: Long Dang output remains structurally correct; generic templates remain compatible; unsupported tokens still fail; no filename-specific branch remains.

**Exit Criteria:**
- Generator behavior depends on template contract and tokens, not template filename.
- Evidence over-limit and under-limit cases produce explicit errors.
- Existing HTML preservation remains intact.

### Task 3: Align templates and workflow rules

**Purpose:**
- Make templates declare presentation choices and make `cover.md` describe semantic slots instead of fixed headings or bullet counts.

**Task Function:**
- Reconcile template metadata, workflow instructions, and source-of-truth boundaries.

**Template Profile:**
- Controller-selected: `none (lead controller)`
- Selection basis: documentation and template edits are narrow and sequentially dependent on the renderer contract.

**Validator Profile:**
- Controller-selected: `none`
- Selection basis: final regression tests inspect rendered structure.

**Specification Coverage:**
- Template headings and order may differ.
- Global rules remain symmetric across all templates.
- Long Dang remains the canonical current presentation without becoming a special case.

**Required Skills:**
- `skill-private-data-handling`

**Files And Symbols:**
- Inspect: `templates/cover-letter-template.long-dang.md`, `templates/cover-letter-template.md`, `modes/cover.md`
- Modify: `templates/cover-letter-template.long-dang.md`, `templates/cover-letter-template.md`, `modes/cover.md`
- Verify: rendered Markdown fixtures and template metadata inspection

**Dependencies:**
- Task 2 complete.

**Authority:**
- Preauthorized local actions: edit only listed templates and `modes/cover.md`; run local structural checks.
- Stop for: changes to CV rules, candidate facts, or creation of a separate per-template workflow skill.

**Steps:**
- [x] Step 1: Add Long Dang evidence contract metadata and keep its reference HTML/Markdown structure.
- [x] Step 2: Define metadata-free defaults for generic templates or add only the smallest required fixture metadata.
- [x] Step 3: Replace fixed `4-5 bullets` and literal section requirements in `modes/cover.md` with semantic-slot and contract language.
- [x] Step 4: Keep existing shared `cv.llm_audit` configuration and maximum two review cycles; do not create a duplicate audit setting.

**Verification:**
- [x] Inspect both Markdown templates and `modes/cover.md` for unresolved fixed-heading or filename-specific assumptions.
- Expected: templates choose presentation; workflow owns global rules; no duplicated per-template policy text exists.

**Exit Criteria:**
- A new template can be added without editing `modes/cover.md` or generator conditionals.
- Long Dang output still matches reference structure.

### Task 4: Run final regression proof

**Purpose:**
- Prove multi-template behavior, compatibility, and workspace cleanliness before any later commit or publication decision.

**Task Function:**
- Execute fresh acceptance verification and reconcile plan evidence.

**Template Profile:**
- Controller-selected: `none (lead controller)`
- Selection basis: deterministic local validation only.

**Validator Profile:**
- Controller-selected: `none`
- Selection basis: repository tests and syntax checker provide required proof.

**Specification Coverage:**
- All implementation outcomes and completion criteria.

**Required Skills:**
- `skill-verification-before-completion`

**Files And Symbols:**
- Inspect: all changed files listed in Tasks 1–3
- Modify: this plan's task ledger only after proof is accepted
- Verify: `tests/cover-*.test.mjs`, `tests/cv-templates.test.mjs`, repository syntax

**Dependencies:**
- Tasks 1–3 complete.

**Authority:**
- Preauthorized local actions: run declared local verification commands and update task evidence after results are reviewed.
- Stop for: failed required checks, unrelated workspace changes, private-data boundary uncertainty, or any need to push or clean unrelated files.

**Steps:**
- [x] Step 1: Run focused cover and resolver tests.
- [x] Step 2: Run repository JavaScript syntax checks.
- [x] Step 3: Run whitespace/diff validation and inspect staged paths if staging is later authorized.
- [x] Step 4: Record proof and remaining deviations in this plan.

**Verification:**
- [x] `node --test tests/cover-*.test.mjs tests/cv-templates.test.mjs`
- [x] `node scripts/check-syntax.mjs`
- [x] `git diff --check`
- Expected: all focused tests pass, syntax check passes, and no whitespace errors occur.

**Exit Criteria:**
- Fresh proof covers all acceptance criteria.
- Plan evidence matches repository state.
- No commit, push, or cleanup occurs without separate authorization.

## Verification

- `node --test tests/cover-*.test.mjs tests/cv-templates.test.mjs`
- `node scripts/check-syntax.mjs`
- `git diff --check`
- Manual inspection of generated Long Dang Markdown and a second bullet-style template.

## Completion Criteria

The plan is ready for completion verification when:

1. Global cover-letter policy has one configuration owner.
2. Template contracts control block count and presentation without duplicating writing rules.
3. Generator has no filename-specific cover-template branch.
4. Long Dang and generic/custom templates render from the same semantic payload.
5. Fact validation, unresolved-token checks, and optional LLM review remain shared.
6. Focused tests, syntax checks, and diff checks pass freshly.
7. No private CV facts or generated private artifacts enter public-safe files.
8. Current `.serena/` untracked files remain untouched.

The plan is complete. Commit and publication remain separate authorized actions.
