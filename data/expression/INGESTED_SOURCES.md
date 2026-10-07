# Ingested expression layers

Each layer listed in `sources.json` with an `ingest` block was produced by
`tools/ingest_expression.py` from the spec of the same study under
`data/expression/ingest/`. The spec pins the deposited file's URL and SHA-256,
names the sample columns of each layer, and carries the structured condition
record; the tool re-downloads the file into `data/interim/expression/` (not
tracked), refuses a checksum mismatch, averages the layer's samples, and maps
the study's PCC 7942 identifiers to UTEX 2973 locus tags through the pinned
identifier crosswalk, one-to-one rows only, exactly as the shipped GSE205444
table was mapped (see `PROVENANCE.md`). A protein deposit keyed by UniProt
accession first passes through `ingest/uniprot_pcc7942_orf_names.tsv`, UniProt's
accession-to-ordered-locus table for the strain (CC BY 4.0, pinned here), and a
deposit inside an archive names its member (`reader.zipMember`). A deposit of
search-engine output rather than a table (`reader.format: dtaselect`, with
`zipMembers`, one DTASelect filter report per run) is read by `read_dtaselect`:
only the protein lines are taken, each run becomes one count column named by
its file stem (`countColumn`, default `Spectrum Count`), a locus of the UniProt
FASTA form `ACCESSION_ENTRY_ORGANISM` becomes its accession, reversed-sequence
decoys are dropped, and a contaminant or introduced gene keeps its name and
does not map. A table that lists features besides genes, or wraps each locus
tag in a feature prefix, names the identifiers to read (`reader.idPattern`, a
regular expression the whole identifier must match; its first group, if any,
is the identifier the crosswalk reads): GSE237858 reads `gene-` features and
leaves its `rna-` and novel-transcript rows, GSE254350 reads `Synpcc7942_`
synonyms and leaves its 116 `predicted RNA` rows, and every row outside the
pattern is counted among the layer's unmapped identifiers. An identifier
column the deposit leaves unnamed (GSE335065 and GSE311172) is named by the
empty string. A deposit that splits its replicates over several files names
them in `files` rather than `file`, each with its own checksum and a short
`label`; they are read side by side, joined on the identifier, and every
column takes its file's label as a suffix, exactly as several sheets of one
workbook are joined (GSE225426, whose two replicates are two workbooks).
Every `.tsv` here is reproducible from its spec; rerun the tool to regenerate
it. Fitness uses a `fitness` numeric column; transcript/protein tables use
`abundance`. The source's declared data type determines the quantity, including
whether a negative value is valid.

The Fitness Browser input is manually acquired. Stage the owner's pinned
`fit_organism_SynE.tsv` and `exp_organism_SynE.txt` in
`data/interim/expression/`, then run
`.venv/bin/python tools/build_fitness_browser_spec.py --check` before ingestion.
Its organism-page URL identifies the resource and is not a downloadable TSV.
Do not replace a valid cache with an HTML access challenge. See the
[fitness-source contract](../../docs/validation/fitness-screen-data.md) for pins,
all 129 experiments in 90 condition sets, exact joins and uncertainty rules.

## What a layer's value is

The arithmetic mean over the layer's sample columns of the value as deposited,
except where the spec's `normalization` is `cpm`: a raw-count table is first
scaled per sample to counts per million over the genes it reports, so that
replicates with different library sizes weigh equally; spectral counts take the
same scaling, per million filtered spectra in the run. `units` in each manifest
entry says which. Nothing is imputed: a gene absent from the deposited table, or
whose identifier does not map one-to-one, has no value and renders as unknown.

## What a layer is not

A layer is one condition set of one study restricted to its control or
wild-type genotype and one treatment arm. Time points inside an arm are
averaged, which removes the time structure the study was designed around; the
layer's `conditionSet` says so. None of these layers is UTEX 2973 data: every
one is a transfer from PCC 7942 under the sister-strain rules, labelled as such
wherever it is shown, and none is pooled with another without a recorded lab
judgement. A layer measured in an engineered derivative (PXD030282's
limonene-producing L1118, GSE288532's and GSE335065's cscB-sps, GSE89999's
clock rescue, GSE103463's and GSE105774's complemented rel deletion, GSE103644's
inducible relA, GSE51112's RpaA-phosphomimetic and empty-vector arms,
GSE311172's oxygen-adapted populations) is listed
under "Engineered strain" and its record names the strain. Where one deposit
holds several genotypes, a layer names its own strain (`layer.strain`), as
GSE51112's four layers do.

Regenerate:

```sh
for spec in data/expression/ingest/*.json; do ./.venv/bin/python tools/ingest_expression.py "$spec"; done
./.venv/bin/python scripts/build_features.py
./.venv/bin/python tools/build_data_manifest.py build
```
