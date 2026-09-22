# Protein identity and evidence admission

This release separates four questions that must not be collapsed:

1. Does the pinned RefSeq annotation contain a protein record for this CDS?
2. Was that exact amino-acid sequence present in a proteomics search database?
3. Was the protein experimentally detected under a stated method and threshold?
4. Is there sequence-backed experimental evidence about this allele or a characterized homolog?

The admitted, CI-checked row-level audit is
`data/protein-evidence/releases/GCF_000817325.1-RS_2026_05_13-protein-evidence-v1/protein-identity-v1.tsv`.
The optional, unadmitted historical search-database observation is a separate
`pass00399-local-observations-v1.tsv` in the same release directory. It is never
required to rebuild or check the RefSeq identity audit.
Its machine-readable source, method, criterion, reuse, ambiguity, and missingness
policy is `data/manifest/protein-evidence-v1.json`. Source bytes under
`data/protein-evidence/source/` are gitignored because PASS00399 states a public
download/citation policy but no explicit data licence. The unverified local
observations are labeled as such in their separate artifact.

## RefSeq identity result

All 2,715 included loci have a `protein_id`, an exact independent translation of
the complete spliced CDS, and an identical sequence in the pinned RefSeq protein
FASTA. There are 2,711 unique protein IDs. Eight locus rows are deliberately marked
ambiguous because four accessions each serve two loci:

- `WP_011243185.1`: `M744_RS07945`, `M744_RS12910`
- `WP_011242480.1`: `M744_RS09190`, `M744_RS11690`
- `WP_011242807.1`: `M744_RS10890`, `M744_RS10915`
- `WP_011242808.1`: `M744_RS10895`, `M744_RS10920`

Thus the exact RefSeq result is 2,715 matched, zero unmatched, and eight
ambiguity-marked loci. “Ambiguous” means a valid shared accession, not a failed
sequence comparison.

Translation uses [bacterial table 11](https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi#SG11)
and accepts all seven allowed start codons. It
treats an alternative start as methionine,
requires exactly one terminal stop, and rejects internal stops. NCBI's CDS FASTA
already supplies joined bases in coding order. This matters for `M744_RS00920`
(`prfB`): its two segments skip genomic base 169693 for annotated ribosomal
slippage. The joined 1,122-nt CDS independently translates to the exact 373-aa
`WP_155813972.1` record; coordinates are not filled or shifted.

## PASS00399 disposition

PASS00399 lists 24 high-pH fractions for UTEX 2973 and 24 for PCC 7942. The
inspected local copy contains a 2012 UTEX search FASTA with 2,645 target records
plus 16 common contaminants, raw instrument data, raw SEQUEST hit tables, job
metadata, and sample metadata. The paper instead says accepted identifications
came from MSGF+ with decoy searching at approximately 0.1% unique-peptide FDR. No
accepted MSGF+ peptide/protein table or equivalent final thresholded relationship
is deposited. One inspected raw SEQUEST file contained every ranked candidate down
to short, low-scoring matches, confirming that its rows are not an accepted
detection list.

The dataset page and file listing were reached through verified HTTPS, but its
files were available only from an FTPS host whose certificate did not match the
hostname. PeptideAtlas publishes no upstream checksum for these files. The
manifest's locally computed SHA-256 values detect later drift in the inspected
copies; they do not prove source authenticity. Consequently the search FASTA is
not admitted evidence. The separate observation artifact labels every row
`unverified_transport` and keeps the following counts explicitly as local
observations.

Exact full-sequence comparison against the inspected copy maps 2,281 current loci;
434 are absent from that copy. Eight mapped loci remain inseparable because each
pair has the same full protein sequence. `kaiA`, `kaiB`, and `kaiC` each have one
observed exact search record. `prfB` is not observed because its current joined
373-aa record does not occur in the inspected 2012 database.

Even verified search-database presence would prove only that a sequence could have
been searched, not that a peptide was accepted. Therefore every row records
`experimentally_detected=unknown`, not false. The paper's aggregate claim of 1,754
UTEX proteins is retained as publication context but is not assigned to current
loci without the accepted result table. This also respects the paper's warning
that most detected peptide sequences are indistinguishable between UTEX 2973 and
PCC 7942.

When the cohort UI exposes these evidence tiers, offer RefSeq protein-record and
direct UTEX 2973 detection as separate choices. Show direct detection as
unavailable with a short explanation that PASS00399 has no accepted per-locus
identification list. An empty result would incorrectly imply no proteins were
detected.

## Ungerer cross-reference

Ungerer et al. (2018), DOI `10.1073/pnas.1814912115`, supplies variant-level
experimental evidence for three old locus tags that the pinned RefSeq GFF maps
directly to current loci:

| Old locus | Current locus / protein | Admitted evidence |
| --- | --- | --- |
| `M744_01335` | `M744_RS01270` / `WP_011243489.1` | UTEX `atpA` allele growth effect and ATP-synthase activity |
| `M744_02605` | `M744_RS02500` / `WP_039755507.1` | paired coding variants plus promoter deletion in the tested `rpaA` allele |
| `M744_04780` | `M744_RS04595` / `WP_011244107.1` | UTEX `ppnK` allele growth effect and NAD(+)-kinase kinetics |

The build verifies each old locus tag against the pinned GFF gene feature and
each protein ID against the exact RefSeq row. These are stored as
`tested_variant_evidence`, not as generic homolog function. The
`tested_variant_growth_condition` field applies to the growth phenotype only;
AtpA and PpnK activity results came from separate in-vitro assays.
The remaining screened variants, product-name similarities, and all untested loci
remain unknown. No function is transferred from a name or from strain similarity.
The static candidate view is derived with `python3 tools/candidate_evidence.py build`.
It places these three tested UTEX alleles first, states the paper's growth
condition and separate in-vitro assays, then shows the independently sourced
PCC 7942 essentiality call where an exact cross-strain join supports it.
Adomako et al. 2022 Data Set S1 republishes Rubin 2015 calls under CC BY 4.0;
the original Rubin Dataset S3 is not redistributed. The [PCC essentiality
runbook](pcc-essentiality.md) documents this separate evidence tier. Every
candidate disclosure labels applying a PCC call to UTEX 2973 as an assumption;
unknown and ambiguous calls are never rendered as nonessential.

## Reproduction

Acquire the four pinned RefSeq files (CDS nucleotide and translation FASTAs,
protein FASTA, genomic GFF) with `tools/fetch_genome.sh data/raw`. The verified
RefSeq identity rebuild requires no PASS00399 files and runs in CI:

```sh
python3 tools/protein_evidence.py verify
python3 tools/protein_evidence.py build
python3 tools/protein_evidence.py check
python3 tools/candidate_evidence.py check
python3 -m unittest discover -s tests/readiness -p 'test_protein_evidence*.py'
```

The four PASS00399 paths named by the manifest document the inspected dataset, but
they must not be admitted until PeptideAtlas supplies either a verified HTTPS file
endpoint or an upstream checksum. If verified copies become available, preserve
their paths under `data/protein-evidence/source/pass00399/`, replace the local-only
integrity status, and rerun the admission review. To reproduce the current local
observation from already acquired copies, run:

```sh
python3 tools/protein_evidence.py verify-pass
python3 tools/protein_evidence.py observe-pass
python3 tools/protein_evidence.py check-pass
```

`verify-pass` refuses a size or locally recorded SHA-256 mismatch. For PASS files
that is only a drift check, not authentication. Each `check` command rebuilds its
own artifacts and requires byte-for-byte equality with the tracked version.
