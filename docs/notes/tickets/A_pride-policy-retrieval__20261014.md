# A_pride-policy-retrieval__20261014 — Active

- **Scope:** Resolve ACC-02, the unread public PRIDE data-policy page, from the gated-pages ticket.
- **Status:** active
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

Pending public text retrieval, source-quote/hash checks, register consistency and
required repository gates. Access evidence is distinct from a data-use decision.

## Cleanup

The owner will name all findings before closure, preserve reusable access/source
receipts in docs/validation, rename to resolved, remove the queue row and delete
the resolved ticket last. Keep the parent ticket's other access findings open.
