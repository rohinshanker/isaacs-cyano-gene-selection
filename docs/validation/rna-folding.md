# Exact on-demand RNA folding

`scripts/rna_context.py` produces the minimal context specified in
[data-contract.md](data-contract.md). Do not replace genomic start windows with
CDS-only windows or introduce ATG at a non-ATG initiation site. The pipeline checks
the context round trip against its original genomic extraction before writing.

The browser constructs both WT and recoded windows from exact input, then sends
them to a lazily created module worker. The worker imports the local engine only
on demand. It uses ViennaRNA 2.7.2, Turner 2004, 37 °C, dangles 2, salt 1.021 M,
GU and lonely pairs allowed, minimum loop size 3, linear/unconstrained folding,
and no G-quadruplexes. All remaining fields are 2.7.2 defaults. Delta is recoded
minus wild type, in kcal/mol; positive does not mean biologically better.

Engine source, compiler, archive and asset hashes, redistribution terms, and
rebuild instructions are in
[`site/vendor/viennarna/PROVENANCE.md`](../../site/vendor/viennarna/PROVENANCE.md).
Preserve the upstream custom ViennaRNA license and attribution. Check hash
changes and rerun numerical comparisons whenever rebuilding or upgrading.

## Cache and lifecycle

The tab keeps up to 1,000 successful gene results in memory, evicting the oldest.
The key includes SHA-256 of the actual dataset's source checksums, alphabet,
gene identifiers, packed CDSs, terminal stops and RNA contexts; gene ID;
canonical sorted scheme map; and all engine/version/build/model settings.
Datasets are immutable after loading; a different dataset object is rehashed.
Changing only the scheme's display name does not invalidate equivalent work.
Failures are never cached. Identical repeated requests do no native work.

Cancellation terminates the worker, retaining completed results in cache. A
successful worker response delivered before cancellation is retained even when
the awaiting continuation has not run yet; undelivered work is cancelled, and no
next gene is dispatched. The cancelled report includes those delivered results.
A changed shortlist or scheme cancels pending work and clears displayed results so
an old scheme is never labelled as current. Invalid context fails only that gene.
Workers, WebAssembly and a secure context (HTTPS or localhost) are required.
Offline calculation works when the engine is already loaded or HTTP-cached; an
unavailable engine produces an explicit error and permits retry. No sequence is
sent to an external service. A stalled worker times out after 30 seconds.

## Oracle regeneration

`tests/fixtures/rna-folding.json` is a tracked numerical oracle. Regenerate it
only after an intentional, reviewed engine or folding-contract change, then
inspect and commit the resulting diff. It is not a routine release-gate step.

```bash
python tools/rna_wasm/make_references.py
```

## Regression commands

Use the project's Python environment with ViennaRNA pinned to 2.7.2:

```bash
python -m pytest tests/test_rna_context.py tests/test_feature_metrics.py -q
node --test --experimental-test-coverage tests/js/folding.test.mjs
node tests/fixtures/make_fixture.mjs
node tests/fixtures/make_fixture.mjs --out tests/fixtures/data-expression --with-expression
node --test tests/js/*.test.mjs
python tools/validate_contract.py --raw-dir /path/to/verified/data/raw
```

The committed numeric fixtures independently edit a whole synthetic genome and
extract both windows. They cover both strands, origin wrapping, short CDSs,
overlaps, discontinuous CDSs, non-ATG initiation, identity/Syn61/stop-reassignment
schemes, and preserved terminal stops. Require absolute error **≤ 1e-5 kcal/mol**
for every WT and recoded energy. The whole-genome Python test also checks all
2,715 serialized start windows against the existing published WT MFE.

The independent standard-library release validator rejects mixed or malformed
context forms, wrong lengths/bases, boolean or out-of-range offsets, duplicate
mapped offsets, a missing start anchor, and mapped bases inconsistent with the
complete CDS. When raw genomic FASTA and GFF files are available, it independently
reconstructs the CDS, circular strand-oriented window, and exact edit map from
GFF coordinates, including joined and origin-spanning annotations. Missing raw
inputs are explicitly reported as a skipped genomic check; structural checks
always run. Regression tests: `python -m pytest tests/test_rna_contract_validator.py`.

For a CDS split across multiple GFF rows, validation orders bases in strand
direction on the circular replicon and rotates the segments after their unique
largest inter-segment gap. It therefore handles a join that crosses the origin
without trusting GFF row order or an ordinary numeric coordinate sort. Focused
fixtures cover both strands, reversed row order, overlapping origin segments,
and an ambiguous segment layout that must fail closed.

## Browser regression

Serve the repository root on an unused task-specific port:

```bash
python -m http.server 8863 --bind 127.0.0.1 --directory "$PWD"
```

In a second terminal, from the same worktree:

```bash
mkdir -p .playwright-cli/rna-folding
PLAYWRIGHT_MCP_OUTPUT_DIR="$PWD/.playwright-cli/rna-folding" \
  playwright-cli -s=rna-folding-8863 open \
  "http://127.0.0.1:8863/site/?rnaArtifacts=$PWD/.playwright-cli/rna-folding"
playwright-cli -s=rna-folding-8863 run-code --filename=tools/rna_wasm/check_browser.js
```

Inspect the emitted whole-page and folding-region PNGs, the semantic snapshot,
and the returned parity/responsiveness/diagnostic report. The check asserts
32-case real-worker parity, ten-gene responsiveness, cache hits, loading,
cancellation, offline error, per-gene partial failure, unsupported browser and
empty states. It verifies no page overflow across the required viewport matrix,
including both sides of the 960 px and 1240 px layout breakpoints. Unexpected
errors fail the check;
network failures are expected only in the intentional cancellation/offline cases.
The responsiveness gate first loads the engine and hashes the dataset using a
different gene, then measures ten uncached genes on that warm worker. It reports
fresh-worker startup and repeated-result-cache timings separately (the browser's
HTTP/compile caches may already be warm), and allows a timer tick after the
workload so synchronous blocking cannot hide its final gap. Coverage is
stopped in `finally`, including on failed assertions.

The overlap fixtures include an annotated upstream neighbor on each strand,
sharing seven bases with the selected CDS. Its nonshared TCG-containing flank is
unchanged. A CTA→CTG substitution in the selected gene changes the neighbor's
overlapping TAG stop to TGG, explicitly demonstrating the neighbor-safety caveat.
Short-CDS cases are separately labelled; they do not imply a neighboring CDS.

The focused Node suite hashes both shipped `vienna.js` and `vienna.wasm`, compares
them with literal pinned SHA-256 values and the provenance table, and checks that
one-byte corruption changes each digest. The runtime also verifies the WASM hash.

No new test dependency or screenshot baseline is needed. Artifacts are ignored
and must not be copied into permanent docs. Broad layout changes still need the
main site's independent render checks.

## trRosettaRNA hand-off

The shortlist panel can prepare a pinned or shortlisted locus as wild type or under
the current recoding scheme. It uses the same strand-oriented sequence constructor
as folding. Regions are the exact `[-30,60)` start window, the full CDS including
its stop, or an inclusive coordinate range inside `[-30,59]`. For ordinary upstream
context those are strand-oriented positions around the start. For the alternate
`{sequence, cdsOffsets}` genomic context, a requested nonnegative transcript span is
returned only when every mapped base is present in adjacent genomic-window positions;
the panel refuses spans that cross an intron or exceed the highest supplied CDS offset
and names the applicable limit. The range validator fails closed rather than labelling
intron or downstream genomic bases as transcript sequence.

Plain RNA, FASTA, single-sequence A3M/A2M, and Stockholm always carry the same
`ACGU` sequence. Dot bracket and CT are added only when a completed ViennaRNA 2.7.2
result reports the identical folded sequence and active scheme. CT base pairs are
generated from that dot bracket with the matching MFE in the standard
`<length> ENERGY = <mfe> <name>` header and tested by round trip. The standalone
trRosettaRNA2 package documents CT as a supported custom-secondary-structure input.
Each successful copy or download records the locus, form, scheme, region, only the
format actually taken, SHA-256 sequence hash, and (for dot bracket or CT only) the
ViennaRNA version in the next candidate export manifest. A blocked clipboard write
uses the browser copy-command fallback and reports an error without recording an
action if both paths fail.

The external server form was inspected on 2026-09-22. It documents no URL query
prefill and test query values did not populate the form, so the site opens the plain
submission page. It never submits sequence itself. Warn for lengths outside the
30–200 nt training range, recoded sequence homology limits, external privacy and
terms, Apache-2.0 standalone code, and separate PyRosetta licensing.
