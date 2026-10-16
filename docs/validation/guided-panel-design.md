# Guided gene-panel design

The **Design a panel** workflow builds a deterministic 6–10-gene coverage panel.
It is an experimental design over measured and computed gene properties, not a
fitness prediction.

## Objective and defaults

The objective identifier is `constrained-stratified-maximin`. After required
seeds/includes are placed, each greedy step chooses by this stable order:

1. most previously unoccupied five-quantile bins reached;
2. greatest distance to the nearest selected gene;
3. greatest total distance to selected genes;
4. most present feature values; and
5. lexicographically lower locus tag.

Plain maximin is intentionally not used: on the frozen real-data case it selects
corners while leaving interior quantile slices empty. The stratification rule
restores coverage while maximin preserves separation.

Baseline features are GC3, ENC, rare-codon fraction, codon-pair score,
start-window MFE, protein length, upstream-neighbor distance, CAI, and tAI, in
that order. Each chosen scheme adds target fraction, maximum local target
density, ΔCAI, and ΔtAI. A missing or constant field is dropped with an
explanation. The feature registry is
dynamic, so a changed published metric count is not assumed.
Declared metric discovery is order-independent and scans until a finite value is
found anywhere in the dataset; a sparse metric cannot disappear because its first
value occurs after an arbitrary gene prefix.

Every feature is replaced by its whole-genome percentile before distance is
computed. Missing values remain missing. Two genes are compared on shared
features with distance rescaled to the full feature width; no shared feature is
treated as no evidence of difference, not as maximum distance. Hard-range
constraints keep an unknown by default unless **require a value** is selected.

Translational exceptions and overlapping/discontinuous loci are excluded by
default. Borrowed PCC 7942 expression is absent from the space and constraints
until explicitly enabled. Enabling it adds one raw representative of that
source to the default feature space (never both the raw value and its derived
percentile), and it remains labelled as another-organism evidence. Native UTEX
2973 TSS initiation stays available without that opt-in, and the "Constrain a
metric" list offers native measurement first; once borrowed expression is
switched on, that PCC 7942 measurement ranks next, still ahead of CAI/tAI —
matching the low-traffic threshold's priority (see "Expression, and why it is
not the default" in `data-contract.md`).

### CAI and tAI weight in the default baseline, reviewed 2026-09-22

Reviewed under the deprioritization rule, the decision is to **keep both, keep
them unweighted, and list them last**. Every feature is replaced by its
whole-genome percentile and enters the distance on equal terms, so CAI and tAI
are two of nine baseline features with no multiplier; nothing in the objective
gives them extra weight. Dropping one of them would not remove a codon-usage
convention from the space, because the per-scheme ΔCAI and ΔtAI features are
the recoding decision the panel exists to spread across, and removing a
baseline feature changes every generated panel and the frozen golden case for
no scientific gain.

What changed is order, not weight: CAI and tAI now sit at the end of
`DEFAULT_BASELINE_FEATURES`, and an enabled borrowed measurement is placed
ahead of them rather than appended after them, so no default ordering shows a
convention above a measurement. Because the space is percentile-scaled and
order-independent, this leaves the objective identical —
`panel-golden.test.mjs` passes unchanged, which is the check that the
objective did not move — and the
saved-scheme identity rules below are untouched, since the default feature list
is the same set of keys. `panel-features.test.mjs` asserts both the order and
that a reversed feature list produces the same scaled space.

The default baseline feature list itself is still not reweighted to add TSS
initiation: it covers 1,727 of 2,715 genes, is a promoter-initiation signal
rather than a whole-gene abundance measurement, and folding it into the same
generic distance space as CAI/tAI would change every generated panel with no
clear scientific justification. An explicit TSS range constraint narrows
eligible genes; it does not put TSS into the panel's distance calculation.
Borrowed expression, when enabled, is a separate feature with its own
provenance and units.

A saved-scheme checkbox is keyed by the saved name plus the canonical scheme-map
identifier, never by its position in the sorted list. Inserting or reordering
schemes cannot retarget a selection; deleting the saved scheme clears it. Two
differently named saved schemes remain independently selectable even when their
maps match, while computation and export still deduplicate equivalent maps.

A generated result is tied to the canonical configuration, scheme identities,
and source evidence that produced it. If size, ranges, flags, seeds/exclusions,
borrowed-expression policy, selected schemes, or a deciding metric's sources or
values change, the existing result and its export retain their captured inputs
and show **Settings changed**, **Data sources changed**, or both until
**Regenerate panel** is selected. Unrelated
visual choices do not change the design. Never silently relabel an old result
as if it used new controls.
The complete result region is not live: the page announcer reports one concise
design outcome, while only the stale notice and infeasible alert keep their own
targeted status semantics.

## Export contract

Panel export extends the existing research manifest with
`panelDesignVersion: 2`, objective and tie order, dataset/checksum identity,
selected schemes, size, seeds, include/exclude lists, active and blocked
constraints, missing-data policy, exact features, per-gene explanations,
coverage before/after, and the gene-by-scheme values. CSV remains one row per
gene and scheme. Import must reject an unknown panel-design version. Restore
captured sources before rebuilding and comparing a current-version panel.

### Captured data sources

Data-type readers normally follow the live Data Sources selection. Panel
generation captures their values and definitions so later selection changes
cannot change an existing result or its CSV. Capture the sources alongside
the chosen genes; recording source IDs only at download time is insufficient.

The source description records the selected dataset IDs, named type overrides,
and each deciding metric's actual contributors, reading mode, units, source
identity, finite/missing counts and value digest. A pooled reading and a
single-source reading are different inputs even when their displayed values
happen to match. Preserve the distinction between zero and missing values.
Keep constraints whose source becomes unavailable inspectable with their
blocked reason; do not silently erase them from the configuration.

The manifest's `panelDesign.sourceSelection` records this description.
`designSourceStateId` links every CSV row to it, and `designMetricSources`
names the datasets used by source-dependent deciding metrics in the CSV itself.
`readPanelDesign()` returns the captured source description so reconstruction
can restore the selection and verify its inputs before comparing chosen genes.
Version 1 manifests return `legacy: true` and `sources: null`: the original
selection was not recorded and must never be inferred from current UI state.
A version 2 manifest without captured sources is rejected. Reconstructing a
legacy panel requires independent knowledge of its original selection.

Neighboring TSS counts and per-scheme TSS edit evidence follow the captured
evidence state. Export a count when that evidence was evaluated, including a
true zero, and a blank when it was unavailable. Changing the current Tan
selection must not rewrite the evidence in an existing panel export.

## Golden validation

`tests/js/panel-golden.test.mjs` uses Syn61-style recoding, seeds
`M744_RS00005` and `M744_RS05000`, and a ten-gene target. It compares the shipped
design with 400 deterministic random panels, naive farthest-point selection in
raw units, and plain percentile-space maximin. The design must satisfy every
constraint, fill more quantile bins than every baseline, retain greater closest-
pair separation than the best random and naive panels, and never use borrowed
expression unless requested.

Run `node --test tests/js/panel-*.test.mjs`; the selection cases are in
`tests/js/panel-designer-selection.test.mjs`. Render configuration, infeasible,
result, manual-edit, reordered and duplicate-map saved-scheme, multi-scheme,
stale-result notice, expanded-help, and export states at the
responsive-workspace viewports.

For source-state regressions, generate a panel with a native initiation range
and **Require a value**, then deselect its Tan condition under **Data Sources**.
The old result must be marked stale; its export must still identify and read
the captured condition. Regeneration must use the new selection and disclose
any blocked constraint. Also exercise pooled versus individual sources, values
arriving after generation, missing-value rules, and unrelated visual toggles.
