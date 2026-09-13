# Custom Instructions -- career-ops

<!-- ============================================================
     THIS FILE IS YOURS. It will NEVER be auto-updated.

     Put your own house rules, custom workflows, and automations
     here -- anything you want the agent to ALWAYS do (or never do).

     This is for PROCEDURAL rules ("HOW I want things done").
     For WHO you are (archetypes, narrative, comp, negotiation),
     use modes/_profile.md instead. Keeping the two separate keeps
     each one readable.

     The agent reads this file alongside the system instructions;
     your rules here take precedence over the defaults, as long as
     they don't break the Data Contract (your files are never
     touched, and we never auto-submit an application for you).

     Because this is a user-layer file, anything you write here
     survives `node update-system.mjs`. Put customizations HERE,
     not in CLAUDE.md / modes/_shared.md / other system files --
     those get overwritten on update.
     ============================================================ -->

## House Rules

<!-- Rules the agent should always follow. Examples:
     - Always write evaluation summaries in British English.
     - Never include a photo in my CV (US / ATS-first market).
     - Cap each batch run at 20 listings unless I say otherwise.
     - If a report scores below 6, skip the cover letter. -->

(none yet -- add yours above)

## Custom Workflows

<!-- Multi-step routines you run often, given a short name. Examples:
     - "weekly review": scan my saved portals, evaluate the new roles,
       then give me a one-paragraph summary of the top 3.
     - "prep <company>": pull the JD, generate STAR stories from
       article-digest.md, and draft 5 likely interview questions. -->

(none yet -- add yours above)

## Output Preferences

<!-- How you like results formatted. Examples:
     - Reports: lead with the score and the one-line verdict.
     - Show the per-step token breakdown after a batch run.
     - Save PDFs date-first: YYYY-MM-DD-company.pdf -->

(none yet -- add yours above)

## Tailored Batch Generation Contract

Use one `raw_job` record as the batch job SSOT:

- `raw_job.id` is stable job identity.
- `raw_job.url` is display-only; never fetch, retrieve, resolve, or open the URL.
- `raw_job.description` is canonical JD content.
- Candidate facts come only from approved current source files.
- Active document limits and policies come from the configured profile; do not hardcode them.

Generate CV and cover letter as one symmetric artifact pair. Derive both paths
from the same job identity and slug function. Validate both in memory before
writing. Never write one artifact without its pair. Write both atomically under
the private `output/` directory.

Every job uses one read-only report row with these fields:

`job_id`, `company`, `title`, `jd_url`, `cv_path`, `cover_letter_path`,
`status`, `validation`, `llm_audit`, `skipped_existing`, `failed_partial`,
`reason`

Allowed statuses: `created`, `skipped_existing`, `failed`, `failed_partial`.
Allowed validation states: `pass`, `fail`, `not-run`.
Allowed audit states: `pass`, `review`, `fail`, `not-run`.

Existing pairs are skipped only after fresh validation. Partial or invalid pairs
fail with exact stage and reason; never silently overwrite them. Use `not provided`
for missing URLs and `not created` for missing artifacts. Do not create a second
tracker or manifest as another source of truth.

## Off-Limits

<!-- Things the agent must never do for you. Examples:
     - Never auto-fill or submit an application without showing me first.
     - Never edit a system file to customize my setup -- put it here. -->

(none yet -- add yours above)
