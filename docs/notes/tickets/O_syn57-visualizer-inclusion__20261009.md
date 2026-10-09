# O_syn57-visualizer-inclusion__20261009 — Open (approved by Rohin)

- **Scope:** Add the owner's requested Syn57 from the Nyerges radical-recoding paper and group recoded E. coli choices.
- **Status:** open
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Opened by `cyano-ui-fixes` at the owner's request. Implementation is unassigned
and has not started. When Syn57 is added, replace the **E. coli Syn61** button
with **Recoded E. Coli**. Its dropdown contains **Syn57** and **Syn61**, in that
order. The top-level sequence is then **Cyanobacteria → Recoded E. Coli →
E. coli**. The owner has not specified a fresh default for the recoded group;
settle that before introducing a default that chooses between the two.

Apply the collapsible/movable recoding-scheme panel requirement from
[strain navigation](O_strain-navigation-format__20261009.md) to both choices.

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
