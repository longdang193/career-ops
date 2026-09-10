# Shared Mode: cv-audit — Optional LLM CV Validation

Run when the invocation carries `--llm-audit`, the legacy PDF flag
`--hm-audit`, `cv.llm_audit.enabled` is true, or `modes/_custom.md` explicitly
enables the audit. Off by default: it adds model cost and may expose tailored
professional content to an external reviewer.

## Configuration

Read `cv.llm_audit` from `config/profile.yml` once per run:

- `enabled` defaults to `false`.
- `max_cycles` defaults to `2`.
- Invalid or non-positive `max_cycles` falls back to `2` and adds a warning.
- Effective `max_review_cycles` is capped at `2`; never launch cycle 3.
- `--llm-audit` and `--hm-audit` enable the audit for the current run and
  override `enabled: false`.

The profile is the SSOT for persistent audit policy. CLI flags are run-scoped
overrides, not profile mutations.

## Purpose

Review a job-tailored CV before final delivery. The audit judges relevance,
clarity, evidence strength, seniority fit, and recruiter readability. It does
not replace deterministic fact or ATS checks.

## Source Boundary

- Read `cv.md` as the canonical CV source.
- Audit the tailored artifact, never `cv.md` by itself.
- Use the JD and `jd-skill-gap.mjs` result as role context.
- Never modify `cv.md` from audit output.
- Never treat an LLM recommendation as evidence of a skill or achievement.

## Required Order

Run this workflow after tailoring and after deterministic checks available for
the parent mode:

```text
tailored CV
→ deterministic source/fact checks
→ verify-ats.mjs (advisory for HTML/PDF when available)
→ optional LLM audit
→ user decision
→ final Markdown/PDF
```

For PDF/HTML, `verify-cv-facts.mjs` is a hard gate before the audit. For
Markdown, use the parent mode's source-boundary checks and do not claim that an
HTML-only fact gate or ATS check passed. If an available fact gate fails, stop
before the LLM audit. If the skill-gap result is low-confidence, disclose that
limitation; empty buckets do not prove fit.

## Inputs

1. The current tailored Markdown, HTML, or structured render payload.
2. The archived JD or evaluation report.
3. `cv.md` and the factual scope files loaded by the parent mode.
4. The `jd-skill-gap.mjs` result, including `existing`,
   `supportedByResume`, and `gap` buckets.

Never parse the final PDF as the primary audit input. Use the Markdown or
structured source that produced it.

## Reviewer

Use a separate reviewer agent when the runtime supports one. The reviewer must
not be the agent that wrote the tailored CV. If no separate reviewer exists,
run inline only as a degraded audit and state that limitation in the result.

Send only the minimum role and professional content needed. Remove contact
details, private paths, personal social accounts, credentials, and unrelated
personal data before an external model call.

Reviewer instruction:

> You may recommend cutting or reframing any content. You may never recommend
> a claim the source files do not support. If a requirement is unmet, report it
> as unmet; do not invent coverage. Return one finding for every audited
> experience or project bullet.

## Checks

Evaluate:

- requirement coverage against the JD
- evidence strength and specificity
- summary relevance and target-role clarity
- keyword naturalness without stuffing
- bullet prioritization and outcome focus
- seniority and scope fit
- contradictions, ambiguity, and missing sections
- readability for a fast recruiter scan

## Result Contract

Return structured data before presenting prose:

```json
{
  "schema_version": "cv-audit.v1",
  "status": "pass | review | fail",
  "score": 1,
  "review_cycle": 1,
  "max_review_cycles": 2,
  "artifact_hash": "sha256:<hex>",
  "review_mode": "external | inline-degraded",
  "audited_artifact": "path",
  "blocking_issues": [],
  "warnings": [],
  "section_findings": [],
  "bullet_findings": [],
  "recommended_changes": []
}
```

`score` is an integer from 1 to 5. `bullet_findings` must contain exactly one
row per audited bullet. Missing or malformed rows invalidate the audit; do not
accept a partial review.

## Gate Semantics

- `pass`: no blocking issue; final delivery may continue.
- `review`: user decision required; recommendations remain advisory.
- `fail`: final delivery stops until the blocking issue is resolved or the user
  explicitly overrides it.

An LLM audit never overrides `gap`, fact-gate failures, privacy checks, or
explicit user constraints.

## User Decision

Present the complete result before applying any recommendation. The user may:

- accept selected rewrites
- reject all rewrites
- request another audit
- stop generation

Cycle policy:

1. Cycle 1 audits the initial tailored artifact.
2. `pass` finalizes the artifact without another cycle.
3. `review` requires the user's decision. Rejecting recommendations finalizes
   the current artifact; accepting rewrites regenerates the derived artifact,
   reruns all deterministic checks, and starts the next cycle only when
   `review_cycle < max_review_cycles`.
4. `fail` blocks delivery until its blocking issue is resolved or the user
   explicitly overrides it. A resolved issue follows the same cycle budget.
5. After cycle 2, stop auditing. Never launch cycle 3; present the final
   result and require the user's delivery decision if status remains `review`.

Never silently apply rewrites. Recompute `artifact_hash` for every cycle using
the SHA-256 hash of the audited source artifact.

## Persistence

- Report-backed run: replace one `## CV Audit` section in the report after the
  user decision. Never append duplicate audit sections.
- Persist `review_cycle`, `max_review_cycles`, and `artifact_hash` with the
  audit result so the judged artifact remains identifiable.
- Legacy PDF `--hm-audit` runs may keep the existing `## HM Audit` section;
  write one audit section for the run, not both.
- Standalone run: write the audit beside the derived artifact as
  `output/cv-{candidate}-{company}-{YYYY-MM-DD}.audit.json`.
- Do not write audit results into `cv.md`.

## Non-Goals

- factual verification — `verify-cv-facts.mjs` owns this
- ATS structure scoring — `verify-ats.mjs` owns this
- automatic CV rewriting
- automatic publication, submission, or email delivery
- auditing the untailored canonical CV
