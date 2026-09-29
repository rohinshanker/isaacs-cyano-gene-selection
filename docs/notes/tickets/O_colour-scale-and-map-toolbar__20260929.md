# O_colour-scale-and-map-toolbar__20260929 — Open

- **Scope:** Give the colour ramp a selectable scale, default heavily skewed
  metrics to a logarithmic one, and rearrange the map toolbar so colour, its
  explanation, and gene search each have their own place. Covers
  `site/index.html`, `site/css/`, `site/js/app.js`, the colour model and legend
  (`site/js/ui/legend.js`, `site/js/ui/scatter.js`,
  `site/js/ui/chromosome-view.js`), `site/js/core/metric-axes.js` or a sibling
  for the shared scale logic, `site/js/core/url-state.js`, the export manifest,
  their tests, and the validation documents that state the ramp rule. No change
  to any stored value or to `site/data/*.json`.
- **Status:** open
- **Opened:** 2026-09-29
- **Updated:** 2026-09-29

## Current state

Nothing has been built. The owner asked for this ticket on 2026-09-29.

**The ramp is linear for every metric, by a documented rule this ticket
reverses.** [current-design-answers.md](../../validation/current-design-answers.md)
says a ramp reads a value rather than a rank and is not rescaled, and the comment
on `defaultColorMetricKey` in `site/js/core/metric-registry.js` repeats it. That
rule is why the fresh-view colour avoided TSS initiation. The owner's decision
here is that a selectable, clearly labelled scale serves the reader better than
a linear ramp that paints nearly every gene one colour.

**How skewed the metrics are**, measured on `site/data/genes.json` at `main`
`0ee1885`. "Lowest tenth" is the share of genes whose value falls in the bottom
10% of the metric's linear range, which is the share a linear ramp paints in
nearly the same colour:

| Metric | Genes with a value | Lowest tenth | Min | Median | Max | Zeros | Negatives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TSS initiation | 1,727 | 99% | 77.4 | 828 | 324,000 | 0 | 0 |
| Expression (PCC 7942) | 2,551 | 99% | 1.29 | 268 | 127,800 | 0 | 0 |
| Downstream neighbour distance | 2,715 | 98% | −116 | 51 | 6,375 | 21 | 490 |
| Upstream neighbour distance | 2,715 | 98% | −103 | 92 | 6,375 | 13 | 308 |
| Rare codon count | 2,715 | 76% | 0 | 10 | 169 | 38 | 0 |
| Operon position | 1,816 | 69% | 1 | 2 | 18 | 0 | 0 |
| Operon size | 2,715 | 59% | 1 | 2 | 18 | 0 | 0 |
| CDS length, nt and codons | 2,715 | 39% | 75 | 756 | 5,412 | 0 | 0 |

Two things follow. TSS initiation and expression are strictly positive, so a
plain logarithm is safe for both. The two neighbour distances are as skewed but
carry zeros and negatives, where a plain logarithm is undefined, so they need a
different scale or stay linear.

**A scale control already exists, for axes only.** The Metric X vs Y tab has
"X scale" and "Y scale" selectors offering `linear`, `log10`, and `percentile`
(`AXIS_SCALES` in `site/js/core/metric-axes.js`), with `log10Availability` and
`log10DisabledReason` disabling log and saying why when a metric has a
non-positive value, and URL keys `xs` and `ys`. Nothing comparable exists for
colour.

**The toolbar today**, in `site/index.html`: one row holds both "Colour by" and
"Find a gene"; the colour explanation (`#colour-help`) sits beneath that row; a
second row holds Reset view, Reset selections, the zoom buttons, and Show
filtered-out genes. The chromosome tab has its own toolbar with its own Colour
by control.

## Requirements from the owner

1. **Default the colour scale to logarithmic** for TSS initiation, expression,
   and any other data with a similar bias, so the colours spread across the
   dataset and differences are visible.
2. **Colour by gets its own row**, shared with a new **Scale** field offering
   Linear, Logarithmic, and perhaps one to three others.
3. **The colour explanation moves up**, directly beneath the Colour by and Scale
   row.
4. **Find a gene gets its own row** beneath that, with nothing else on it.
5. **The other scales are a question for the owner**, to be asked when this
   ticket becomes active, from the candidates below.

## Proposed design, for the implementer to confirm or correct

### Toolbar order on every scatter tab

```
[ X axis ] [ X scale ] [ Y axis ] [ Y scale ]      (Metric X vs Y tab only, unchanged)
[ Colour by ▾ ]  [ Scale ▾ ]
▸ <colour metric> explanation
[ Find a gene ...................................... ]
[ Reset view ] [ Reset selections ] [ Zoom in ] [ Zoom out ] [x] Show filtered-out genes
```

The chromosome tab's toolbar gains the same Scale field beside its Colour by,
since both views read one colour model. Find a gene is full width on its row at
every breakpoint, under
[responsive-workspace.md](../../validation/responsive-workspace.md).

### One scale module, shared with the axes

The colour scale reuses the axis scale logic rather than duplicating it: the
same names, the same availability test, the same disabled-option wording. A
scale that a metric cannot support is shown disabled with its reason, never
hidden and never silently replaced.

### Which metrics default to logarithmic

A rule, not a list, so a later dataset is handled without a code change. A
metric defaults to logarithmic when both hold:

- every finite value is strictly positive, so the logarithm is defined; and
- at least 90% of its valued genes fall in the lowest tenth of its linear range.

On the current release that selects exactly **TSS initiation** and
**Expression (PCC 7942)**. The 90% threshold is one named constant with a test
that pins which metrics it selects on the shipped release, so a change in the
data that moves a metric across the line is seen in review and not discovered
in the picture. Every other metric stays linear by default and can be switched
by hand. Function category has no numeric scale; the Scale field is disabled
there with the reason stated.

### Scale candidates beyond Linear and Logarithmic

To be put to the owner when the ticket becomes active. Choose up to three.

| Candidate | What it does | Good for | Cost |
| --- | --- | --- | --- |
| **Percentile** | Colours by rank within the metric | Guarantees an even spread of colour; already exists for axes | Hides magnitude entirely: two genes a thousandfold apart can be adjacent colours |
| **Square root** | Compresses high values less than a logarithm | Counts with zeros, such as rare codon count, where a logarithm is undefined | Less spread than a logarithm on the most skewed metrics |
| **Symmetric log** | Logarithmic away from zero, linear near it | Signed metrics, such as the neighbour distances | One more parameter, the linear threshold, to choose and explain |
| **Clipped linear** | Linear between the 1st and 99th percentile, with the ends pinned | Keeps a linear reading while stopping a few outliers from flattening the rest | Every gene beyond the clip shares an end colour, which must be marked in the legend |

Recommendation to bring to that conversation: Percentile and Square root, and
Symmetric log only if the neighbour distances are wanted in colour.

## Questions for the owner, asked when the ticket becomes active

1. Which of the four candidate scales to include, up to three.
2. Whether a shared link that names a colour but no scale should open on the
   metric's new default. An existing link with `c=tssInitiation` would then
   render logarithmically where it rendered linearly before. The alternative is
   to treat a link without a scale key as linear, which keeps old links
   pixel-identical and makes them disagree with a fresh view.
3. Whether the fresh-view *metric fallback* should now prefer TSS initiation over
   GC3 when no function categories ship. The reason GC3 held that place was the
   linear ramp; with a logarithmic default the measurement is a readable ramp.

## Constraints that are not negotiable

- **Values do not change.** The scale changes which colour a value maps to,
  nothing else. Detail cards, tooltips, filters, thresholds, sorting,
  comparisons, and exports all read the stored value, unscaled.
- **The legend states the scale and reads in real values.** The ramp's tick
  labels are the metric's own units, placed where the scale puts them, and the
  scale's name is written beside the ramp. A reader must never have to guess
  whether a colour difference is tenfold or ten units.
- **The accessible description states the scale** on both views.
- **The export manifest records the scale** in effect, so an exported view can be
  reproduced, under
  [candidate-comparison-and-export.md](../../validation/candidate-comparison-and-export.md).
- **Missing stays absent.** A gene with no value is never given a colour under
  any scale, under [data-contract.md](../../validation/data-contract.md).
- **An undefined scale is refused, not approximated.** No offset is added to make
  a logarithm work on zeros; that metric offers Square root or Symmetric log, if
  approved, or stays linear.
- **The scale is shared state.** It lives in the URL under a new key (`cs` is
  already the colour sources), survives tab changes, and follows a live hash
  change, under
  [viewer-interaction-state.md](../../validation/viewer-interaction-state.md).
  Both views and the legend read the one value.
- **Diverging metrics keep their centre.** A metric the legend draws as
  diverging around zero stays centred on zero under any scale offered for it.
- **No new dependency.**

## Documents this ticket must change

The rule is being reversed by owner decision, so the record has to say so rather
than quietly stop being true:

- [current-design-answers.md](../../validation/current-design-answers.md): the
  passage stating a ramp is not rescaled, and the reason given for the colour
  default.
- The comment on `defaultColorMetricKey` in `site/js/core/metric-registry.js`.
- [metric-explanations.md](../../validation/metric-explanations.md) and
  [explicit-metric-axes.md](../../validation/explicit-metric-axes.md), so colour
  scale and axis scale are described as one mechanism.
- [chromosome-view.md](../../validation/chromosome-view.md) and
  [controls-column-and-resets.md](../../validation/controls-column-and-resets.md)
  for the toolbar.
- Row 73 of
  [AAA-biological-decisions-to-review.md](../../validation/AAA-biological-decisions-to-review.md),
  which still explains the default by the linear ramp.

## Relation to the visual-priority ticket

[O_zoomed-out-visual-priority__20260929](O_zoomed-out-visual-priority__20260929.md)
makes standout values visible through paint order and was written on the premise
that the scale stays linear. This ticket goes first. A logarithmic default
changes which genes read as standouts, so the other ticket's acceptance checks
are run under whatever scale is the default once this one lands.

## Acceptance criteria

- On a fresh view coloured by TSS initiation or Expression, the Scale field reads
  Logarithmic, and no single ramp bucket holds more than a stated share of the
  valued genes; the share is measured and recorded, against 99% in one tenth
  today.
- Switching Scale changes the map, the chromosome view, and the legend together,
  and changes no number shown anywhere.
- The legend names the scale and its ticks read in the metric's units.
- Logarithmic is disabled, with its reason, for a metric with a zero or negative
  value, and Scale is disabled with its reason for function category.
- The scale round-trips through the URL and a live hash change, and appears in
  the export manifest.
- Colour by and Scale share a row; the explanation is directly beneath it; Find a
  gene is alone on the next row, at mobile, tablet, and desktop widths, with no
  horizontal overflow.
- Keyboard order follows the visual order: Colour by, Scale, explanation, Find a
  gene, then the view buttons.

## Verification

Not started. This is visible UI work: render the real site over HTTP and inspect
each scatter tab and the chromosome tab under each scale, at mobile, tablet, and
desktop widths, with before and after captures at the same metric. Read ramp
bucket occupancy from the colour model, not by eye. Then the three gates:

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
```

Review by the other provider's reviewer on the exact commit, with an independent
rendered inspection.

## Claude Science claims

None at opening. A colour scale is visual encoding, which the amended trigger
list in
[claude-science-handoff.md](../../validation/claude-science-handoff.md#what-must-not-land-without-a-claude-science-claim-or-package)
leaves to in-repo judgment: no value, denominator, normalization, or population
changes. Two places could cross the line, and each stops for a claim row if it
does: rewriting a metric's explanation so it claims more than it did, and
question 3 above, which would put a measurement in a default position.

## Cleanup

On resolution, distil the scale module's contract, the default rule and its
threshold, the legend and export requirements, the toolbar order, and the
owner's answers to the three questions into the validation documents listed
above, update `validation/INDEX.md` if a row changes, then delete this ticket
and its index row.
