# Recoded E. coli public-parent reference records

- Purpose: Reproduce the public MDS42 and DH10B sequence-derived records and
  Syn61's optional projection into a fixed public-MDS42 codon-PCA frame.
- Scope: Public reference sequence and annotation only. This contract does not
  attach experimental omics, growth, or fitness values to either reference.
- Last verified: 2026-10-08.

## Identity and evidence boundary

NCBI nucleotide-to-assembly links and assembly summaries resolve the two public
records as follows:

| Public chromosome | NCBI assembly | Build sequence id | Taxid | Length |
| --- | --- | --- | ---: | ---: |
| MDS42 `AP012306.1` | `GCF_000350185.1` / `ASM35018v1` | `NC_020518.1` | 1110693 | 3,976,195 bp |
| DH10B `CP000948.1` | `GCF_000019425.1` / `ASM1942v1` | `NC_010473.1` | 316385 | 4,686,137 bp |

The RefSeq assembly reports map each GenBank chromosome to the build sequence
id above and independently name organism, strain, taxid, assembly accession,
and one assembled chromosome. The NCBI records are cited in each organism's
`citations.json` and linked to the NCBI Datasets assembly page.

These are **public references**, not exact Nyerges 2026 stocks. Article section
17 reports a 51 bp `mrcB`-`hemL` insertion in the sequenced MDS42 stock that is
absent from `AP012306.1`. Equality between `CP000948.1` and the supplier DH10B
stock is not established, and the construction methods describe genotype
changes. Therefore neither reference record may receive a study omics, growth,
or fitness value. UI copy, citations, and organism names repeat this boundary.

## Pinned acquisition

The only retained raw inputs are NCBI's MD5 manifests. All sequence and
annotation files are fetched from the configured public NCBI HTTPS directory,
verified against that manifest, and left gitignored:

| Record | Tracked manifest SHA-256 | Assembly report SHA-256 at verification |
| --- | --- | --- |
| MDS42 | `51e30146620d8d878f0a5534d0235ea5a0d1c4e7515a73d31e24dd373e2c3104` | `200b8c935c342cc28c7a42fd6395bb53b89fad2e717ad6b7f70a8e97d10eea12` |
| DH10B | `944c1344aaabc5ed8a38652be5d5f96df3f3bc4bf084b31da67ae5ced9fc7a81` | `e9cde3a5edfad63c8f23e3d9d61ae7f9ed65a7fae8cb827ea67ef9206ad457bc` |

Acquire and verify:

```sh
./tools/fetch_genome.sh --organism ecoli-mds42-public-reference
./tools/fetch_genome.sh --organism ecoli-dh10b-public-reference
```

The fetcher verifies eight compressed artifacts plus the assembly report, then
fails unless the report matches configured organism, strain, taxid, and
assembly. `meta.json.sourceChecksums` records the MD5 of every local build input.

## Frozen build inventories

`scripts/build_features.py` applies the same filtering and metric pipeline as
the other organisms. The exact verified-annotation expectations are in
`config/organisms.json`:

| Record | CDS records | Included | Excluded | Terminal stops `TAG/TAA/TGA` | Included joined CDS |
| --- | ---: | ---: | ---: | --- | --- |
| MDS42 public reference | 3,643 | 3,586 | 57 | 235 / 2,355 / 996 | `ECMDS42_RS12245` (`ribosomal_slippage`) |
| DH10B public reference | 4,468 | 4,227 | 241 | 279 / 2,720 / 1,228 | `ECDH10B_RS15560` / `prfB` (`ribosomal_slippage`) |

DH10B's annotation contains 29 insertion-sequence transposases whose programmed
frameshift CDS joins repeat the slippage base, for example
`join(19811..20259,20259..20508)`. A repeated genomic position cannot be mapped
losslessly into the recodable RNA-context payload or independently edited twice.
The build therefore excludes these records as `overlapping_cds_segments`; it
does not flatten, duplicate, or guess the base. This is an explicit additional
exclusion, not a weakened coordinate invariant. The non-overlapping joined
`prfB` remains included and keeps its exception label.

Build and validate each reference:

```sh
.venv/bin/python scripts/build_features.py --organism ecoli-mds42-public-reference
.venv/bin/python scripts/build_features.py --organism ecoli-dh10b-public-reference
.venv/bin/python tools/build_data_manifest.py build --organism ecoli-mds42-public-reference
.venv/bin/python tools/build_data_manifest.py build --organism ecoli-dh10b-public-reference
.venv/bin/python tools/validate_contract.py --organism ecoli-mds42-public-reference
.venv/bin/python tools/validate_contract.py --organism ecoli-dh10b-public-reference
```

## Syn61 parent-reference projection

Syn61 keeps its own refitted native `codon_pca.json` coordinates in
`genes.json`; that remains the default map. The optional
`codon_pca_reference.json` is child-local and contains the complete public
MDS42 scaler, PCA centering, component matrix, loadings, source digest, Syn61
RSCU digest, exact gene ids, and coordinate matrix. The browser performs no
runtime parent fetch.

The checked relationship input is
`data/recoded/syn61-mds42-public-reference-relationship.json`. Nyerges 2026
identifies Syn61 as a 61-codon variant of MDS42 in the proteomics methods, and
Supplementary Data 1 D2 names the evolved child accession `CP116771.1`.
`recoded-derivative` therefore describes historical lineage. It does **not**
assert that public `AP012306.1` is the exact isogenic parent of the deposited
child or the 2026 experimental stock.

Rebuild the child-local artifact after both native datasets:

```sh
.venv/bin/python tools/project_codon_pca.py \
  --parent-dir site/data/organisms/ecoli-mds42-public-reference \
  --child-dir site/data/organisms/ecoli-syn61-delta3-ev5 \
  --relationship data/recoded/syn61-mds42-public-reference-relationship.json
.venv/bin/python tools/build_data_manifest.py build \
  --organism ecoli-syn61-delta3-ev5
```

The browser loader repeats the fail-closed checks for relationship type,
parent and child identity, RSCU feature order, gene id order, transform shape,
positive scales, loading/component equality, and finite coordinates. The
separate panel explains that removal of the sense codons `TCA` and `TCG`
dominates the expected shift; `TAG` is a stop and is not one of the 59 RSCU
features. Neither separation nor proximity is a fitness, expression, or causal
effect measurement.


`tests/test_codon_pca_projection.py` independently re-multiplies every published
Syn61 coordinate from the public parent's transform and the child's shipped
RSCU vectors, with absolute tolerance 1e-12. A successful manifest check alone
cannot replace this numerical reproduction check.
