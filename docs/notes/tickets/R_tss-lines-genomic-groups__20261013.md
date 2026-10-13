# R_tss-lines-genomic-groups__20261013 — Resolved

Scope: Purple neighbouring-TSS lines, exact-base underlines and genomic colour grouping.
Status: resolved
Opened: 2026-10-13
Updated: 2026-10-13

## Outcome

Closed by owning session `cyano-regulatory-sites` on 2026-10-13.
Purple lines replace neighbouring-TSS diamonds in the chromosome and both compact
gene viewers. Expanded Original/Recoded rows underline exactly the recorded
source base. The 5′/3′/summed overlap colours are in the first Genomic context
group; the lower distance/operon group is Genomic neighborhood. Keys, values,
source data and counts remain unchanged. No RBS coordinate layer was invented.

Every finding is resolved; none remain open:
- TL-1: stable zoom limits, resolved in `edf2eee`.
- TL-R1: visible active chromosome focus on purple CDS, resolved in `a6642ce`.
- TL-R2: keyboard/button zoom-limit feedback, resolved in `a6642ce`.
Independent review DEM-392 accepted exact `9657b8d` and both repair findings.

## Verification

At `9657b8d`: 1,584 JavaScript tests passed; 1,751 Python tests passed with
16 skips and 51 subtests; contract 130 passed, zero failures, one declared
split-CDS exemption. Whitespace and 105 relative documentation links passed.
Local rendered checks covered 375/768/959/961/1239/1241/1280/1440 px, both colour
selectors across all six organisms, exact-base geometry, source/visibility
states, keyboard navigation and saved values. Review independently matched all
805 site/CDS relationships over 603 genes to RefSeq bases, including recoding,
and checked active contrast at 1×/2× with 4× worker evidence.

Published code `25c0635` passed GitHub validation and deployment (run
38424519536). All six changed website files match the live server byte-for-byte.
Live checks passed both colour selectors and three plus/minus/mapped-site
examples at 375/1280 px, readable one-base Original/Recoded underlines, active
focus, and fixed-camera zoom feedback, with no console/page/request errors.
The cold page's data downloads exceeded the initial 30-second test wait; the
final live check used the fully loaded page and reset the camera explicitly.
Screenshots were inspected. Evidence: `/tmp/cyano-tss-lines-20261013/`.

## Cleanup

Reusable contracts and checks live in `docs/validation/neighbor-regulatory-sites.md`,
`overlap-length.md` and `gene-sequence-closeup.md`; their index is current.
The queue row is removed. No unique reusable guidance remains in this ticket.
Delete this resolved file last. The owning workers/reviewer closed their tools;
other sessions, tickets and worktrees were not modified.
