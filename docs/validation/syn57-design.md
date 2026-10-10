# Ec_Syn57 complete-design record

The `ecoli-syn57-design` organism is the complete publisher-supplied Ec_Syn57
design, not an evolved or measured strain. Its map, chromosome view, search,
exports and gene detail all use the design's own 3,973,902 bp coordinate system.
No Syn61 sequence, preset, measurements or coordinates may fill a Syn57 field.

## Source identity

The ignored, publisher-supplied build input is `data/raw/recoded-ecoli/Ec_Syn57.gb`. It must have
SHA-256
`8c61aeebfb8fef71a9d01ceba2a2acdb8babdf96ac0aa01aae36b10d08f77f96`, one
circular `Ec_Syn57` record, and exactly 3,973,902 bases. The builder also gates
the GenBank description, organism, design identifier and feature counts before
writing anything. The input contains 3,640 CDS and 85 tRNA features; the viewer
admits 3,588 coding genes after the shared CDS-quality exclusions.
The sequence-only SHA-256 is
`5ad86e64fa142b009c159dddd4c1eccf5cce6e8bafa8c374cbfb6e9bc8e07033`.

Fetch the pinned publisher inputs, then rebuild or compare the checked-in
publication:

```bash
.venv/bin/python tools/fetch_recoded_ecoli.py
.venv/bin/python tools/build_syn57_design.py
.venv/bin/python tools/build_syn57_design.py --check
.venv/bin/python tools/validate_contract.py --organism ecoli-syn57-design
```

The dedicated builder normalises the single publisher GenBank record into the
same deterministic intermediate contract used by the other organisms, then
uses the shared feature, codon PCA, RSCU and overlap builders. `meta.json`
records the source filename, SHA-256, design identity, topology, counts and the
explicit `design-only` evidence status. The source file remains ignored; the
published JSON is reproducible from an independently acquired matching copy.
`source_feature_audit.json` preserves each source CDS index, qualifier identity,
native location, fuzzy/compound status and deterministic local ID, including
four repeated source identifiers and two CDSs without a `locus_tag`. It also
records every CDS inclusion/exclusion result.

None of the 85 tRNA features has an explicit anticodon qualifier. The defined
approximate annotation model follows four distinct source-backed routes: it
reverse-complements 75 ordinary codon-recognition notes, uses three explicit
initiator anticodon notes as stated, applies one Sec special convention but
excludes it from the elongator decoding pool, and excludes six features with no
supported note. The audit keeps each route and decision. These modeled labels
are not established genomic anticodons or experimental charging, expression or
fitness measurements; tAI and its dependent proxy say so explicitly.

Every normalized CDS receives a deterministic `Ec_Syn57_local_protein_feature_*`
translation ID. Those IDs are local derived identifiers, never NCBI accessions;
the source audit separately preserves the publisher's original `protein_id`
qualifiers. Forty-seven source CDS records omit that qualifier, including two of
the 3,588 admitted genes; local IDs cover them without inventing accessions.
Translation treats the annotated first triplet as bacterial initiation
methionine, retains internal residues and stops, and removes only one terminal
stop. This keeps all 3,640 translations independently addressable without
changing public CDS IDs, coordinates or packed sequences.

The article evidence is the [Europe PMC fullTextXML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13287592/fullTextXML),
retrieved 2026-10-10: 318,246 bytes, SHA-256
`0f819b794c2bd9e83669157439552b16555d75d97153676e2c348b2eb9381a69`.
Mechanical text matches locate "complete E. coli genome" and "a strain with a
distinct recoding scheme" in Introduction, and "Creative Commons
Attribution-NonCommercial-NoDerivatives 4.0 International License" in permissions.
These distinguish the complete design from the other Syn57 strain and retain
source terms. Publication follows the owner's 2026-10-06 citation-only
derived-data decision. A changed source pin requires a new identity check.

## Product contract

- The address is `?org=ecoli-syn57-design`, storage is under
  `recoding-map.ecoli-syn57-design.*`, and exported filenames/manifests carry
  `ecoli-syn57-design`.
- Navigation has three top-level choices in this order: Cyanobacteria,
  Recoded E. Coli, E. coli. The recoded disclosure lists Syn57 before Syn61;
  inactive disclosures remain neutral and name neither record.
- The Recoded Genome Scheme panel names the Ec_Syn57 seven-codon design and
  counts its own AGC, AGT, TTA, TTG, AGA, AGG and TAG residuals. Its declared
  preset is `ec-syn57`, never `syn61`.
- Sequence-derived PCA, CAI, tAI and codon values are design context, not
  measurements. Expression, omics, growth and fitness layers are absent and
  their controls must not appear. Missing source values remain absent, never
  zero.
- The Recoded Genome Scheme facts live inside the existing `scheme` panel body.
  The same three panel IDs remain in force, so the facts and editor move,
  collapse and reload together through ordinary `po`/`pc` URL state; organism
  navigation creates no pinned or fourth panel.

## Browser validation

Serve the repository root and open the site with an absolute ignored artifact
directory, then run the reusable navigation check:

```bash
python3 -m http.server <port> --bind 127.0.0.1 --directory "$PWD"
PLAYWRIGHT_MCP_OUTPUT_DIR="$PWD/.playwright-cli/<session>" \
  playwright-cli -s=<session> open \
  "http://127.0.0.1:<port>/site/?uiArtifacts=$PWD/.playwright-cli/<session>"
playwright-cli -s=<session> run-code \
  --filename=tools/ui/check_organism_navigation.js
```

Inspect Syn57 and Syn61 at 375x812, 768x1024, 1280x800 and 1440x900. On Syn57,
exercise map, chromosome, gene search, its seven-codon scheme, keyboard focus,
panel reorder/collapse and reload persistence. Also open a missing data override
and verify a visible load error with no stale genome. Browser diagnostics must
contain no page errors, failed requests or console errors during healthy loads.

The final repository gates are `npm test`, `.venv/bin/python -m pytest -q`,
`.venv/bin/python tools/validate_contract.py`, and
`node tools/build_module_preloads.mjs --check`.

For the stronger source-backed protein gate, normalize the admitted GenBank
record into a temporary raw directory and run:

```bash
.venv/bin/python tools/validate_contract.py \
  --organism ecoli-syn57-design --raw-dir <normalized-temp-directory>
```

The persistent Syn57 tests perform this check when the pinned ignored publisher
source is present. Standalone `tools/build_syn57_design.py --check` first
validates both content manifests, then rebuilds in a temporary directory and
performs timestamp-normalized comparison; a stale checksum is never normalized
into acceptance.
