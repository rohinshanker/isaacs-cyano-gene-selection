# Sister-strain RefSeq crosswalk

- Purpose: Reproduce and audit the exact shared-protein joins from UTEX 2973 to PCC 6311 and PCC 7943.
- Scope: `sister-strain-crosswalk-v1.tsv`, its release manifest, and its build/check tool.
- Last verified: 2026-09-28

## Pinned inputs

The manifest `data/manifest/sister-strain-crosswalk-v1.json` pins the three RefSeq
GFF3 inputs. Source files are downloaded at build time and are not redistributed in
git.

| Strain | Assembly | Assembly name | Annotation release | Level | GFF3 MD5 | Bytes |
| --- | --- | --- | --- | --- | --- | ---: |
| UTEX 2973 | `GCF_000817325.1` | `ASM81732v1` | `GCF_000817325.1-RS_2026_05_13` | Complete Genome | `61d1557c71a39db3f0cbf3a82ad341a5` | 240,383 |
| PCC 6311 | `GCF_022984265.1` | `ASM2298426v1` | `GCF_022984265.1-RS_2025_12_23` | Chromosome | `9bad74f154650042bf050bd14055acea` | 238,990 |
| PCC 7943 | `GCF_022984345.1` | `ASM2298434v1` | `GCF_022984345.1-RS_2025_12_23` | Chromosome | `0376748ac226277a84f027cacca2f0cc` | 239,087 |

The direct URLs, retrieval date 2026-09-28, byte sizes, and checksums are fixed in
the manifest. The tool verifies each file and checks the assembly and annotation
release identifiers in its GFF3 headers before building.

## Join and ambiguity contract

The only join key is an exact RefSeq `protein_id` present in both GFF3 files.
Product text and coordinates are never join keys. Each unique UTEX locus/sister
locus relationship is emitted once. A protein attached to multiple loci on either
side produces every relationship row, labelled
`shared-protein-many-to-many`; the build never chooses one locus silently.

The artifact uses the same columns as `identifier-crosswalk-v1.tsv`. Current locus
relationships are `pcc6311_ortholog` and `pcc7943_ortholog`; source GFF
`old_locus_tag` qualifiers are emitted as `pcc6311_old_locus_tag` and
`pcc7943_old_locus_tag`. It is a separate file and does not change the contracted
22,356 rows in `identifier-crosswalk-v1.tsv`.

## Coverage

Matched, unmatched, and ambiguous values below count unique protein-bearing loci.
Relationship counts count TSV rows before legacy-tag expansion.

| Strain | Side | Total loci | Matched | Unmatched | Ambiguous | Current relationships | Ambiguous relationships | Legacy relationships |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| PCC 6311 | UTEX 2973 | 2,715 | 2,663 | 52 | 8 | 2,667 | 12 | 2,627 |
| PCC 6311 | Sister | 2,714 | 2,661 | 53 | 6 | — | — | — |
| PCC 7943 | UTEX 2973 | 2,715 | 2,636 | 79 | 8 | 2,642 | 14 | 2,602 |
| PCC 7943 | Sister | 2,715 | 2,635 | 80 | 7 | — | — | — |

Both sister assemblies are Chromosome-level, not Complete Genome. An unmatched
locus may therefore reflect assembly incompleteness rather than genuine biological
absence. This crosswalk does not distinguish those cases and must not turn an
unmatched locus into an absence claim.

## Reproduction

Run from the repository root:

```sh
python3 tools/sister_strain_crosswalk.py --fetch
python3 tools/sister_strain_crosswalk.py
python3 tools/sister_strain_crosswalk.py --check
```

`--fetch` downloads and authenticates the manifest inputs, the default mode rebuilds
the TSV, and `--check` independently rebuilds it in a temporary directory and fails
on byte drift.
