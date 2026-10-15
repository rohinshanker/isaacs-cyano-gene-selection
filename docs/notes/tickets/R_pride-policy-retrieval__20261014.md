# R_pride-policy-retrieval__20261014 — Resolved

- **Scope:** Resolve ACC-02, the unread public PRIDE data-policy page, from the gated-pages ticket.
- **Status:** resolved
- **Opened:** 2026-10-14
- **Updated:** 2026-10-14
- **Owner:** cyano-lit-unreach (`80c81443-1791314087`).

## Current State

Render the ordinary public PRIDE policy page, save retrieved text outside the
repository, mechanically match the relevant short quotation, and record its
source, date and SHA-256. Update only ACC-02 and durable access guidance.
No account, licence/admission change, site/data edit or contact with depositors
is part of this work. Stop any route that presents an access challenge.

Worktree `worktrees/pride-policy-retrieval-20261014`, branch
`work/pride-policy-retrieval-20261014`, baseline `39127dd`. Active annotation-search
and ortholog-product-reader sessions keep their scopes. The public text reader
still receives an empty JavaScript shell; a dedicated Playwright session will
render the public page. The desktop browser connector is unavailable because
its enabled surfaces are not configured.

## Verification

- Public rendered article and the exact Markdown resource requested by that
  page retrieved without an account or challenge. Source and rendered copies
  remain outside the repository; their SHA-256 values and one exact quotation
  matched mechanically. The durable receipt records UTC/local dates.
- All 59 register rows retained; only ACC-02 intake cells changed relative to
  published main. The concurrent BIO-06 correction and all historical cells
  survive integration unchanged. New document links and index entry checked.
- `npm test`: 1,635 passed. Canonical venv `python -m pytest -q`: 2,265 passed,
  23 skipped, 51 subtests. Contract validator: 130 passed, 0 failed, 1 declared
  spliced-CDS skip. These gates ran on the documentation branch before merging
  the independently tested ortholog reader.
- Ortholog reader merged cleanly from `cebdb2c`; its 37 focused tests passed
  again after integration. Final application code, datasets, tools, tests and
  configuration are identical to that published main. No UI changed.
- `git diff --check` passed. Only this session's browser was opened and closed.

## Closure and findings

Closing session: **cyano-lit-unreach**, 2026-10-14 local (2026-10-15 UTC).

- **ACC-02 resolved by `0b5b86a`:** the previously unread policy is now verified
  with both a rendered article receipt and a direct public source route.
- No open finding or outstanding audit exists against this bounded retrieval.
  A GitHub API lookup returned 404; it supplied no evidence and is not a
  dependency of the verified EMBL-EBI source route (`a6367f9`).
- The parent ticket stays open for its other access findings. No source access
  permission, retained licence fact or admission decision was silently changed.

## Cleanup

Reusable source pins, quote, retrieval route, checks and evidence boundaries
live in `docs/validation/pride-policy-access.md`, with links from the validation
index, handoff contract, parent ticket and historical register. Remove this
queue row and delete the resolved ticket last. Keep the private source receipt
and other sessions' worktrees.
