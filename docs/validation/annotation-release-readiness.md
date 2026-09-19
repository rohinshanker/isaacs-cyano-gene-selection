# Annotation Release and Identifier Readiness Runbook

- Purpose: reacquire, verify, reproduce, and consume the versioned annotation layer.
- Genome: *Synechococcus elongatus* UTEX 2973, `GCF_000817325.1`.
- Annotation: `GCF_000817325.1-RS_2026_05_13`, PGAP 6.11, 2026-05-13.
- Manifest: `data/manifest/annotation-release-v1.json`.

The feature build consumes `annotation-evidence-v1.jsonl` and
`go-annotations-v1.tsv` only after verifying their release-summary SHA-256s. It
joins every published site gene by exact locus tag and writes the preserved
relationships to `site/data/annotations.json`. The browser requires that file
when `meta.annotationRelease` is declared, joins it to the in-memory genes, and
exposes it in a collapsed gene-detail disclosure. The separate file keeps the
map's core `genes.json` within its interaction budget. The crosswalk remains a
release/audit artifact rather than being flattened into one assumed identifier
per gene.

## Reproducible commands

From the repository root:

```sh
# Fetches only missing or invalid files, through pinned direct URLs, then checks
# byte sizes and MD5s before atomically installing them.
python3 tools/annotation_release.py fetch

# Independently validates every input and both pinned NCBI annotation releases.
python3 tools/annotation_release.py verify

# Rebuilds the tracked crosswalk, evidence, GO, and summary artifacts.
python3 tools/annotation_release.py build

# Rebuilds in a temporary directory and requires byte-for-byte equality.
python3 tools/annotation_release.py check

# Runs checksum/release negative cases without third-party dependencies.
python3 -m unittest discover -s tests/readiness -p 'test_*.py'
```

`fetch` covers 15 files: nine core UTEX inputs, the five assessed UTEX
companions, and one release-pinned PCC 7942 GFF used only for the exact protein
crosswalk. Existing valid files are reused. `--force` reacquires every input.

## Release gates

The validator fails before generation when any of these change:

- a required manifest field, role, local path, or direct URL boundary;
- byte size or MD5 of any input;
- UTEX assembly accession, organism, strain, or taxid;
- RefSeq annotation name/date or the annotation-hash timestamp;
- assembly length of 2,744,626 bp;
- feature-count rows for 2,715 protein-coding loci, seven pseudogenes, 2,711
  unique proteins, and 2,715 protein placements;
- the PCC 7942 annotation release used for cross-strain identifiers;
- the exact four RefSeq protein IDs shared by two UTEX loci; or
- the exact discontinuous-CDS set, including the split `prfB` CDS.

CI runs this gate and its negative tests independently of the site's contract
validator and pipeline tests. The Pages artifact is unavailable until all gates
pass.

## Identifier crosswalk contract

`identifier-crosswalk-v1.tsv` has one row per relationship. Never pivot it into
one assumed row per gene without defining a collision policy.

| Column | Contract |
| --- | --- |
| `subject_locus_tag` | Current UTEX RefSeq locus tag and stable subject key. |
| `relationship` | `current_locus_tag`, `old_locus_tag`, `gene_symbol`, `protein_id`, `sequence_accession`, `genomic_location`, `cds_segment`, `pcc7942_ortholog`, or `pcc7942_old_locus_tag`. |
| `object_namespace`, `object_id` | Typed identifier; do not compare untyped strings. |
| `seqid`, `start`, `end`, `strand` | Original NCBI gene span. An end beyond replicon length is NCBI circular-origin notation, not an error. |
| `mapping_ambiguity` | Empty only for a one-to-one relationship. Shared protein mappings are explicitly labelled. |
| `source`, `mapping_method`, `evidence` | Provenance and the exact join evidence. PCC mappings require an exact shared RefSeq protein ID. |

The release contains 22,356 relationships. The exact protein crosswalk yields
2,656 current PCC relationships covering 2,648 UTEX and 2,648 PCC loci; 16 of
those rows are explicitly ambiguous. It also preserves 2,567 PCC legacy locus
relationships. These are cross-strain ortholog candidates by identical RefSeq
protein accession, not claims of functional equivalence.

Four accessions are genuinely shared by two UTEX loci and must remain two
relationships each:

- `WP_011243185.1`
- `WP_011242480.1`
- `WP_011242807.1`
- `WP_011242808.1`

`M744_RS00920` (`prfB`) has two `cds_segment` rows,
`169621..169692` and `169694..170743`. The two circular-origin CDSs,
`M744_RS13290` and `M744_RS13620`, also have two normalized segment rows. Segment
rows are coordinate-sorted; strand plus the source annotation determines coding
order.

## Annotation evidence contract

`annotation-evidence-v1.jsonl` has one JSON object for each of 2,776 annotated
genes, including the seven pseudogenes and all RNA genes. It records:

- pseudogene and partial flags exactly as annotated;
- normalized CDS segments and translational exceptions;
- every overlapping CDS with overlap length;
- every annotated non-protein RNA within 250 nt, with coordinate distance;
- chromosome/plasmid identity;
- raw NCBI annotation method and inference strings; and
- structured protein-name evidence from GenPept.

The release has four partial pseudogenes, one translational-exception locus
(`prfB`), 401 overlapping-CDS pairs affecting 715 loci, and 100 nearby-RNA
relationships affecting 93 loci. Protein-name evidence is available for 2,301
loci. NCBI publishes no numeric confidence for this release, so `confidence` is
always `null`; method, HMM/accession evidence, and inference are preserved rather
than converted into invented certainty.

The 250-nt RNA window is a coordinate proximity feature only. It is not an
operon, transcription-unit, or regulatory-interaction claim.

## GO annotation contract

`go-annotations-v1.tsv` keeps one evidence-coded GO relationship per mapped
locus. It contains 3,898 mapped relationships for 1,584 loci and 1,120 GO IDs.
All 3,886 source GAF rows map; the extra 12 output rows are deliberate expansion
of GO relationships carried by shared protein IDs. Every current relationship is
`IEA`, and the source reference, `with/from`, aspect, assignment date, assigner,
taxon, mapping method, and ambiguity are retained.

The pinned GAF says it was generated by NCBI on 2026-05-14 against GO version
2026-03-25. Gene Ontology data and data products are attributed to the Gene
Ontology Consortium and redistributed under CC BY 4.0. The required copyright,
licence, disclaimer, source traceability, and description of this project's
mapping changes are in `data/annotation/PROVENANCE.md`; keep that notice with
any redistribution of `go-annotations-v1.tsv`.

Do not collapse these rows into an unqualified functional category. A category
layer needs an explicit controlled vocabulary, unknown state, evidence policy,
and validation; the raw GO relationships do not supply those decisions.

### EC and pathway coverage assessment

The retained GenPept file carries 924 EC qualifiers on 893 distinct RefSeq
proteins, covering 556 distinct EC numbers. Exact protein mapping expands this
to 926 locus/EC relationships over 895 UTEX loci because two EC-annotated shared
proteins each map to two loci; no GenPept EC-bearing protein is unmatched.

This is useful enzyme coverage, but it is not a pathway annotation. The pinned
NCBI artifacts contain GO biological-process evidence but no accepted,
release-pinned pathway identifier relationship. Consequently this release does
not infer pathway membership from product words or EC numbers. A future pathway
layer must name its database/release, preserve the EC-to-pathway evidence and
many-to-many relationships, and report unknowns rather than assigning a
heuristic category.

## Companion-file disposition

All five named UTEX companion artifacts were retained because each now feeds a
documented gate or feature:

| Artifact | Disposition |
| --- | --- |
| `annotation_hashes.txt` | Release-integrity gate. |
| `gene_ontology.gaf.gz` | Evidence-coded GO output. |
| `protein.gpff.gz` | Protein-name evidence output. |
| `feature_count.txt` | Exact annotation-count gate. |
| `assembly_stats.txt` | Assembly identity, length, and replicon gate. |

## External-source boundaries

- **UniProt `UP000031358`: not imported.** On 2026-09-18 the current UniProt
  proteome metadata still described the historical 2,641-protein ENA proteome,
  but the current UniProtKB stream for that proteome and for taxid 1350461
  returned no protein records. There is therefore no current accession mapping
  to ingest without silently treating stale metadata as data. Smallest follow-up:
  obtain a dated UniProt archive export for `UP000031358`, pin its release and
  checksum, then join only explicit RefSeq cross-references while retaining
  one-to-many relationships.
- **Rubin et al. PCC 7942 essentiality: not redistributed.** Dataset S3 is
  downloadable from the PMC article as `pnas.1519220112.sd03.xlsx`, and the paper
  reports 718 essential, 157 beneficial, 75 ambiguous, and 1,748 nonessential
  genes. The PMC record supplies only a copyright notice and no explicit reusable
  data licence. Mapping is also cross-strain and must use the ambiguity-preserving
  crosswalk above. Smallest follow-up: obtain written redistribution terms (or
  fetch the supplement at build time without committing it), pin its checksum,
  parse the published calls, and label every mapped value as PCC 7942 evidence.
- **CyanoOmicsDB: not imported.** The cited resource is suitable only as a
  secondary cross-check; no release-pinned bulk artifact and redistribution
  contract was established for this build. Smallest follow-up: identify a stable
  versioned export and licence, then reconcile it against the frozen RefSeq
  coordinates rather than replacing them.
- **KEGG: not imported.** None of the pinned NCBI inputs exposes a KEGG gene
  cross-reference, and no release-pinned KEGG artifact with redistribution terms
  was supplied. Smallest follow-up: use lab-authorized KEGG access, pin the
  response date and checksum, and add relationship rows only where the source
  carries an explicit identifier link.

These are explicit absence states. No essentiality, UniProt, KEGG, pathway, or
heuristic functional-category assertion is present in the generated artifacts.
