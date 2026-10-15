# R_comparability-lab-judgements__20261005 — Resolved

- **Scope:** Record the owner's comparability decisions and keep the contract,
  source decisions and emitted site metadata consistent; admit or pool no data.
- **Status:** resolved
- **Opened:** 2026-10-05
- **Updated:** 2026-10-14

## Outcome

Closed by **cyano-regulatory-sites**, 2026-10-14, from isolated branch
`work/comparability-decisions-20261014`. The other session's filter/viewer work
is untouched. Source, emitted metadata and replay now record Rohin's explicit
2026-10-14 decision: pairs 7 and 8 stay separate. Pairs 11/30 retain authorized
extrapolations; 26/27 retain unresolved light conditions; J2 pair 33 remains
conditional with unknown temperature. No source values or default scientific
verdicts changed.

J1–J10 answers are recorded in the lab decision document, contracts and source
JSON. Package D intake passed on 2026-10-06; Package E has been reproduced under
[the pilot evidence contract](../../validation/comparability-pilot-evidence.md).
This ticket's review/intake work does not include implementing the separate
array reader, raw-read pilot, general annotation browser or source-admission work.
The hosted review-page proposal remains optional and unapproved in
[pair-review intake](../../validation/pair-review-intake.md).

## Findings and remaining work

All register findings in this ticket are reconciled by `ac5f1d7` (decision
recording; the underlying implementations were already shipped):

| Finding | Resolution and retained boundary |
| --- | --- |
| MET-04 | `ac5f1d7`: J3 accepts OD730/A730 alongside OD750 |
| MET-05 | `ac5f1d7`: J1 is a recorded owner spectrum judgement; source lamp identity remains unknown, not a missing owner decision |
| MET-06 | `ac5f1d7`: J4 rejects a fixed narrow-miss boundary |
| MET-07 | `ac5f1d7`: J5 settled; optional source-specific array pooling remains in its separate open reader ticket |
| MET-11 | `ac5f1d7`: J9/type decision settled; `86de3c9` explicitly preserves the proposed P4 sweep under open OWN-13 in the historical register |
| OWN-11 | `ac5f1d7`: selector defaults/conflicts settled by the existing design; D10 settles PCA/reference scope, with annotation implementation still in the cross-strain ticket |
| OWN-12 | `ac5f1d7`: default screening and lab pair decisions are distinct in the contract |

Independent review DEM-409 accepted the data change through `37efb68` and found:

| Finding | Resolution |
| --- | --- |
| DEM-409-1, J2 sent-state loss | `86de3c9`: preserve repository record `3bd7dd0` that owner sent the query on 2026-10-07, await reply, prevent duplicate send; confirmed in review |
| DEM-409-2, blank J10 answer | `86de3c9`: explicit reviewer/date and pairs 7/8 answer; confirmed in review |
| DEM-409-3, stale agreement metadata pin | `018ddaa`: regenerate agreement provenance and manifest; all agreement statistics unchanged |
| DEM-409-fix-1, sent-versus-expanded query scope | `a8c6eac`: distinguish the historical temperature/lamp email from the unsent expanded GSE50922/GSM/protocol draft; confirmed by the original reviewer |
| DEM-409-fix-2, correspondence Updated date | `a8c6eac`: correct Updated to 2026-10-14; confirmed by the original reviewer |

Source-condition unknowns and optional author replies remain with the existing
[correspondence ticket](O_depositor-condition-correspondence__20261007.md).
No new messages were sent; the recorded 2026-10-07 send is repository evidence,
not a new mailbox verification. No audit finding against this work remains open. Source uncertainties and
separate implementation scopes are retained, not asserted resolved.

## Verification

Final data/metadata gates on `018ddaa`:

- `npm test`: 1,597 passed.
- `.venv/bin/python -m pytest -q`: 2,080 passed, 20 skipped, 51 subtests passed.
- `.venv/bin/python tools/validate_contract.py`: 130 passed, 0 failed, 1 declared skip.
- Focused decision/intake tests: 265 passed; promotion/pair/replay tests: 157 passed.
- Structural diff: only pair 7/8 calls changed in site metadata; only their owner
  call/entry changed in the 941-row replay. Gap ranking, all scientific axes and
  verdicts, source measurements and agreement statistics are unchanged.
- Independent review rechecked the source-to-site projection, all 21 manifest
  entries, agreement provenance and changed Markdown links. Both calls take the
  same existing grouping branch; no visible UI or UI source changed.
- Later commits contain documentation only. All 21 queue tickets have required
  metadata/index entries; changed Markdown links resolve and diff whitespace checks pass.

## Cleanup

Closed by **cyano-regulatory-sites**, 2026-10-14. Independent review DEM-409
confirmed both final wording fixes at `a8c6eac`; no further findings remain. Reusable workflow, dependency refresh order and review
boundaries are distilled into `docs/validation/pair-review-intake.md` and indexed.
Decisions remain in the lab document/source JSON; findings and separate source
uncertainties remain in the register and their appropriate open tickets. The resolved rename and queue removal are recorded before the final ticket
deletion. No other session's ticket is closed.
