# Native neighbouring genes

- Purpose: Preserve exact native annotation context without changing overlap or CDS metrics.
- Scope: The two compact gene visualizer mounts and pinned sequence close-up, for all published organisms.
- Last verified: 2026-10-12

## Inventory and loading

`gene_overlaps.json` optionally adds `contextFeatures`: the complement of its
existing overlap-participant `features`, in the identical feature schema. The
union must contain every `coveredGenes` identity exactly once. Its biotype and
childless censuses must reconcile, and every selectable CDS must match
`genes.json` in replicon, strand and occupied segment union (abutting pieces
merge without changing any base or gap). The producer derives both arrays
from the same pinned annotation; OG feature positions, pairs, coverage and
legacy `neighborUpstreamNt`/`neighborDownstreamNt` metrics retain their meaning.
The contract gate independently compares the full catalogue with raw annotation.

An old payload lacking the optional array retains valid OG data and explicitly
unavailable native context. Loading, failed, unavailable and no eligible flank
are separate states. Malformed catalogues fail validation before any join.

The dataset owns a separate neighbour index. `flankingNeighbours` is a
configurable, non-enumerable lazy accessor on each plotted gene: attachment and
JSON serialization resolve no focal queries. Only the requested locus scans
its replicon's catalogue; repeated reads reuse the same frozen answer. Clearing
or replacing the layer removes/replaces the accessor and its catalogue cache.
Filters, hover, redraw and sequence camera operations do not enter the index.
`resolvedGeneCount` permits checking this load/lookup contract.

## Geometry

All published genome-of-record replicons are circular. The canonical
`transcriptionPieces` helper defines the focal outer 5′ and 3′ bounds. Joined
internal gaps belong to the outer transcribed span, never to a flank. Candidates
come from the same replicon only; unknown strands stay unknown. The pinned
catalogues use at most two segments for origin-crossing genes. A future
origin join with more pieces needs native outer-bound/order evidence absent
from this reduced schema; it reports context unavailable rather than guessing
an orientation. Multi-piece nonwrapping joins remain supported.

A gap counts unoccupied bases from the focal outward occupied boundary to the
nearest candidate occupied base, in focal transcription orientation: abutting
means zero bp. Walking stops before re-entering the focal outer span. A sole
other gene on a circular replicon may be the immediate neighbour on both sides.
Keep all nearest ties in locus order.

A partner sharing focal bases and crossing an outward boundary blocks that side:
report `overlap-blocked` with its IDs and refer to OG, without presenting a farther
gene as immediate. A joined OG partner’s separate outward piece also blocks
when it is nearest (including a tie); a genuinely closer separated gene can
remain a flank. A wholly internal overlap does not block. OG partners never
become separated flanks. The exact segments, replicon, biotype, pseudogene flag,
strand and gap remain inspectable.

## Display and interaction

The shared **Neighbouring genes** disclosure starts collapsed and uses a bounded
schematic explicitly labelled not to scale. Its physical strand arrows/words and
relative arrows distinguish annotation strand from focal transcription direction.
No downstream sequence letters or extra sequence-camera domain are introduced.

Known noncoding biotypes use neutral grey plus explicit biotype/noncoding text.
Pseudogene and unclassified biotypes retain their source labels; an unclassified
`gene` or `other` is not silently called protein-coding or noncoding. Nonselectable
loci are labelled annotated context, not recoding candidates. Selectable neighbours
use the existing partner-opening route and restore focus to its labelled region.

Compact mounts follow preview; the expanded view follows only the pin. Native
neighbours survive filter changes. Open disclosure state and summary/button
focus survive relevant rerenders; a replaced or removed control hands focus to
a surviving summary or labelled viewer. Panning/zooming preserves disclosure
contents and does no neighbour recomputation.

## Reproduction and regression checks

Use the canonical interpreter and pinned ignored inputs read-only. In a worktree,
link individual raw files into task-local `data/raw`, or use `--raw-dir` per
organism. Never build into a shared checkout/output directory.

For assembly organisms, run `tools/build_gene_overlaps.py build --organism ID`,
then `tools/build_data_manifest.py build --organism ID`. Verify with their `check`
modes and `tools/validate_contract.py --organism ID --raw-dir RAW_DIRECTORY`.
For Syn57, use `tools/build_syn57_design.py`'s verified `read_source` and `normalize`
functions, then the same overlap producer over the temporary normalized GFF.
Publish only the overlap JSON and rebuilt manifest when other design outputs are
unchanged. Its original-source contract test checks every normalized raw input.
Regenerate module preloads with `node tools/build_module_preloads.mjs`.

Focused checks are `tests/js/gene-neighbours.test.mjs`,
`tests/js/gene-overlaps.test.mjs`, `tests/js/gene-sequence-view.test.mjs`,
`tests/js/side-panel-disclosures.test.mjs`, `tests/test_gene_overlaps.py`, and
`tests/test_syn57_design.py`. The independent seeded oracle walks finite base
sets; it does not reuse interval-distance arithmetic. It covers both strands,
valid circular origins, joined pieces, abutting/positive gaps, internal and
crossing overlaps, ties, no flank and organism/replicon isolation. Catalogue
negative fixtures cover missing/duplicate/stale records, wrong census and CDS
geometry; loader tests check lazy load, serialization, replacement and clearing.

Render the real site on an unused port owned by the assigned worktree. Inspect
both compact mounts and the sequence close-up at 375×812, 768×1024, 1280×800,
1440×900 and both sides of the 960/1240 px breakpoints. Include
`M744_RS00005` (native rRNA flank), `M744_RS13290` and `M744_RS13620` (origins),
and `M744_RS00920` (joined CDS). Assert actual grey-versus-coding computed styles,
keyboard disclosure/focus, partner opening, preview/pin separation, filter
invariance, camera preservation, loading/missing/error states, no horizontal
overflow and no unexpected diagnostics. Inspect screenshots, then run the full
repository gates in `AGENTS.md`. Keep render artifacts outside tracked guidance.
