# R_pxd036717-enrichment-reader__20261015 — Resolved

Scope: PXD036717 source-preserving workbook reader and raw-LFQ reconstruction;
bounded prerequisite of `O_data-sources-selection__20261005`, not browser admission.
Status: resolved
Opened: 2026-10-15
Updated: 2026-10-15
Owner: cyano-lit-unreach (80c81443-1791314087)

## Outcome

Isolated branch `work/pxd036717-reader-20261015`, baseline
`cccd4a89b91812df467e360916b0091ef1f8eae5`, in the sibling worktree
`worktrees/pxd036717-reader-20261015`. No other session's worktree or UI scope
is owned here. The canonical checkout is `isaacs-cyano-gene-selection`.

Read the owner-supplied Santos-Merino 2024 supplement (`mmc1.xlsx`) directly,
preserve its original values and cell provenance, and report arithmetic and
missing-intensity diagnostics separately. Pin the source bytes. Do not guess
locus joins, replace source values, invent p-values, or equate enrichment with
protein abundance. Baits remain separate.

Owner decisions, 2026-10-15:

- Browser release must wait for reconstruction from raw LFQ intensities;
  published log2 ratios alone are not sufficient.
- Expose all 12 replicate comparisons plus optional averages within each of the
  four baits. Never pool different baits.

The unblocked reader/reconstruction work can be validated without browser
admission. Source zero intensities and author-imputed log2 values must stay
distinguishable from measured zero enrichment. Browser mapping, source-specific
admission and rendered checks remain in the parent ticket.

## Verification

Closed by **cyano-lit-unreach**, 2026-10-15. Implemented in `57c8771`, repaired
in `b08a0c0`, independently approved on that exact repair by DEM-424. DEM-422
independently audited the source workbook. All reader audit findings resolved:

- F1 (detection states): `b08a0c0`; original positive-input states and row/tab
  counts now preserve bait-only evidence without inventing a ratio.
- F2 (article provenance): `b08a0c0`; direct quote/page/date/hash replaces the
  unsupported reference to an older intake.
- F3 (missing-log branch): `b08a0c0`; explicit regression passes.
- F4 (source hardlink overwrite): `b08a0c0`; same-file guard and link regressions.

Final gates: 44 focused tests including pinned source; `npm test` 1,653 passes;
Python `pytest -q` 2,346 passes, 23 skips and 51 passing subtests;
`tools/validate_contract.py` 130 passes, one skip. All source cells, 4,875
comparisons and 704 complete means independently checked. Source hashes remain
unchanged. No browser code or release data changed; rendered UI is not part of
this bounded reader scope. The later merge contains only the other session's
TSS ticket claim; reviewed executable/data paths remain identical to `b08a0c0`.

Remaining parent findings are explicitly **open**: PXD-JOIN, PXD-IDENT,
PXD-CONDITION, PXD-RELEASE and PXD-DETECTION (owner display question pending).
They are preserved in `O_data-sources-selection__20261005.md`; the parent is not
closed. No unresolved audit finding remains against the reader itself.

## Cleanup

Reusable source pins, preservation/reconstruction/detection contracts, evidence
limits and reproduction checks live in `docs/validation/pxd036717-enrichment.md`
and its index row. Remove this resolved ticket after recording this closure;
retain the parent findings and owner question. The source and non-release JSON
cache are preserved under ignored canonical `data/interim/pxd036717/`; the
owner's original private ZIP/PDF are unchanged. Only this session's worktree and
branch may be removed after integration and push.
