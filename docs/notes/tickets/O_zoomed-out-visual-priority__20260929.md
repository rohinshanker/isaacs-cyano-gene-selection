# O_zoomed-out-visual-priority__20260929 — Open

- **Scope:** Decide which gene is *seen* when many genes share the same pixels.
  On the chromosome view at zoomed-out scales, and on the scatter maps when
  points overlap, draw the informative marks on top: a gene with a function
  category above a gene without one, and a standout high value above the many low
  ones for heavy-tailed metrics such as TSS initiation and expression. Covers
  `site/js/ui/chromosome-view.js`, `site/js/core/chromosome-model.js`,
  `site/js/ui/scatter.js`, the legend and accessible descriptions, their tests,
  and the validation documents that state the drawing rules. No change to any
  value, to the colour scale, or to `site/data/*.json`.
- **Status:** open
- **Opened:** 2026-09-29
- **Updated:** 2026-09-29

## Current state

Nothing has been built. The owner asked for this ticket on 2026-09-29.

What the views do today, read from `main` at `b500aad`:

**Chromosome view, function category.** At whole-genome zoom a 1 kb gene is
about a third of a pixel, so each CDS is snapped to a whole device column and
several genes land on the same column. `paintTrack` already paints in three
passes: filtered-out genes, then genes with no category as empty outlines, then
genes with a category. So a categorised gene is not buried by an *overlapping*
uncategorised one. Two things still make the track read as grey and gappy:

- An uncategorised gene in a column of its own still draws as an empty outline,
  which is white inside. With 1,351 of 2,715 CDSs uncategorised under all three
  sources, those columns read as white gaps even in regions dense with
  annotated genes.
- A source-derived category, which is most of the coloured loci, draws as an
  outlined bar over a *pale* fill, under the hollow-marker rule in
  [source-derived-categories.md](../../validation/source-derived-categories.md).
  At one device column wide the outline and the pale fill collapse together and
  the category colour is largely lost. This is a hypothesis from reading the
  code; the first step of the work is to confirm it in a render.
- Among categorised genes sharing a column, the one painted last wins, and that
  is data order, not a chosen priority.

**Chromosome view, metric colour.** Valued genes are painted in data order. For
TSS initiation, whose median is 828 against a maximum near 324,000, and for
expression, nearly every column shows a low value, and a standout gene is
overpainted by whichever low-value neighbour happens to come later in the file.

**Scatter maps.** Points are batched by quantized colour and drawn bucket by
bucket. In category mode the unknown rings already sit behind the coloured
points. In metric mode nothing orders the buckets by value, so in the dense core
of a projection a high-value point can sit under low-value ones.

## Requirements from the owner

1. **Chromosome view, function category, zoomed out:** prioritise the coloured
   genes over the grey ones so they are easier to see, and do not leave white
   gaps in regions that hold many annotated genes.
2. **Chromosome view and scatter maps, heavy-tailed metrics** (TSS initiation,
   expression): the higher, standout values must be easy to see among the many
   low ones.
3. **Extend the same rule to the scatter maps**, so the informative dots are
   placed above the others, most of all when zoomed out.

**Assumption to confirm.** The request names "the PCR". This ticket reads that as
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

A gene with no category keeps its empty outline wherever it is wide enough to
read as an outline. Below that width it is drawn as a thin neutral tick on the
axis rather than a white box, so it still marks that a gene is there without
reading as a gap. The width threshold is one constant, tested.

### Scatter maps

Order the colour buckets, and the points within a bucket, by the same priority
before drawing. The batching by quantized colour that keeps panning fast is
kept; only the order in which batches are issued changes.

## Decisions for the owner

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
- Scatter frame time does not regress against `main` at `b500aad`, measured.

## Verification

Not started. This is visible UI work: render the real site over HTTP and inspect
both views at whole-genome zoom and at two intermediate zooms, in function
category, TSS initiation, and expression colour, at mobile, tablet, and desktop
widths. Use canvas pixel readback for the column checks, as the chromosome tab's
review did. Capture before and after at the same zoom and colour so the
difference is visible. Then the three gates:

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
```

Review by the other provider's reviewer on the exact commit, with an independent
rendered inspection.

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
