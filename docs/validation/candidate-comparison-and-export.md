# Candidate comparison and export: what must stay true

The comparison views and the export are where a reader turns numbers into a gene
choice. Two failures here are silent and expensive: a value that is unknown can be
drawn where a typical value sits, and an exported number can lose the scheme that
produced it. Both have happened in this repository. This document states the
contracts that prevent them and the checks that prove they hold.

## 1. Missing must look missing

A gene with no measurement has **no position**. It is never the median, never
zero, never an imputed value.

The rule is enforced at the only place a position is computed. `zScore()` in
`site/js/ui/compare-model.js` returns `NaN` for a missing value or an unusable
scale, and every caller treats a non-finite score as absent geometry rather than
converting it to a coordinate. A drawing routine that turns `NaN` into a number is
the bug class this whole document exists to prevent.

What the reader must see instead:

- The line **breaks**. `presentRuns()` splits a series into runs of consecutive
  present points. A closed radar polygon rejoins its wrapping run only when both
  ends are present, so a gene missing one axis is drawn open.
- An **explicit marker** sits where no value could go: outside the radar's outer
  ring, below the parallel axis. It is a different shape from every data marker.
- Several candidates missing the same metric **fan out** rather than stacking.
  Without this the chart showed one mark while the description counted five.
- The **count** appears in the chart description, the accessible name, the legend
  entry for each affected candidate, and the table caption.
- A brushed range on an axis **never keeps** a candidate whose value there is
  unknown. Unknown is not inside any range.

Chart, legend, accessible name, and table must agree. The table prints a dash and
a screen-reader-only "no value"; if the picture disagrees with the table, the
picture is wrong.

The visible table guidance is a sibling of the horizontal `.table-scroll`
container, not a child of it. It must wrap to the available card width and stay
visible while a reader scrolls across the wide metric columns. Each table keeps
a concise screen-reader caption and references the visible guidance with
`aria-describedby`.

## 2. Ten candidates must stay distinguishable

The lab's target panel is 6 to 10 genes, so 10 is the size that must work, not a
stretch case. `SERIES_STYLES` supplies ten combined encodings that differ in
**colour, dash pattern, and marker shape together**. Colour alone never carries
identity. Past the tenth series the styles repeat, and `seriesStyle()` sets
`repeated` so the legend says so rather than passing a reused identity off as new.

Axis labels are never truncated. The radar derives its radius from **measured**
text width plus room for any missing-value fan; long labels wrap to two lines; and
when the result will not fit, the canvas keeps a minimum width and the chart
scrolls sideways, announcing that in its note. An ellipsis in an axis name is a
regression.

A default axis with no spread is **dropped and explained**, not drawn flat. With
no active scheme, target fraction is constant zero and says so.

The pairwise table leads with **Metric**, **A − B**, and **Relative size** so the
comparison's result is visible at the default desktop scroll position. Raw A and
B values remain to the right for verification. Narrow screens may require the
contained horizontal scroller, which the visible guidance must say explicitly.

## 3. Colour reads a value; it does not judge it

Take the ramp family from `meta.metrics[<key>].scale`: `diverging` for signed
quantities, `sequential` for magnitudes. **Never consume `direction`** — the
contract records it as documentation only, and the lab has decided colour need only
represent values legibly. When no scale is declared, the family is inferred from
the sign of the data and the legend states that it was inferred. Keep every ramp
colour-blind safe, and never encode meaning in colour alone.

## 4. Expression basis is per gene, and a proxy is never a measurement

`expressionBasis` is `measured`, `proxy`, or `null`. The site adds a fourth state,
`unrecorded`, for a dataset that predates the field. **`unrecorded` must never be
read as a measurement.** A measured abundance and a CAI/tAI proxy rank are
different quantities in different units and must never share a column presented as
one measurement.

Wherever an expression value appears, the basis appears beside it. The
measured-only filter hides itself when no gene records a basis, because filtering
on a field the dataset lacks would be a lie. Do not assume a single measured
source: more than one may exist, so label by basis and source id rather than by
assuming which dataset supplied a value.

The gene-level `expressionBasis` describes only the primary PCC abundance field
and its proxy fallback. Every other measured expression source derives its basis
from that metric's own finite value. Native UTEX 2973 TSS is therefore measured
when its TSS value exists and never inherits PCC `proxy` or `measured` status;
its legend counts TSS coverage, not PCC abundance coverage.

## 5. An export must name the scheme that produced it

Target burden and every delta change with the scheme, so a row identified only by
gene is untraceable. Every export writes:

- A **versioned manifest**: dataset identity and checksums, annotation release
  (`null` when unpublished, never inferred), generation time, the complete scheme
  map and name, selected genes, every metric definition and unit, provenance, and
  caveats.
- A **flat CSV** whose every row repeats the manifest identifier and an explicit
  scheme identifier derived from the map itself, so a rename cannot change it.
  Multi-scheme exports use **one row per gene and scheme**, never wider columns.
- Enough to recompute every live metric offline: both coding sequences, the
  terminal stop before and after recoding, exception and segment flags, and the
  expression basis.
- For each shortlisted gene, a separate PCC 7942 essentiality call, PCC locus,
  and join status when available. The manifest names the Adomako/Rubin sources,
  source conditions, and the cross-strain assumption; an absent or ambiguous
  call stays unknown and never becomes nonessential. See
  [the PCC essentiality policy](pcc-essentiality.md).
- A **collision-resistant filename** carrying scheme, timestamp, and part of the
  manifest digest. Two exports must be distinguishable **without** reading
  filenames.

A missing metric exports as an empty cell, never `0`. A gene without a measurement
exports an empty expression cell and never the proxy value.

## Checks

Unit tests, which must stay green:

```sh
node tests/fixtures/make_fixture.mjs
node tests/fixtures/make_fixture.mjs --out tests/fixtures/data-expression --with-expression
node --test "tests/js/*.test.mjs"
```

`tests/js/compare-model.test.mjs`, `tests/js/export-manifest.test.mjs`, and
`tests/js/expression-basis.test.mjs` cover the five contracts above. The
expression fixture deliberately contains genes with no folding energy, genes whose
basis is `proxy`, and genes whose basis is `null`, so the missing-value and basis
rules are exercised rather than assumed.

Against the real dataset:

```sh
node tools/check_live_metrics.mjs
python3 tools/validate_contract.py --data-dir site/data --raw-dir data/raw
```

## Rendered matrix

Source inspection cannot prove any of this; render it. Serve the repository root
so the site and the fixtures are both reachable, then drive state through the URL
hash (`l=` shortlist, `t=` tab, `m=measured` basis filter, `s=` scheme):

```sh
python3 -m http.server 8973 --bind 127.0.0.1
# http://127.0.0.1:8973/site/?data=/tests/fixtures/data-expression/#l=<ids>&t=radar
```

Cover, for radar and parallel coordinates:

| Dimension | Values |
| --- | --- |
| Candidates | 0, 1, 2, 8, 10 |
| Viewports | 375×812, 768×1024, 1440×900 |
| Missing | a candidate with no folding energy; several missing the same axis |
| Basis | a mixed measured/proxy/none shortlist, and the measured-only filter |
| Interaction | focus one candidate across chart, legend, and table |

At each state confirm: every axis name complete, ten identities distinct, the
missing count equal across chart, legend, accessible name, and table, no console
message, and **no page-level horizontal scrolling**.

That last one has a specific trap. The shared metric table is far wider than any
viewport and scrolls inside `.table-scroll`. Without `contain: paint` on that box
its width leaks into the document's scroll area and the whole page scrolls
sideways over thousands of pixels of blank space, at every viewport, while each
container still measures as correctly constrained. Test it by scrolling the window
rather than by reading computed styles:

```js
window.scrollTo(900, window.scrollY); const overflows = window.scrollX > 0;
```
