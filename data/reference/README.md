# Reference annotations, not the ground truth

## `utex_2017_annotation.gb`

Supplied by the lab. A GenBank flat file for *Synechococcus* sp. UTEX 2973,
chromosome `NZ_CP006471.1` only, annotated 2017-04-10 by NCBI PGAP 4.1.

It describes the **same assembly** as the genome of record, `GCF_000817325.1`, so it
is not an alternative genome. It is an older annotation of the same sequence, and the
current RefSeq annotation supersedes it on every axis measured: more EC numbers, far
more gene names, GO terms it lacks entirely, both plasmids, and fewer spurious
pseudogenes.

**It is not used by the pipeline.** See the section "The lab's `utex.gb` file, and why
it is not the ground truth" in `docs/validation/genome-provenance.md` for the full
comparison, including the 288 genes whose coordinates differ between the two.

Gitignored because of its size. Nothing in the build depends on it.
