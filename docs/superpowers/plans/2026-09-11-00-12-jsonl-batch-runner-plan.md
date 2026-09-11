---
artifact_type: plan
template_id: implementation-plan
contract_version: "1"
status: active
layer: change
name: jsonl-batch-runner-input
targets:
  - batch/batch-runner.sh
  - batch/batch-prompt.md
  - batch/README.md
  - modes/batch.md
  - tests/batch-jsonl-input.test.mjs
---

# JSONL Batch Runner Input

## Goal

Allow batch processing to consume captured JSONL job records directly, using
`raw_job.description` as the canonical JD and avoiding URL retrieval whenever
that description is present. Preserve existing TSV input, state, retry,
report, tracker, merge, and resume behavior.

## Implementation Outcomes

### Direct captured-JD processing

`batch/batch-runner.sh` accepts `--jsonl PATH`, validates the captured records,
passes each non-empty `raw_job.description` to the existing worker `JD_FILE`
contract, and skips `curl` and WebFetch for those records. Missing descriptions
retain current URL-fetch fallback behavior.

### Stable, disposable batch execution

JSONL rows use `raw_job.id` as the numeric batch ID when available, otherwise
the input line number. Duplicate IDs or URLs fail before workers start. The
runner creates only temporary normalized input and JD files, removes them on
exit, and leaves `data.private/jobs.filtered.jsonl` unchanged.

### Maintained workflow proof

Documentation describes direct JSONL usage, and regression coverage proves
local JD delivery, network-fetch bypass, validation failures, dry-run behavior,
and unchanged legacy TSV behavior.

## Execution Approach

- Mode: `inline sequential`
- Coordination: `none`
- Required skills: `skill-code-standards`, `skill-test-driven-development`, `skill-verification-before-completion`
- Isolation: `current workspace`
- Commit policy: `no commits during execution`
- Preauthorized local actions: edit listed implementation, documentation, and test files; run declared local checks
- User-approval actions: external network access, authentication, batch execution against real jobs, edits to `data.private`, reports, output, tracker, or batch state
- Parallel ownership: none
- Sequential fallback: implement runner contract first, then tests, then documentation and final verification

## Task Breakdown

### Task 1: Add direct JSONL ingestion and local-JD bypass

**Purpose:**
- Add one maintained input path without adding a standalone converter or changing the worker prompt contract.

**Task Function:**
- Extend existing batch orchestration with validated JSONL normalization and local JD selection.

**Template Profile:**
- Controller-selected: `none (lead controller)`
- Selection basis: bounded shell/Node integration with existing state and cleanup logic.

**Validator Profile:**
- Controller-selected: `none`
- Selection basis: focused regression suite runs after implementation.

**Specification Coverage:**
- Direct `--jsonl PATH` input.
- `raw_job.description` canonical JD.
- URL fallback only when local description is absent.
- `descriptionHtml` and `enriched_job` ignored.
- No permanent intermediate files.
- Existing TSV mode unchanged.

**Required Skills:**
- `skill-code-standards`

**Files And Symbols:**
- Inspect: `batch/batch-runner.sh:usage`, argument parser, `process_offer`, `main`, cleanup paths
- Modify: `batch/batch-runner.sh:usage`, argument parser, `process_offer`, `main`
- Verify: `batch/batch-runner.sh`, temporary manifest/JD cleanup, `batch/batch-state.tsv` behavior

**Dependencies:**
- Existing `batch/batch-prompt.md` `JD_FILE` contract remains the worker boundary.
- Existing TSV input and state format remain backward-compatible.

**Authority:**
- Preauthorized local actions: edit `batch/batch-runner.sh` and run focused fixture checks
- Stop for: changes to user-layer data, live batch execution, external network/authentication, or unrelated runner behavior

**Steps:**
- [x] Step 1: Add `--jsonl PATH` parsing, path validation, help text, and mutually exclusive input selection.
- [x] Step 2: Add one embedded Node normalization pass that streams JSONL, validates JSON, resolves URL and stable ID, rejects duplicate IDs/URLs, writes sanitized notes, and writes `raw_job.description` to run-owned temporary JD files.
- [x] Step 3: Extend `process_offer` and the input loop with an optional local JD path; bypass URL prefetch when the local JD is non-empty and preserve current fallback for missing JD text.
- [x] Step 4: Add cleanup for temporary manifest/JD resources on success, failure, interruption, and dry-run.
- [x] Step 5: Accept native Windows JSONL paths when invoked from Git Bash without requiring path conversion by the caller.

**Verification:**
- [x] `bash batch/batch-runner.sh --jsonl <fixture> --dry-run --limit 2`
- [x] `"C:\\Program Files\\Git\\bin\\bash.exe" -lc 'bash batch/batch-runner.sh --jsonl "C:\\Users\\HOANG PHI LONG DANG\\repos\\career-ops\\data.private\\jobs.filtered.jsonl" --dry-run --limit 2'`
- Expected: two normalized jobs listed; no worker, `curl`, report, tracker, or persistent temp-file activity.

**Exit Criteria:**
- JSONL mode works through the existing orchestration path, validates before worker launch, bypasses network fetch for captured descriptions, and leaves TSV mode unchanged.

### Task 2: Add regression tests

**Purpose:**
- Leave one runnable proof for the new parser and network-bypass behavior.

**Task Function:**
- Build isolated fixture tests around the real shell runner and fake worker dependencies.

**Template Profile:**
- Controller-selected: `none (lead controller)`
- Selection basis: small deterministic test fixture with no live services.

**Validator Profile:**
- Controller-selected: `none`
- Selection basis: test itself supplies focused executable proof.

**Specification Coverage:**
- Valid JSONL ingestion.
- Exact local JD delivery.
- No `curl` invocation for captured JDs.
- Dry-run and malformed-input safety.
- Duplicate ID/URL rejection.
- Missing-description URL fallback.
- Legacy TSV regression.

**Required Skills:**
- `skill-test-driven-development`

**Files And Symbols:**
- Inspect: `test-all.mjs` test discovery and existing batch fixture patterns
- Modify: `tests/batch-jsonl-input.test.mjs`
- Verify: `tests/batch-jsonl-input.test.mjs`

**Dependencies:**
- Task 1 runner flags and normalized local-JD behavior.
- Tests must use temporary directories and fake `claude`/`curl` binaries; no real job URLs.

**Authority:**
- Preauthorized local actions: add `tests/batch-jsonl-input.test.mjs` and run focused test commands
- Stop for: live worker execution, network access, edits outside the listed test and runner surfaces

**Steps:**
- [x] Step 1: Create two-row fixture with distinct descriptions, duplicated derived fields, stable `raw_job.id`, and top-level `job_url`.
- [x] Step 2: Run the real runner in dry-run mode and assert both records are selected without side effects.
- [x] Step 3: Run an isolated fake-worker batch and assert worker prompt JD content equals `raw_job.description` and fake `curl` remains untouched.
- [x] Step 4: Assert malformed JSON, missing URL, and duplicate identifiers fail before worker launch; existing prefetch regression coverage preserves missing-description URL fallback.
- [x] Step 5: Run one legacy TSV fixture through the same runner and assert existing selection/state behavior remains valid.

**Verification:**
- [x] `node --test tests/batch-jsonl-input.test.mjs`
- Expected: focused suite passes with no writes outside its temporary fixture directory.

**Exit Criteria:**
- Regression suite fails if local JD content is altered, network fetch resumes for captured JDs, validation weakens, or TSV compatibility breaks.

### Task 3: Align batch documentation

**Purpose:**
- Make direct JSONL usage discoverable and prevent future manual URL-only conversion.

**Task Function:**
- Update maintained batch instructions to match the implemented runner contract.

**Template Profile:**
- Controller-selected: `none (lead controller)`
- Selection basis: documentation-only alignment after code and tests establish behavior.

**Validator Profile:**
- Controller-selected: `none`
- Selection basis: final command and text inspection.

**Specification Coverage:**
- Document `--jsonl PATH`.
- Identify `raw_job.description` as canonical.
- Document URL fallback and temporary-file lifecycle.
- Preserve TSV workflow documentation.

**Required Skills:**
- `none`

**Files And Symbols:**
- Inspect: `batch/README.md:Quick Start`, `batch/README.md:Options`, `modes/batch.md:Mode B`
- Modify: `batch/README.md`, `modes/batch.md`
- Verify: both documentation files and runner `--help` output

**Dependencies:**
- Tasks 1 and 2 complete.

**Authority:**
- Preauthorized local actions: edit `batch/README.md` and `modes/batch.md`; run documentation and help checks
- Stop for: edits to generated `AGENTS.md`, user data, or unrelated documentation

**Steps:**
- [x] Step 1: Add JSONL dry-run and execution examples using the captured input path.
- [x] Step 2: Document field precedence: `job_url`, `raw_job.description`, `raw_job.companyName`, `raw_job.title`, `raw_job.location`.
- [x] Step 3: Document fallback, validation failures, cleanup, and unchanged TSV support.

**Verification:**
- [x] `bash batch/batch-runner.sh --help`
- Expected: help lists `--jsonl PATH` and describes captured-JD behavior.

**Exit Criteria:**
- Documentation matches implemented flags and does not instruct users to manually convert captured JSONL into URL-only TSV.

## Verification

- `node --test tests/batch-jsonl-input.test.mjs`
- `node test-all.mjs --quick`
- `bash batch/batch-runner.sh --help`
- `"C:\\Program Files\\Git\\bin\\bash.exe" -lc 'bash batch/batch-runner.sh --jsonl "C:\\Users\\HOANG PHI LONG DANG\\repos\\career-ops\\data.private\\jobs.filtered.jsonl" --dry-run --limit 2'`
- `git diff --check`
- Inspect `git status --short` and confirm only approved implementation, documentation, test, and plan files changed; preserve pre-existing `.serena/` and `templates/cover-letter-template.reverse-timeline.css` worktree entries.

Verification note: `node test-all.mjs --quick` and the full `tests/batch-*.test.mjs` sweep are blocked by missing installed packages `js-yaml` and `@google/generative-ai`; focused JSONL and adjacent batch suites pass. Native Windows-path dry-run passes under Git Bash; WSL `bash` is not a supported execution shell here because it cannot resolve Windows `node` as `node`.

## Completion Criteria

The plan is ready for completion verification when:

1. `--jsonl PATH` processes captured records without URL retrieval for non-empty `raw_job.description`.
2. Validation rejects malformed JSON, missing URL, and duplicate IDs/URLs before workers start.
3. Existing TSV input, state, retry, report, tracker, merge, and resume behavior remains valid.
4. Temporary normalized input and JD files are cleaned on all exit paths.
5. Focused and broad checks pass with fresh output.
6. Documentation and tests match current source behavior.
7. No user-layer data or generated `AGENTS.md` files change.
