# A_syn57-visualizer-inclusion__20261009 — Active

- **Scope:** Add the owner's requested Syn57 from the Nyerges radical-recoding paper and group recoded E. coli choices.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-10

## Current State

Opened by `cyano-ui-fixes` at the owner's request. Claimed 2026-10-10 by
`cyano-ticket-closing` (Agent Deck `4fb20911-1791401042`). Implementation and
review use isolated worktrees; Multica implementation is `DEM-352`
(`01a126af-f1da-71dd-9408-4dce83280c64`) on branch
`work/syn57-visualizer-20261010`, baseline `6e24d70`; fitness-selection and agreement-export scopes
remain with their existing owners. No new default is introduced: opening the
recoded disclosure presents both explicit links, retaining Syn61 saved links. When Syn57 is added, replace the **E. coli Syn61** button
with **Recoded E. Coli**. Its dropdown contains **Syn57** and **Syn61**, in that
order. The top-level sequence is then **Cyanobacteria → Recoded E. Coli →
E. coli**. The owner has not specified a fresh default for the recoded group;
settle that before introducing a default that chooses between the two.

Apply the collapsible/movable recoding-scheme panel requirement from
[the controls-panel contract](../../validation/controls-column-and-resets.md#the-controls-column-is-view-state) to both choices.

## Source and identity boundary

The existing [recoded E. coli ticket](A_recoded-ecoli-multiomics__20261007.md)
and [evidence dossier](../handoff/recoded_ecoli_evidence__20261007.md) already
cover Nyerges et al.,
["Probing the limits of genetic recoding using multi-omics-guided evolution"](https://www.nature.com/articles/s41467-026-74300-9),
DOI `10.1038/s41467-026-74300-9`. Reuse their source intake and owner decisions.
Do not duplicate that session's partial-isolate genome or assay-clone crosswalk
work.

The pinned `Ec_Syn57.gb` is the complete **design**, not the genome of a measured
partially recoded isolate. Its recorded SHA-256 is
`8c61aeebfb8fef71a9d01ceba2a2acdb8babdf96ac0aa01aae36b10d08f77f96`.
The existing aggregate Ec_Syn57 simulation preset does not itself add a selectable
organism. At implementation intake, confirm that the new viewer record is this
Nyerges design and label its design status explicitly; distinguish any other
paper's Syn57 organism and any study isolate by its exact source and genome.

## Direct source check, 2026-10-10

`cyano-ticket-closing` independently parsed the pinned GenBank: file SHA-256
matches; sequence-only SHA-256 is
`5ad86e64fa142b009c159dddd4c1eccf5cce6e8bafa8c374cbfb6e9bc8e07033`.
Record `Ec_Syn57` is circular, 3,973,902 bp, with 3,640 CDS and 85 tRNA
features. Four locus tags repeat at distinct coordinates (`b4419`, `b1716`,
`b1717`, `b1718`), and two CDS lack a locus tag. The builder must retain source
identity and deterministically disambiguate local design features, with explicit
exclusions and no inferred cross-organism join. The ordinary CDS contract must
handle one fuzzy and one compound location. Residual codons are computed from
the included design CDS, not inferred from the intended scheme.

Re-fetched [Europe PMC fullTextXML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13287592/fullTextXML),
318,246 bytes, SHA-256
`0f819b794c2bd9e83669157439552b16555d75d97153676e2c348b2eb9381a69`.
Mechanically matched "complete E. coli genome" and "a strain with a distinct
recoding scheme" in Introduction, and "Creative Commons
Attribution-NonCommercial-NoDerivatives 4.0 International License" in permissions.
These reaffirm the design identity and article terms. The standing source-ledger
owner decision of 2026-10-06 covers attributed derived data; no measurement is
admitted onto this design. Move these reusable source checks into validation
before closure.

## Implementation and acceptance

- Admit a separately identified, reproducibly built genome/annotation payload
  from the pinned source under the existing admission and genome-of-record
  contracts. Recheck source identity, checksum, annotation counts, and the source
  terms before publishing derived content.
- Give Syn57 its own organism ID, data directory, storage namespace, native
  coordinate basis, source labels, and export identity. Keep existing Syn61
  links and saved analyses usable.
- Present chromosome and gene views, search, and supported recoding controls
  for the admitted record. Use its own recoding scheme; never substitute the
  Syn61 preset. Persist panel order/collapse state through the standard controls.
- Any assay layer must name the exact measured strain and an admitted matching
  genome. Do not attach partial-isolate measurements to the complete design or
  imply that design-only calculations are measurements.
- Make missing/unsupported layers and loading failures clear. Show provenance
  and design/strain identity wherever a reader interprets or exports results.
- Ship the Recoded E. Coli dropdown only when Syn57 has an admitted, working
  record. Preserve the conventional MG1655/MDS42/DH10B dropdown.

## Open implementation findings

| Id | Status | Required resolution |
| --- | --- | --- |
| S57-C1 | open | Rebuild `--check` must build outside the shipped directory and leave it byte-identical after both success and failure; test rejected/interrupted builds and file inventory changes. |
| S57-C2 | open | Do not present anticodons inferred from codon-recognition notes or gene names as a complete genomic anticodon pool. Use a supported, explicitly qualified convention or mark tAI and dependent metrics unavailable; no borrowed organism pool. |
| S57-C3 | open | Reconcile every plotted CDS with the overlap annotation universe without losing source feature identity or silently dropping unmatched source rows. |

The coordinator's independent first-payload check matched all 3,588 plotted CDSs
to unique source feature coordinates and exact decoded CDS sequences, with zero
mismatches. The 52 exclusions reconcile the 3,640 source CDS records. Included
terminal stops are TGA 1,126, TAA 2,454 and TAG 8. Repeat this check on the final
reviewed payload; these results do not approve the remaining draft or its tAI.

## Verification

Ticket-only intake; no organism or data has been added. The source boundary above
references the existing pinned evidence, not a new scientific intake. Intake
validation, 2026-10-09: ticket metadata and queue links passed; `npm test` passed
1,395 tests; `pytest -q` passed 925 tests and 36 subtests with one skip; the
contract validator passed 119 checks with one declared skip. These gates validate
the current baseline, not the unimplemented Syn57 integration.

For implementation, validate deterministic builds and source/coordinate
contracts; test selector routing, storage/export isolation, scheme identity,
missing layers, and error states. Render both recoded choices at mobile, tablet,
and desktop widths, including gene/chromosome views, dropdown keyboard behavior,
and recoding-panel movement/collapse. Run the gates in `AGENTS.md`.

## Cleanup

The implementing session owns closure and must name every remaining audit
finding. Distill reusable source/design identity and recoded selector contracts
into the existing recoded-genome and organism-selector validation documents,
update their index, then remove this ticket and its queue row through the required
resolved-ticket lifecycle.
