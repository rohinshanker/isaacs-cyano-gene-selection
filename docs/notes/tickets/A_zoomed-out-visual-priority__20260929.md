# A_zoomed-out-visual-priority__20260929 — Active

- **Scope:** Decide which gene is *seen* when many genes share the same pixels.
  On the chromosome view at zoomed-out scales, and on the scatter maps when
  points overlap, draw the informative marks on top: a gene with a function
  category above a gene without one, and a standout high value above the many low
  ones for heavy-tailed metrics such as TSS initiation and expression. Covers
  `site/js/ui/chromosome-view.js`, `site/js/core/chromosome-model.js`,
  `site/js/ui/scatter.js`, the legend and accessible descriptions, their tests,
  and the validation documents that state the drawing rules. No change to any
  value, to the colour scale, or to `site/data/*.json`.
- **Status:** active
- **Opened:** 2026-09-29
- **Updated:** 2026-09-30

## Current state

Active since 2026-09-30. The owner answered the four display decisions and the
scatter-scope assumption that day; see "Owner decisions". Work starts from `main`
at `34bb240`, which already carries the selectable colour scale.

- **Baseline measured** on the unchanged site by DEM-169 (`claude-ui-inspector`,
  read-only), by canvas pixel readback at 375, 768, 1280, and 1440 px. It left a
  harness that repeats the same measurements on the patch. The findings below
  replace the code reading this ticket was opened with, which had the cause of
  the white gaps and the state of the scatter maps wrong.
- **Implemented** by DEM-171 (`claude-implementer`) as `b6e21e9` on
  `agent/claude-implementer/dem-171`: one priority rule in
  `site/js/core/paint-priority.js`, D1 and D2 on the chromosome view, no-value
  markers under valued points on the scatter maps, and the draw-direction
  control at the foot of the colour explanation disclosure, URL key `dt`. The
  sub-pixel tick was not built: no column reads white once D1 lands.
- **Reviewed** on that exact commit by DEM-172 (`codex-reviewer`), returned for
  fixes, and **inspected** by DEM-173 (`claude-ui-inspector`). Acceptance
  criteria 1 to 6 and 8 are met by pixel readback at all four widths; criterion
  7 is partly met. Findings: a 1 px bar's 2 px hit target lets a neighbour take
  the click on 166 of 787 shared columns at 1440 px; the locus tie-break is the
  reverse of what is disclosed; D2's majority is scored in a CDS's first column
  only; the D1 count misses partly solid CDSs; the crowding figure counts
  off-screen columns; scatter picking ignores the painted order; the scatter map
  does not call the shared rule; two count sentences misread at zero and one.
- **Repair** is dispatched as DEM-174 on branch `fix/dem-171-review` from
  `b6e21e9`. The same reviewer confirms the fix commit before integration.

## Measured baseline, `main` at `34bb240`

**The white gaps are the derived categories, not the uncategorised genes.**
`paintMark` strokes a filled bar only at 3 px or wider. A derived bar has a
white fill, so below 3 px its category-coloured outline is never drawn and the
column is pure white. At whole-genome zoom 0 of the 916 to 1,634 derived-only
columns keep a category colour, at every width and at both device pixel ratios;
the share recovers only to 2.9% at about 4x zoom and 14.2% at about 16x. Of the
columns holding a categorised gene, 4 to 14 read as a category colour and the
rest read white: 72% to 92% of all occupied columns. Reviewed-only columns all
keep their colour. Uncategorised-only columns read the uncategorised grey
`#c6cdd5`, never white.

**Columns are shared almost everywhere.** 69% to 96% of occupied columns hold
more than one CDS, with a median of 2 to 5 and a maximum of 9 to 16. The winner
is the mark with the highest start coordinate, since marks are sorted by first
drawn base and then index; 268 plus-strand and 247 minus-strand columns at
1440 px hold two or more different categories.

**Standout values are buried on the chromosome view.** At whole-genome zoom
only 1 to 5 of the ten highest TSS initiation genes and 2 to 6 of the ten
highest expression genes own their column's colour; it is 7 to 10 at about 4x
and all ten at about 16x. The genome-wide TSS maximum, `M744_RS11625` at
323,996, is overpainted by a neighbour 62 times lower.

**The scatter maps already put high values on top.** `bucketOf` is monotonic
and buckets draw in ascending order: 0 of 163 top-percentile points are
overpainted by a lower-valued point, and unknown rings never win at a coloured
centre in category mode. The real scatter defect is that in metric colour the
open markers for genes with no value draw after the coloured points, so a
valueless ring can cross a top-valued point: on Baseline risk UMAP the
second-highest TSS value reads back at its centre as the missing-value grey.
Perturbation space is gated on an active recoding scheme and was not measured.

**Scatter frame time:** median 0.5 ms, 95th percentile 0.6 ms over 241 frames at
2,715 points, 1440 by 900 at device pixel ratio 2.

**What this changes in the design below.** Owner decision D1 is what removes
the white columns. The sub-pixel tick for uncategorised genes does not remove
any, so it is built only if the rendered result shows grey still crowding out
colour, and justified by a before and after. On the scatter maps the ordering
work is the missing-value markers and the "lowest" direction of D3, not the
bucket order.

## Owner decisions, 2026-09-30

1. **D1, approved with both conditions.** Below the width at which the hollow
   style can be read, a derived category draws in its full category colour. The
   legend and the accessible description state that derived and reviewed colour
   draw alike at this zoom, with the counts of each, and the hollow style returns
   as soon as a bar is wide enough to show it.
2. **D2, reviewed then majority.** When different categories share a device
   column the column shows reviewed over derived, then the category with more
   genes in that column, then locus order. The view's description states the rule.
3. **D3, every metric, with a control kept out of the way.** Highest value on
   top is the default for every metric. A "Draw on top: highest / lowest"
   control, remembered in the URL, reverses it. The owner added the same day
   that this is an aesthetic preference of little consequence, so the control
   takes no space in a primary area: it is not on the toolbar rows, adds no
   always-visible row or label, and lives inside an existing secondary surface
   that is collapsed or out of the main flow by default. The direction in
   effect is still stated in the legend note and the accessible descriptions,
   so a non-default view is never silent.
4. **D4, deferred.** No second visual channel for standouts is built under this
   ticket. It was not put to the owner again; the ticket's own recommendation
   stands until the ordering has been looked at in a render.
5. **Scatter scope: every scatter map.** "The PCR" is the PCA, and the ordering
   applies to Native codon space, Metric X vs Y, Recoding-risk space, Baseline
   risk UMAP, and Perturbation space alike.

Pushing to `main` has not been approved for this ticket. The coordinator asks
before any push.

## Requirements from the owner

1. **Chromosome view, function category, zoomed out:** prioritise the coloured
   genes over the grey ones so they are easier to see, and do not leave white
   gaps in regions that hold many annotated genes.
2. **Chromosome view and scatter maps, heavy-tailed metrics** (TSS initiation,
   expression): the higher, standout values must be easy to see among the many
   low ones.
3. **Extend the same rule to the scatter maps**, so the informative dots are
   placed above the others, most of all when zoomed out.

**Assumption, confirmed 2026-09-30 under "Owner decisions".** The request names "the PCR". This ticket reads that as
the PCA, meaning the Native codon space map and, by the same mechanism, every
scatter projection (Metric X vs Y, Recoding-risk space, Baseline risk UMAP,
Perturbation space), since they share one drawing routine. If only the native
PCA was meant, the change is scoped to that tab.

## Proposed design, for the implementer to confirm or correct

### One priority rule, shared by both views

A single pure function, in the core and not in either view, returns a paint
priority for a gene under the current colour model. Both views sort by it and
paint ascending, so the highest priority lands on top. Proposed order, lowest
first:

1. filtered out by the current filters;
2. no value for the selected colour;
3. has a value. In category mode, reviewed above derived. In metric mode,
   ascending by value, so the highest value is painted last;
4. shortlisted, pinned, keyboard-active, hovered, as today.

Ties break by locus order so the picture is deterministic and a re-render never
flickers between two genes.

### Chromosome view: what a shared column shows

When more than one gene lands on a device column, the column shows the
highest-priority gene among them. That is the same rule as paint order, stated
for the case where the marks coincide exactly. The column-level aggregation is
computed from the visible marks at the current zoom and recomputed on zoom, so
it disappears as soon as genes separate.

### Chromosome view: uncategorised genes at sub-pixel width

Conditional since the baseline; see "What this changes in the design below".

A gene with no category keeps its empty outline wherever it is wide enough to
read as an outline. Below that width it is drawn as a thin neutral tick on the
axis rather than a white box, so it still marks that a gene is there without
reading as a gap. The width threshold is one constant, tested.

### Scatter maps

The baseline found the bucket order already ascending by value; the change is
to the missing-value markers and the reversed direction.

Order the colour buckets, and the points within a bucket, by the same priority
before drawing. The batching by quantized colour that keeps panning fast is
kept; only the order in which batches are issued changes.

## Decisions for the owner, answered 2026-09-30 under "Owner decisions"

These change a documented display rule, so they are the owner's to make and are
not decided in this ticket. Each is built only once approved here by name.

| # | Decision | Why it needs you | Recommendation |
| --- | --- | --- | --- |
| D1 | At sub-pixel width, draw a **derived** category in its full category colour instead of the pale hollow style | The hollow marker is how the site keeps computational colour from being read as reviewed colour. Dropping it at small sizes is what makes the colour visible, and also removes that signal at exactly the zoom where most of the picture is derived | Approve, with two conditions: the legend and the accessible description state that at this zoom derived and reviewed colour draw alike, with the counts of each; and the hollow style returns as soon as a bar is wide enough to show it |
| D2 | When two *different* categories share a column, which one shows | Any rule hides one of them | Reviewed over derived, then the category with more genes in that column, then locus order. State the rule in the view's description |
| D3 | Whether highest-value-on-top applies to **every** metric or only to heavy-tailed ones | For a metric where low is the interesting end, such as a rare-codon fraction someone is minimising, "high on top" hides what they are looking for | Apply it to every metric by default and add a small "Draw on top: highest / lowest" control, remembered in the URL, so the choice is explicit and shareable |
| D4 | Whether to add a second visual channel for standouts, such as a taller bar or a halo above a percentile | It makes standouts far easier to see than order alone. It also adds an encoding the legend must explain | Defer. Ship the scale ticket and ordering first and look at the render before adding a channel |

## Constraints that are not negotiable

- **This ticket does not change the colour scale.** It works through paint order
  only. The selectable colour scale, with TSS initiation and expression
  defaulting to logarithmic and the neighbour distances to symmetric log,
  shipped on 2026-09-30 under the contract in
  [explicit-metric-axes.md](../../validation/explicit-metric-axes.md) and
  [current-design-answers.md](../../validation/current-design-answers.md). This
  ticket's acceptance checks run under those defaults.
- **Missing stays absent.** A gene with no value is never given a colour, at any
  zoom, under [data-contract.md](../../validation/data-contract.md) and
  [chromosome-view.md](../../validation/chromosome-view.md). The neutral tick for
  a sub-pixel uncategorised gene must not be mistakable for a low value.
- **Priority is disclosed wherever it changes what is seen.** Putting high values
  on top makes a region look hotter than its typical gene. The legend note and
  the accessible description must say that marks are ordered, by what, and, on
  the chromosome view, how many genes share a column at the current zoom.
- **Nothing is removed.** Every one of the 2,715 CDSs stays hit-testable, reachable
  by keyboard, and counted. Priority changes what is painted on top, never what
  exists.
- **Hit testing follows the picture.** A click on a shared column selects the
  gene that column shows, and the remaining genes in it stay reachable by arrow
  keys and by zooming in.
- **Filtered-out genes stay underneath**, as today.
- **Shared state is untouched**, under
  [viewer-interaction-state.md](../../validation/viewer-interaction-state.md).
  If D3's control is approved it is one more URL key, versioned as the others are.
- **Panning stays fast.** The scatter map's frame time at 2,715 points must not
  regress; sorting happens when the colour model changes, not on every frame.

## Acceptance criteria

- At whole-genome zoom in function-category colour, every device column that
  contains at least one categorised gene shows a category colour, and the
  rendered track has no white column inside a run of annotated genes. Measured
  by reading pixels back from the canvas, not by eye.
- In TSS initiation and expression colour, the top-valued genes on each replicon
  are visible at whole-genome zoom: each of the ten highest-valued genes owns the
  colour of its column.
- On each scatter map in metric colour, a point in the top percentile is never
  painted under a point of lower value that overlaps it.
- The same checks hold at mobile, tablet, and desktop widths, since the number of
  genes per column changes with width.
- The legend and the accessible description state the ordering and, on the
  chromosome view, the genes-per-column figure.
- Zooming in until bars separate returns every gene to its ordinary drawing,
  including the hollow style for derived categories.
- Clicking a shared column selects the gene it shows.
- Scatter frame time does not regress against `main` at `34bb240`, the commit the
  work starts from, measured on the same machine with the DEM-169 harness.

## Verification

On `b6e21e9`, before the repair round:

- Gates, run by the coordinator on the exact commit: `npm test` 716 pass;
  `pytest` 332 passed, 1 skipped; `validate_contract.py` passed=96 failed=0.
- Pixel readback, DEM-173, at 375, 768, 1280 and 1440 px: columns with a
  categorised gene reading white 932 to 1,644 before, 0 after; the ten highest
  TSS initiation genes owning their colour 1 to 5 before, 9 to 10 after, every
  shortfall sharing a column with a higher one; scatter centres reading the
  missing-value grey 83 to 366 per tab before, 0 after; frame time median 0.5 ms
  on both trees.
- The control adds no box with its surface closed. The legend gains one line in
  Expression and Function category colour from the ordering clause.

Still owed: the repair commit, its confirmation by the same reviewer, the three
gates on the final commit, and a rendered check of the repaired hit testing.
The harness that takes these measurements was written for this ticket and
lives outside the repository; distil what is reusable at cleanup.

## Claude Science claims

None. Paint order and the sub-pixel drawing of a mark are visual encoding, which
the amended trigger list in
[claude-science-handoff.md](../../validation/claude-science-handoff.md#what-must-not-land-without-a-claude-science-claim-or-package)
leaves to in-repo judgment. No value, denominator, normalization, or population
changes. D1 changes how an *evidence label* is displayed, which is why it is an
owner decision above; if the work is found to change what a label says, that
step stops and a claim row is added here.

## Cleanup

On resolution, distil the priority rule, the shared-column rule, the disclosure
wording, and each decision's outcome into
[chromosome-view.md](../../validation/chromosome-view.md) and the scatter map's
drawing contract, update `validation/INDEX.md` if a row changes, then delete
this ticket and its index row.
