# E. coli expression layers: what is admitted, and what may be compared

Seventy-eight layers across three measured levels, admitted 2026-10-07 from the
package P-ECOLI-OMICS review. This records what they are, which comparisons they
support, and which they do not.

| Level | Layers | Study | Strain | Route onto these genes |
| --- | ---: | --- | --- | --- |
| Transcript | 27 | AG3C, Caglar 2017 | REL606 | ortholog crosswalk |
| Protein | 27 | AG3C, Caglar 2017 | REL606 | ortholog crosswalk |
| Transcript | 12 | Zhang 2022, GSE182100 | NCM3722 | exact gene span, no crosswalk |
| Ribosome occupancy | 12 | Zhang 2022, GSE182100 | NCM3722 | exact gene span, no crosswalk |

None is measured in MG1655, the organism on the page. Each layer names its own
strain wherever its value is shown.

## The rule that matters: compare within a bundle, never across

Only two pairings in this set were measured in a way that supports comparing one
layer against another:

- **AG3C transcript against AG3C protein.** Caglar's Methods state that
  *"Samples for each type of cell composition measurement were taken from the
  same batch of flasks"*. The two layers of one condition are aliquots of one
  culture. This is the only same-culture pairing found for E. coli.
- **Zhang transcript against Zhang occupancy.** Same study, same condition set,
  three replicates throughout, though the deposit does not state that a
  transcript and a footprint library of one replicate came from one culture.

Everything else is cross-study and cross-strain. A ratio of Zhang's footprints
over AG3C's transcripts is not a translation efficiency; it is a number computed
across two strains and two studies. Nothing in the interface computes such a
ratio, and nothing should.

One trap is worth naming because it is easy to walk into: an attractive E. coli
proteome in the wider literature is calibrated against the same ribosome
profiling it would be compared with, which makes that comparison circular. It is
not admitted here.

## Why the viewer stays on MG1655

Switching the organism to the best-replicated study's strain was considered and
rejected on 2026-10-07. It inverts the problem: four of the five sources the
review selected already speak this organism's identifiers natively, so moving
would turn one crosswalk into four, and would trade K-12-to-K-12 transfers for
transfers from a B strain, which is the larger biological jump. The crosswalk is
cheaper and smaller in every direction.

## Replication, and what "best" meant here

The review ranked sources for replicate-level measurement under matchable
conditions, not for volume. Its central negative finding, bounded to its recorded
search, is that **no E. coli dataset measures transcript, protein and ribosome
occupancy on the same cultures with meaningful replication**. The field splits
into well-replicated two-layer studies and three-layer collections assembled from
different studies and strains.

Layers are admitted only for condition sets carrying at least three cultures with
both layers, using the authors' own condition identifier plus harvest time. Four
candidate groupings agree on the same 27 AG3C conditions, so the grain does not
rest on the choice.

## Carried, and not carried

- The AG3C values are normalized and log-transformed by the depositors. See
  [log-scaled-layers.md](log-scaled-layers.md) for what that means for a reader
  and why pooling them with linear deposits needs no rescaling.
- 46.1% of the published AG3C protein matrix holds one identical value the paper
  does not define. It is read as a non-detection floor and carried as absent,
  never drawn as an abundance.
- Ribosome occupancy is its own type and its own label. It is not protein
  abundance and never shares a scale with a transcript count.
- The crosswalk and its verification are in
  [rel606-crosswalk.md](rel606-crosswalk.md).

## Sources ranked but not taken

Schmidt 2016 offers the widest condition coverage for absolute protein abundance,
in a third K-12 strain, but publishes one value per condition rather than per
replicate and its condition recipes were not retrieved. PRECISE-1K offers 582
samples in this organism's own strain and namespace, mostly in pairs, with no
protein or translation layer. Both are additive rather than necessary; neither
changes the three levels above.
