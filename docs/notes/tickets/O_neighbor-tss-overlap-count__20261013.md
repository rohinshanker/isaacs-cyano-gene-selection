# O_neighbor-tss-overlap-count__20261013 — Open

Scope: Show and use the number of distinct neighbouring-gene TSS sites inside each gene's CDS, including both same- and opposite-strand TSSs.
Status: open
Opened: 2026-10-13
Updated: 2026-10-13

## Current State

Requested by the owner; implementation is unassigned and has not started.
The detail panels already show a distinct-site count, but the neighbouring-gene
TSS colour mode uses categorical zero versus one-or-more, plus unavailable.
Reuse the existing `neighbor-sites.js` relation count and admitted site identity;
the shared relation already includes sites from either strand.
See [the current contract](../../validation/neighbor-regulatory-sites.md).

## Acceptance

- Expose the actual nonnegative integer overlap count in both Colour by selectors
  and their scales/legends, so genes with 1, 2 or many sites are distinguishable.
  Keep the option in the first Genomic context group.
- Support inclusive minimum/maximum count filtering. Preserve the existing
  any/with/without/unavailable choices as compatible shortcuts or migrate their
  saved state explicitly; old categorical values must not silently become counts.
- The displayed total includes TSSs on both the same and opposite strands
  relative to the focal CDS. A gene with two same-strand and three opposite-strand
  sites therefore has a total of five. Determine the strand relation from the
  site's strand and the focal gene's strand, not the associated owner's strand.
- Count distinct admitted sites, not source rows, conditions or associated genes.
  Repeated conditions/multiple owners of one site count once. Preserve the
  source/type/replicon/base/strand identity: opposite-strand sites at the same
  coordinate remain distinct. Self-only and unresolved associations retain their
  existing exclusion rules; any resolved other-gene association qualifies.
- Count points inside the union of actual CDS segments, with inclusive boundaries;
  exclude coding gaps and display padding. Preserve split-CDS, circular-origin
  and source-owner rules, as well as the existing strand labels in the site lists.
- Use the same total in colouring, filters, gene summaries, both compact gene
  viewers, the expanded sequence view and applicable exports/saved views.
  Missing, failed, loading or disabled evidence stays unavailable, not zero.
  Display zoom, hidden marks or filtered-out neighbouring genes must not alter it.
- Keep the admitted Tan 2018 TSS evidence and exact-base line/underline rendering.
  The count describes recorded sites inside the CDS, not demonstrated regulation.
  No RBS coordinates or transferred predictions are introduced by this ticket.

## Verification

Ticket creation: checked the queue for duplicates and confirmed the existing
relation count, categorical colour values and strand labels in the core/UI code.
Implementation must test 0/1/multiple sites, mixed strands, coincident opposite
strands, duplicate conditions/owners, unavailable evidence, segment boundaries,
saved-state compatibility and count-filter/colour/export agreement. Compare
counts against an independent enumeration of the shipped site/CDS relationships.
Run the repository's three gates (`npm test`, `.venv/bin/python -m pytest -q`,
`.venv/bin/python tools/validate_contract.py`) and rendered mobile/tablet/desktop
checks using the UI skill, including both colour selectors and gene viewers.

## Cleanup

The implementing session claims ownership before editing shared code. Resolve
only after every finding is accounted for; distill reusable count and saved-state
contracts into the existing validation guidance, update its index, then remove
this ticket and its queue row according to AGENTS.md. Leave other sessions' work
and the separate regulatory-method/RBS tickets untouched.
