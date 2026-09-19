# Annotation source provenance

This directory holds only source artifacts that feed a checked release gate or a
versioned derived annotation feature. The machine-readable authority is
`data/manifest/annotation-release-v1.json`; it pins each direct URL, byte size,
MD5, assembly/annotation release, annotation date, PGAP version, retrieval date,
retention reason, and redistribution note.

## Retained NCBI artifacts

| Input | Why retained |
| --- | --- |
| UTEX `annotation_hashes.txt` | Detects an annotation-content release change independently of filenames. |
| UTEX `assembly_stats.txt` | Gates organism/assembly length and replicon count. |
| UTEX `feature_count.txt` | Gates 2,715 protein-coding genes, seven pseudogenes, and the 2,711-protein/2,715-placement distinction. |
| UTEX `gene_ontology.gaf.gz` | Reproduces evidence-coded GO relationships without converting them to heuristic categories. |
| UTEX `protein.gpff.gz` | Reproduces structured NCBI protein-name evidence such as HMM source and accession. |
| PCC 7942 `genomic.gff.gz` | Reproduces exact shared-RefSeq-protein cross-strain mappings, including ambiguous relationships. |

The larger core genome files remain gitignored under `data/raw/` and are fetched
for a build. The smaller companion inputs above are tracked because they are the
release-gate evidence or direct inputs to tracked derived artifacts.

All retained bytes came from the direct NCBI FTP URLs in the manifest. NCBI does
not attach a dataset-specific licence to this assembly directory; users must
follow the [NCBI data usage policies](https://www.ncbi.nlm.nih.gov/home/about/policies/).
The manifest's redistribution field records this conservatively rather than
claiming a licence that the files do not state.

Generated artifacts live under
`releases/GCF_000817325.1-RS_2026_05_13/` and are reproducible with:

```sh
python3 tools/annotation_release.py verify
python3 tools/annotation_release.py build
python3 tools/annotation_release.py check
```

Do not edit generated TSV, JSONL, or summary files by hand.
