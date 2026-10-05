# O_gated-pages-and-accounts__20261005 — Open

- **Scope:** Workarounds for sources that refuse an automated reader for a reason
  other than a paywall: a CAPTCHA, a script-rendered page, page-view metering, a
  missing account, or terms that were never published. Covers `docs/` only.
- **Status:** open
- **Opened:** 2026-10-05
- **Updated:** 2026-10-05

## Current state

Opened at the owner's request. None of these blocks a current licence decision
except BioCyc, which gates the BioCyc tickets. The scope questions for BioCyc stay
in those tickets; this one holds only the access route. Register rows covered:
ACC-01, ACC-02, ACC-04, ACC-06, BIO-01 to BIO-03, BIO-07, LIC-01, LIC-02.

## Work

| Source | What refuses | Manual workaround | Automated workaround |
| --- | --- | --- | --- |
| GEO disclaimer and FAQ pages | reCAPTCHA, confirmed again 2026-10-05 | Owner saves the two pages with the date | None. A CAPTCHA is not automated. Low value: the parent NCBI policies page is already quoted and checksummed |
| PRIDE data policy page | script-rendered; a plain fetch gets an empty shell, confirmed 2026-10-05 | Owner saves the page | The agents' browser tooling renders the public page and saves its text with date and checksum. No login, no check to pass |
| NUPACK 2.0 licence page | script-rendered | Owner saves the page | Same browser render. Gates the RBS Calculator ticket's licence decision |
| BioCyc summary pages | page-view metering redirects to an account page | Owner logs in with their own account in their own browser, checks whether Yale holds a subscription, and exports the wanted pages or files | None. No agent creates an account or drives a logged-in session. If the owner later wants an agent to use a session, that is a separate, disclosed decision, after the BioCyc terms are quoted |
| BioCyc and KEGG reuse terms | never quoted | — | The public licence pages are readable. Queue a terms-quotation claim; the permission decision is the ledger's |
| GtRNAdb, GSE225426, GSE311172 | no terms published anywhere | Owner writes to the maintainers or depositors; a draft is prepared for each. A reply is quoted with its date | None |
| Deployed site against the audited tree | never compared | — | The agents fetch the deployed bundle and compare file hashes with the tree. Entirely in-repository work |

## Decisions for the owner

- **BioCyc, decided 2026-10-05.** The owner will sign in to their own account in a
  browser window opened for the purpose, and an agent then reads or exports the
  wanted pages in that session with the owner present. The agent never sees or
  stores the password, creates no account, and saves nothing tied to the login
  into the repository. Before the session: the agent names the exact pages, and
  BioCyc's published terms are read and quoted. Which strains and layers are wanted
  still follows the open scope questions in the BioCyc tickets.
- Whether to send the three terms requests. They cost one email each and are the
  only route for those sources.

## Verification

Not started. A rendered page is saved outside the working tree with its retrieval
date and SHA-256, and any quotation from it is re-matched against the saved text.
Any step needing a credential is named to the owner first, with the exact action
and reason. A ledger row changes only on quoted terms.

## Cleanup

On resolution, record the working routes in
[claude-science-handoff.md](../../validation/claude-science-handoff.md), then delete
this ticket and its index row.
