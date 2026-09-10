---
name: skill-private-data-handling
description: Use when storing, editing, versioning, exporting, or publishing personal data, candidate records, CVs, job applications, contracts, contact lists, or other PII.
distribution_tier: starter_kit
---

# Private Data Handling

## Overview

Keep private data in one canonical source, version it locally when useful, and
publish only an explicitly allowlisted public projection. Default action is
local-only; public publication requires a boundary check and explicit intent.

## When to Use

Use this skill before:

- creating or changing files containing personal data or third-party PII
- committing ignored personal files with `git add -f`
- generating CVs, applications, reports, or other derived artifacts
- copying data between a private workspace and a public repository
- pushing a branch that may contain private history

Do not use it for ordinary public source files with no personal or sensitive
content.

## Source Ownership

Assign one owner before writing. Do not maintain two authored copies of the
same fact.

| Responsibility | Owner | Rule |
|---|---|---|
| Canonical CV content and layout | `cv.md` | User-edited source of truth |
| Runtime preferences | `config/profile.yml` | Settings only; no duplicated CV narrative |
| Structured evidence | `data.private/` | Read-only validation input unless explicitly updated |
| Public template | `templates/` | Generic placeholders; no candidate PII |
| Generated artifacts | `output/`, `reports/` | Derived, disposable, ignored |

For career-ops, never overwrite `cv.md` from an attached template, generated
PDF, HTML file, YAML profile, or job-specific variant.

## Handling Rules

1. **Classify first.** Mark content `private`, `public-safe`, `derived`, or
   `unknown`. Treat `unknown` as `private`.
2. **Write to the owner.** Update the canonical source only when the user asks
   to change source content. Write variants and generated files elsewhere.
3. **Keep private by default.** Ignore personal files and do not upload, push,
   or send them to external tools without explicit user intent.
4. **Version locally when useful.** Track private files on a local branch with
   no upstream. Never push that branch.
5. **Publish by allowlist.** Export or cherry-pick only reviewed public-safe
   files. Do not copy the whole workspace and delete private files afterward.
6. **Validate before push.** Inspect staged paths and content. Any private path,
   PII match, secret, local path, or unresolved classification blocks push.
7. **Verify after push.** Confirm remote commit file list and public content;
   do not assume a successful push means safe publication.

## Symmetric Lifecycle

Use same shape for CVs, applications, job data, contacts, reports, and
interview material:

```text
private source → local commit → boundary check → derived output
public-safe source → allowlisted commit → boundary check → public push
```

No reverse sync from public output into private source. No generated artifact
becomes canonical automatically.

## Git Procedure

For local-only versioning:

```powershell
git switch -c private/<purpose>
git add -f -- <intended-private-file>
git commit -m "chore(local): save private data"
git branch --unset-upstream private/<purpose>
git config branch.private/<purpose>.remote ''
```

Before public publication:

```powershell
git diff --cached --name-only
git diff --cached --check
git status --short --ignored
```

If private content is in the commit ancestry, do not push that branch. Create a
public-safe commit from the public branch using an allowlist, then push only
that public branch.

## Boundary Rules

Block publication when any staged path contains or derives from:

- `cv.md`, `config/profile.yml`, `data.private/`, `documents/`
- `output/`, `reports/`, `interview-prep/`, trackers, or contact exports
- `.env`, credentials, tokens, cookies, local paths, or debug logs
- email addresses, phone numbers, home addresses, identity numbers, or
  third-party personal details

Generic templates may publish only after checking that they contain no real
names, contact details, URLs tied to a person, private filesystem paths, or
candidate-specific claims.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Treating `.gitignore` as history protection | Use a local branch and inspect commits |
| Using `git add -f` without classification | Stop; classify file and confirm owner first |
| Copying `cv.md` into a public template | Replace facts with placeholders |
| Committing private data, then deleting it | Rewrite or discard the private branch; deletion is not redaction |
| Pushing current branch because working tree looks clean | Inspect branch ancestry and upstream first |
| Keeping `config/profile.yml` as a second CV | Keep runtime settings only; read CV content from `cv.md` |

## Stop Conditions

Stop and ask for explicit confirmation when:

- user intent to publish personal data is ambiguous
- source ownership conflicts
- a public-safe rewrite would remove evidence or change meaning
- a private commit is already reachable from the branch being pushed
- an external tool would receive personal data

## Minimal Maintenance Rule

Prefer existing `.gitignore`, local branches, and one boundary check. Add a
dedicated export script only after repeated manual publication creates a proven
error pattern.
