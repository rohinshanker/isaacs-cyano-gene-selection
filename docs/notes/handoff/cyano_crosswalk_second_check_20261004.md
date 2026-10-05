# Crosswalk second check — PCC 6311 and PCC 7943 — 2026-10-04

```
requester:   owner
target:      mythos / fable (the in-repository agents)
ticket:      docs/notes/tickets/O_cross-strain-data-scan__20260927.md
package:     independent second check of the PCC 6311 and PCC 7943 crosswalk
status:      returned 2026-10-04
```

This is a second check in the sense of
`docs/validation/claude-science-handoff.md`, "Second-checking, not just
fetching": the counts were re-derived from the pinned NCBI releases without
reading the implementation. **Nothing was written to the repository** — the
dispatch asks for the result as session text and a saved artifact, and treats
the mount as read-only, so this file is an artifact only.

## Verdict: all four sides agree

| Side | Against | Total | Matched | Unmatched | Ambiguous | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| UTEX 2973 | PCC 6311 | 2,715 | 2,663 | 52 | 8 | **agrees** |
| PCC 6311 | UTEX 2973 | 2,714 | 2,661 | 53 | 6 | **agrees** |
| UTEX 2973 | PCC 7943 | 2,715 | 2,636 | 79 | 8 | **agrees** |
| PCC 7943 | UTEX 2973 | 2,715 | 2,635 | 80 | 7 | **agrees** |

Every one of the twelve stated numbers — four totals, four matched, four
unmatched — and all four ambiguous counts reproduce exactly. **Matched +
unmatched equals the total on every side** (2,663 + 52 = 2,715;
2,661 + 53 = 2,714; 2,636 + 79 = 2,715; 2,635 + 80 = 2,715), which confirms the
dispatch's statement that ambiguous is a subset of matched and not a third
bucket. No locus disagrees, so `sister-strain-crosswalk-v1.tsv` was never
opened; the dispatch permits opening it only to locate a disagreement.

Machine-readable form: `cyano_crosswalk_second_check_20261004.tsv`, SHA-256
`d578e26d0ba1aca64bcb0b70ed3b972bfa0273bba0a74081541ee55fe1d817d6`.

## Releases retrieved, and confirmation that each is the one named

All three fetched from the NCBI genomes FTP on 2026-10-04. The
`#!annotation-source` line of each GFF3 is quoted, which is what confirms the
annotation release rather than just the assembly accession.

| Strain | File | Bytes | SHA-256 | `#!annotation-source` |
| --- | --- | --- | --- | --- |
| UTEX 2973 | `GCF_000817325.1_ASM81732v1_genomic.gff.gz` | 240383 | `7f606a08892b061667a1988cc05dee889a82f9407066dcf81010ec2e25bb215f` | `NCBI RefSeq GCF_000817325.1-RS_2026_05_13` |
| PCC 6311 | `GCF_022984265.1_ASM2298426v1_genomic.gff.gz` | 238990 | `ed629966691e74e519a249e3fe9a8124993730bc60f84f85ef88641532efbd1f` | `NCBI RefSeq GCF_022984265.1-RS_2025_12_23` |
| PCC 7943 | `GCF_022984345.1_ASM2298434v1_genomic.gff.gz` | 239087 | `0b5579670813b978c4741b86db25dafd14b66a1110bdc09e34ffd3d9fe9b77b7` | `NCBI RefSeq GCF_022984345.1-RS_2025_12_23` |

Each `#!annotation-source` string matches the release the dispatch pins,
character for character. The `#!annotation-date` lines agree with them:
05/13/2026, 12/23/2025 and 12/23/2025.

## How the counts were derived

Only the GFF3 was read. For every `CDS` feature the `locus_tag` and
`protein_id` attributes were taken; nothing else — not product text, not
coordinates, not sequence — entered the join.

| Strain | CDS lines | Protein-bearing loci | Distinct protein accessions | CDS with no `protein_id` |
| --- | --- | --- | --- | --- |
| UTEX 2973 | 2723 | **2715** | 2711 | 7 |
| PCC 6311 | 2724 | **2714** | 2712 | 9 |
| PCC 7943 | 2725 | **2715** | 2712 | 9 |

The protein-bearing locus totals — 2,715, 2,714 and 2,715 — are the dispatch's
totals, reached independently. Every CDS carries a `locus_tag`; the handful
without a `protein_id` are the only CDS lines excluded, and no locus in any of
the three genomes carries more than one distinct protein accession.

A locus was called **matched** when at least one of its protein accessions also
appears on a locus of the other strain, **unmatched** otherwise, and
**ambiguous** when matched but the mapping is not one-to-one — that is, unless
it reaches exactly one counterpart and that counterpart reaches back to exactly
this one locus.

**The agreement is robust to how the ambiguity clause is read.** The dispatch
phrases it two ways — a protein attached to more than one locus on either side,
or a locus reaching more than one counterpart. Both were implemented
separately, and they return identical counts on all four sides, so the
agreement does not rest on a particular reading.

## Why the counts are what they are

All 29 ambiguous calls across the four sides trace to **four duplicated
proteins**, and nothing else:

| Protein | UTEX 2973 loci | PCC 6311 loci | PCC 7943 loci |
| --- | --- | --- | --- |
| `WP_011243185.1` | M744_RS07945, M744_RS12910 | PCC6311_RS03400 | PCC7943_RS03400 |
| `WP_011242480.1` | M744_RS09190, M744_RS11690 | PCC6311_RS04685 | PCC7943_RS04685, PCC7943_RS07235 |
| `WP_011242807.1` | M744_RS10890, M744_RS10915 | PCC6311_RS05475, PCC6311_RS05500 | PCC7943_RS05475, PCC7943_RS05500 |
| `WP_011242808.1` | M744_RS10895, M744_RS10920 | PCC6311_RS05470, PCC6311_RS05495 | PCC7943_RS05470, PCC7943_RS05495 |

That table predicts each ambiguous count exactly, which is a second, independent
way of arriving at them:

- **UTEX 2973, 8 either way.** Each of the four proteins sits on two UTEX loci,
  so 4 × 2 = 8 UTEX loci are ambiguous against either sister.
- **PCC 6311, 6.** Two of the four proteins are single-copy in PCC 6311 but reach
  two UTEX loci each (2 loci), and two are two-copy (4 loci). 2 + 4 = 6.
- **PCC 7943, 7.** One protein is single-copy (1 locus) and three are two-copy
  (6 loci). 1 + 6 = 7.

The asymmetry between the sides is therefore a real gene-duplication difference
between the strains, not an artefact of the join. The full locus lists are in
the `ambiguous_loci` column of the TSV.

## What this check does and does not establish

- It establishes that the **coverage counts are reproducible** from the pinned
  releases under the stated join rule, by code that never saw `tools/`,
  `sister-strain-crosswalk-v1.tsv`, `tests/`, or
  `docs/validation/sister-strain-crosswalk.md`.
- It does **not** check the crosswalk file's contents row by row. Agreement on
  four counts is consistent with, but does not prove, agreement on every
  mapping. A row-level check would need the file opened, which the dispatch
  reserves for a disagreement.
- **The dispatch supplied the target numbers**, so this is a reproduction of the
  method against a known answer, not a blind estimate. The mitigation is that
  the derivation is mechanical and the code is described above in full; the
  counts fell out of it rather than being matched to.
- **One disclosure on the reading restriction.** In a prior session on this
  machine, a different package loaded every file in `docs/validation/` into a
  variable in bulk, which included `sister-strain-crosswalk.md`. Its contents
  were never printed, quoted or otherwise surfaced, and that kernel has since
  been discarded. No restricted file was opened in this session.

## Boundaries observed

The crosswalk was not edited and no mapping was proposed for any unmatched or
ambiguous locus. No source was admitted. Nothing was written to the repository.
No work was done outside this scope.
