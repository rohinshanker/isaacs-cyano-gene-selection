# Genome Provenance and Verification Runbook

- Purpose: Reacquire and re-verify the genome of record from scratch.
- Scope: `data/raw/` in this repository.
- Last verified: 2026-10-05

## Genome of record

**`GCF_000817325.1`** (ASM81732v1), *Synechococcus elongatus* UTEX 2973, taxid
1350461, complete genome, submitted 2015-01-09 under BioProject PRJNA209528.

| Sequence | Length | Role |
| --- | --- | --- |
| `NZ_CP006471.1` | 2,690,418 bp | chromosome |
| `NZ_CP006472.1` | 46,366 bp | plasmid |
| `NZ_CP006473.1` | 7,842 bp | plasmid |
| **Total** | **2,744,626 bp** | |

## Wrong-accession trap

`GCF_000817745.x` is ***Aphanocapsa montana* BDHKU210001**, a different organism.
The accession differs from the correct one by three digits and is easy to reach by
guessing. Version `.2` of that record additionally carries only report files, so a
naive download returns 990-byte HTML error pages named as if they were data.

Never take an assembly accession from memory. Resolve it by query:

```sh
curl -sSL -H "Accept: application/json" \
  "https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/taxon/Synechococcus%20elongatus%20UTEX%202973/dataset_report"
```

Confirm `organism_name` and `infraspecific_names.strain` in the response before
downloading anything.

## Acquisition

```sh
B="https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/817/325/GCF_000817325.1_ASM81732v1"
cd data/raw
curl -sSL -O "$B/md5checksums.txt"
for f in genomic.fna.gz genomic.gff.gz protein.faa.gz cds_from_genomic.fna.gz \
         translated_cds.faa.gz rna_from_genomic.fna.gz feature_table.txt.gz genomic.gbff.gz; do
  curl -sSL -O "$B/GCF_000817325.1_ASM81732v1_${f}"
done
curl -sSL -O "$B/GCF_000817325.1_ASM81732v1_assembly_report.txt"
```

## Verification, in order

Each step must pass before the next is meaningful.

1. **Size sanity.** Any file at exactly 990 bytes is an NCBI "Object not found!"
   HTML page. Identical sizes across differently sized files means the download
   failed, not that the data is uniform.
2. **Checksums.** Verify every file against `md5checksums.txt`. The macOS shell
   here may lack `md5` and `awk` on a non-login PATH, so use Python's `hashlib`
   rather than assuming those binaries exist.
3. **Assembly identity.** Confirm organism, strain, and taxid in the assembly
   report against the table above. This is the step that catches a wrong accession
   whose checksums pass perfectly.
4. **Total length.** Sum the FASTA records and require exactly 2,744,626 bp.
5. **Content counts.** Expect 2,715 `protein_coding` genes, 2,723 CDS features,
   2,722 CDS sequences, 7 pseudogenes, 44 tRNA genes, and 6 rRNA genes.
6. **CDS integrity.** Expect exactly one CDS not divisible by three
   (`M744_RS03825`), two CDSs with internal stops, and zero non-`ACGT` characters.
   Start codons distribute as ATG 2248, GTG 356, TTG 103, with 12 non-canonical
   starts. Stop codons distribute as TAG 1074, TAA 897, TGA 750, with one record
   ending in `GTT` because it is a partial CDS.

## The lab's `utex.gb` file, and why it is not the ground truth

A GenBank flat file named `utex.gb` was supplied separately. It was analysed,
**deliberately not adopted**, and then **deleted at the lab's request on 2026-09-18**
since nothing reads it. The file was never committed, so it is not recoverable from
this repository. The comparison below is the surviving record of what it contained.

To obtain an equivalent file again, request the archived 2017 annotation release of
`NZ_CP006471` from NCBI. Nothing in this project needs it.

It is the **same assembly**, `GCF_000817325.1`, stated in its own `DBLINK` line. So
this is not a conflict about which genome to use. It is a difference of annotation
vintage, and the file is a 2017 snapshot.

| | `utex.gb` | Current RefSeq |
| --- | --- | --- |
| Annotation date | 10 Apr 2017 | current release |
| PGAP version | 4.1 | current |
| Sequences | chromosome only | chromosome + 2 plasmids |
| CDS features | 2,629 | 2,722 |
| Pseudogenes | 13 | 7 |
| EC numbers | 420 | **895** |
| Gene names | 16 | **704** |
| GO function / process / component | none | **1,414 / 1,068 / 423** |
| `ribosomal_slippage` qualifier | absent | present |

The current annotation strictly dominates. Of the 420 EC numbers in `utex.gb`, 387
match, 24 conflict, and only **9 are genuinely absent** from the current file. The
conflicts favour the current annotation: several are official EC renumberings, such
as DNA topoisomerase moving from `5.99.1.3` to `5.6.2.2`, and others are cases where
the current record is more complete, such as `4.2.1.3` alone versus `4.2.1.3` plus
`4.2.1.99`. Only 7 gene names are unique to `utex.gb`.

### The part that matters for the lab

**288 of the 2,582 shared genes have different coordinates**, about 11 percent.

| Property | Count |
| --- | --- |
| Differing genes | 288 |
| Whole-codon 5′ shifts | 284 of 288 |
| Current annotation trims the 5′ end | 214 |
| Current annotation extends the 5′ end | 72 |
| Shift over 90 nt | 38 |

These are start-codon reassignments, which is exactly what successive PGAP releases
revise. They are not cosmetic. A changed start codon moves the 5′ folding window,
the first-50-codon ramp counts, CDS length, and, slightly, GC3 and CAI.

**If anyone in the lab has designed primers, constructs, or edits against `utex.gb`
coordinates, those will disagree with this site for those 288 genes.** Check a gene's
boundaries before reusing an old design. Both annotations use the same `M744_RS#####`
locus tags, so a tag matching is not evidence that the gene model matches.

## Notes carried forward

- **TAG is the most common stop codon here**, at 1,074 of 2,722. Amber
  reassignment therefore touches more genes in this organism than in many
  bacteria, which matters when reading target-burden distributions.
- tRNA anticodons come from the `anticodon=` attribute on tRNA features in the
  GFF. The `product=tRNA-Ala` form names only the amino acid and is insufficient
  for tAI.
- `protein.faa.gz` holds 2,711 records against 2,722 CDS sequences, but the gap is
  **not** simply the excluded CDSs. The inclusion rule keeps 2,715 genes and drops
  7 pseudogenes. The remaining difference is duplication: `protein.faa.gz` is keyed
  by `WP_` accession and deduplicated, and four accessions are each shared by two
  CDS records (`WP_011243185.1`, `WP_011242480.1`, `WP_011242807.1`,
  `WP_011242808.1`), which are identical proteins encoded at two loci. Join by
  `protein_id` and never assert equality of record counts.

## E. coli K-12 MG1655 candidate

The second configured genome is RefSeq `GCF_000005845.2` (ASM584v2), organism
*Escherichia coli* str. K-12 substr. MG1655, taxid 511145, one chromosome of
4,641,652 bp. It was re-resolved on 2026-10-05 through NCBI Datasets v2:

```text
GET https://api.ncbi.nlm.nih.gov/datasets/v2/genome/taxon/511145/dataset_report
    ?filters.reference_only=true&filters.assembly_source=refseq
    &filters.has_annotation=true
```

The response had `total_count: 1`; `reports[0]` named accession
`GCF_000005845.2`, assembly `ASM584v2`, organism and strain as above, taxid
511145, total length 4,641,652, and annotation counts of 4,290 protein-coding
genes, 215 non-coding genes, and 145 pseudogenes. The retrieved JSON's SHA-256
was `d3ae26c9d6ac9f8d21e8c0d0b7ad787b79c71e82be306fa4997e8985de6249a1`.
The assembly report independently re-matched organism, strain and taxid; its
SHA-256 was `ca161bcfe8d1842b2160ca3fa20b480956d8242895115c53f5f819a11e895362`.

Acquire and verify every configured file with:

```sh
./tools/fetch_genome.sh --organism ecoli-k12-mg1655
```

This writes gitignored inputs under `data/raw/ecoli-k12-mg1655/`. Only its NCBI
`md5checksums.txt` is tracked (SHA-256
`433d33545422cffdb762278ecc30256c3c45e8bff9f7859f103ba33f57bc6337`);
the annotation files remain build-time reproducibility inputs, not downloads
offered by the product.

### Derived gene-model inventory

The CDS FASTA contains 4,318 records at 4,308 locus tags. Nine loci have
alternative translated products (ten extra records); the longest deposited CDS
is selected per exact `b`-number, and every alternative is retained in
`excluded.json` as `alternate_cds`. The frozen inclusion rule then keeps 4,287
genes and excludes 31 records: 15 ordinary pseudogene records, ten alternative
CDSs, three selenoproteins (`b1474`/`fdnG`, `b3894`/`fdoG`, `b4079`/`fdhF`),
two partial pseudogene CDSs without terminal stops, and one pseudogene CDS whose
length is not divisible by three. The three in-frame `TGA` selenocysteine codons
are recognized from GFF `transl_except=...aa:Sec` and excluded explicitly; they
never become internal stops or recodable stop targets in the unchanged site
contract.

The included start distribution is ATG 3,865; GTG 336; TTG 80; ATT 4; CTG 2.
Terminal stops are TAA 2,744; TGA 1,239; TAG 304. `prfB` (`b2891`) is the one
included joined CDS and carries `ribosomal_slippage`. `dnaX` (`b0470`) and
`copA` (`b0484`) publish the contiguous primary products `NP_415003.1` and
`NP_415017.1` without a slippage flag. Each locus also has a shorter alternate
frameshift product (`YP_009518751.1` and `YP_009518752.1`) recorded in
`excluded.json`; that locus-level fact is not copied onto the selected CDS. All
59 included `ins*` loci remain under the ordinary protein-coding inclusion rule
(25 included products explicitly contain `transposase`).

RefSeq records E. coli anticodons in each tRNA feature's `Note=tRNA-X(ABC)`
field rather than the coordinate-valued `anticodon=` attribute used by the UTEX
annotation. The build derives 86 tRNA genes across 41 amino-acid/anticodon
species, including two Ile-CAT lysidine tRNAs, one tRNA-Sec (`Sec-TCA`), and the
generic A34-to-inosine convention. The Sec locus remains in that honest 86-gene,
41-species inventory but is excluded from the elongator decoding pool; it cannot
contribute a wobble weight to `TGG`. The resulting pool contains 85 genes across
40 effective anticodons. Every sense codon has cognate or wobble-compatible
support under the configured model; no zero-weight sense codon remains.

The E. coli CAI reference set is derived, never hard-coded, by
`ecoli-translation-machinery-product-match-v1`: annotated ribosomal-subunit
proteins excluding modifiers, translation initiation/elongation and peptide-
release factors, chaperonins/cochaperonins, RNA-polymerase subunits, and ATP-
synthase subunits. The elongation wording includes EF-P (`efp`) as well as
EF-Tu, EF-Ts and EF-G. It selects 81 exact `b`-number loci, published in
`meta.json.caiReferenceSet.locusTags`.

The 4,287-row `genes.json` is 8,042,652 bytes, so it fails the frozen
6,291,456-byte budget. All biological, round-trip, protein, context, manifest,
and browser-metric checks pass; publication is held at the size gate as described
in the data contract.
