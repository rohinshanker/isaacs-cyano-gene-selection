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
changed shortlist or scheme cancels pending work and clears displayed results so
an old scheme is never labelled as current. Invalid context fails only that gene.
Workers, WebAssembly and a secure context (HTTPS or localhost) are required.
Offline calculation works when the engine is already loaded or HTTP-cached; an
unavailable engine produces an explicit error and permits retry. No sequence is
sent to an external service. A stalled worker times out after 30 seconds.

## Regression commands

Use the project's Python environment with ViennaRNA pinned to 2.7.2:

```bash
python tools/rna_wasm/make_references.py
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

For the browser, serve the repository root on an unused task-specific port:

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
24-case real-worker parity, ten-gene responsiveness, cache hits, loading,
cancellation, offline error, per-gene partial failure, unsupported browser and
empty states. It verifies no page overflow at the four required viewport sizes
and around the app's layout breakpoints. Unexpected errors fail the check;
network failures are expected only in the intentional cancellation/offline cases.

No new test dependency or screenshot baseline is needed. Artifacts are ignored
and must not be copied into permanent docs. Broad layout changes still need the
main site's independent render checks.
