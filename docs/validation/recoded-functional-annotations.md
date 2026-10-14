# Recoded functional annotation rebuild contract

Syn57 and Syn61 keep their native gene payload, coordinates, metrics, locus IDs,
symbols and products. `annotations.json` supplies a separate audited display
layer. `functional_annotation_audit.json` records every source CDS, including
excluded CDSs, rejected matches, source references without an exact counterpart,
and the native inventory. Absence of an exact counterpart is not proof of deletion.

Syn57 uses the named MG1655 reference `GCF_000005845.2` / `NC_000913.3`, record
release 2 September 2026. Syn61 first uses public MDS42 `GCF_000350185.1` /
`NC_020518.1` (GenBank `AP012306.1`), record release 3 March 2020. Its optional
MG1655 annotation hop requires another unique identical protein. Neither route
asserts equality with an experimental parental stock. DH10B supplies no functional
annotations here. The admitted MG1655 UniProtKB/GOA release is
`GCF_000005845.2-UniProtGOA_2026-07-28`; RefSeq, EcoCyc, Blattner 1997,
UniProtKB and GOA attribution is carried into each target's citations.
Coordinator source receipts are retained in
`docs/notes/handoff/recoded_functional_source_checks__20261014.json`.

Every accepted hop requires a full-length identical amino-acid sequence unique
among eligible CDSs on both sides. The cardinality check includes CDSs excluded
by the viewer and alternate RefSeq CDSs. A repeated sequence, internal stop,
unknown residue, Sec, pseudogene or fuzzy endpoint cannot establish a join.
Gene names and identifiers identify rejected audit candidates only. Coordinates
never establish a functional join. Raw GenBank SHA-256 pins and admitted MG1655
consumer pins live in `tools/recoded_functional_annotations.py`; a changed pin
requires review, not automatic replacement.

The builder independently compares each plotted protein with its pinned native
translation. Existing nonempty products, including hypothetical proteins, always
win. A locus ID used as a display fallback is not a reported symbol. Missing
symbols/products are filled only when the accepted sources agree. The documented
Syn57 source-null product placeholders retain their
original display value and native null in provenance, and may receive a supported
reference product. Genuine annotated hypothetical/uncharacterized products are
never replaced. Native EC numbers, synonyms and notes are also retained.
Disagreements and ambiguous UniProt mapping claims remain explicit. Categories stay unknown:
no GO term, protein name or inherited UniProt function becomes a lab-reviewed
category, filter, colour or essentiality assertion.

Syn61 has structured `GO_function`, `GO_process` and `GO_component` relationships
in native GenBank notes. These retain the original term name, aspect and evidence
code. Undeclared qualifiers, references and assigners remain blank. Native GO
lists take precedence in their entirety, even for altered or unmatched proteins;
only a missing GO list can inherit MG1655 rows. Native notes and inferences stay
available in detail and exports. GO-set differences against the reference are
audited without changing native rows. Original source GO evidence codes are
reference evidence, never evidence measured in the recoded strain.

Acquire the existing pinned genome inputs with `tools/fetch_genome.sh` for
MG1655, public MDS42 and Syn61; acquire Syn57 with `tools/fetch_recoded_ecoli.py`.
The admitted MG1655 annotation consumer must already reproduce its pinned release.
Then run from the repository root:

```sh
.venv/bin/python tools/recoded_functional_annotations.py
.venv/bin/python tools/recoded_functional_annotations.py --check
```

The normal `build_syn57_design.py` and Syn61 `scripts/build_features.py` CLI builds
also rebuild this layer. When using the lower-level shared `build()` function,
run the transfer builder afterwards. Build manifests last after any other tool
changes a target file. The transfer builder changes no gene or assay payload.

`annotations.json` includes the complete native identity and every accepted
source assembly, record release, locus, source checksum, protein checksum and
method. The browser validates all records before filling missing display fields;
retries preserve direct annotations. Search uses the same effective symbols and
GO relationships as detail. It labels native versus inherited GO, while inherited
reference disclosures identify their provenance and measurement boundary. Export
manifests retain the native annotation and the full transfer record.

The recoded views expose an exact GO term selector with a readable term name.
Literal GO ID/name search narrows the native select and retains the selected
term even when it falls outside the current search; the search changes no evidence.
The selected term has five evidence states: positive, explicit NOT, conflicting
positive/NOT, no positive annotation, and unavailable/obsolete/no-data evidence.
Only nonobsolete terms with evidence other than ND can provide a positive or NOT
assignment. An unchecked ontology status or ambiguous annotation is unavailable.
Colour and filter consume the same states, shared by scatter and chromosome views.
The selected GO ID and evidence filter travel in the `gt` and `gf` URL fields
and in export state. This term interaction creates no broad function category.

Run focused Python and JS transfer tests while editing, then the repository gates
in `AGENTS.md`. The source-backed test independently translates packed target
CDSs, reads reference GenBank translations, checks uniqueness and compares all
accepted protein hashes. It also checks native GO notes mechanically and verifies
deterministic rebuilds without changing native files. Missing ignored source inputs
are an explicit skip, never proof of raw-source validation.

For rendered checks, serve the actual worktree on a unique port and run
`tools/ui/check_recoded_functional_annotations.js` with `playwright-cli` and an
absolute `?uiArtifacts=` directory. Inspect the captured images and semantic
snapshots at 375, 768, 1280 and 1440 pixels, plus adjacent responsive breakpoints.
The check covers inherited symbol/GO search, open/closed disclosures, keyboard
activation, native chromosome identity, unmatched loci, empty search, missing-data
errors, overflow and healthy-load diagnostics. Function-category controls remain
unavailable because no category assignment is admitted.
