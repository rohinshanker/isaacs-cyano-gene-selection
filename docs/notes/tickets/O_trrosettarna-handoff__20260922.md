# O_trrosettarna-handoff__20260922 — Open

- Scope: candidate detail panel and RNA folding panel; export of trRosettaRNA-ready inputs for a selected gene in wild-type or recoded form; external hand-off to the trRosettaRNA web server.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

## Current State

trRosettaRNA has no programmatic API and cannot run in the browser: the
public server is a form-only submission page, and the standalone package
needs a GPU, PyRosetta, and about 32 GB of homolog databases with predictions
taking tens of minutes per RNA. The site therefore does not predict 3D RNA
structure. It already builds exact wild-type and recoded sequence windows in
the browser and folds them with ViennaRNA (`docs/validation/rna-folding.md`).

Add a **Send to trRosettaRNA** hand-off that turns the site's exact sequences
into any input the server or standalone package accepts and hands them to the
user:

- Gene choice: the pinned or selected locus, then **wild type** or **recoded
  under the current scheme**. Both must come from the same exact sequence
  construction the folding worker uses, so what is handed off is what the
  site shows.
- Region choice: the existing `[-30,60)` genomic start window, the full CDS,
  or a user-entered inclusive coordinate range within the gene's `rnaContext`.
  No invented upstream sequence; a range the context cannot supply is refused
  with the reason.
- Transcription orientation with `T` written as `U`, matching the folding
  worker.
- Output every accepted input form, each with a copy-to-clipboard action and
  a file download:
  - plain sequence for pasting into the server form;
  - FASTA (`.fasta`) with a header carrying locus, strain, scheme name or
    `wild-type`, region, and site version;
  - single-sequence A3M/A2M (`.a3m`, `.a2m`) and Stockholm (`.sto`) so a user
    who runs the standalone package or supplies a custom MSA has a valid seed;
  - secondary-structure constraint from the site's ViennaRNA fold as
    dot-bracket (`.dbn`) and connectivity table (`.ct`), which the standalone
    package accepts as custom secondary structure input. Offer these only when
    the fold has completed for that exact sequence; otherwise show why they are
    unavailable.
- A link that opens the trRosettaRNA submission page in a new tab. Before
  building, check whether the form accepts URL query prefill; if it does, use
  it and document the parameters. If not, the clipboard and downloads are the
  hand-off and the link is plain.
- Record the hand-off in the candidate export manifest: locus, form
  (wild type or recoded, scheme name), region, formats produced, sequence
  hash, and ViennaRNA version when a structure file was included.

Boundaries and warnings the panel must state:

- The sequence leaves the site when the user submits it; the site does not
  send anything itself and captures no result. Any returned model is outside
  this repository's provenance unless the lab pins the PDB later.
- trRosettaRNA was trained on RNAs of 30 to 200 nt and leans on homolog
  alignments. Warn when the chosen region is outside that range, and note that
  a recoded region has no natural homologs at the changed codons, so the
  prediction is weakest exactly where wild type and recoded differ.
- Cite the trRosettaRNA server and standalone package and state that the
  server's terms, privacy setting, and the standalone package's Apache-2.0 and
  PyRosetta licences belong to those projects, not to this site.

## Verification

Pending: unit tests that each output format round-trips the exact sequence,
that `T`→`U` and orientation match the folding worker, that the coordinate
range validator refuses out-of-context ranges, and that dot-bracket and `.ct`
agree with the ViennaRNA fold and each other; export manifest fields; rendered
inspection of the hand-off panel for wild type and recoded on a short window
and on a full CDS above 200 nt, at desktop and narrow breakpoints per the
`ui-render-inspect-repair` skill.

## Cleanup

Distill the hand-off formats, warnings, and export fields into
`docs/validation/rna-folding.md` and
`docs/validation/candidate-comparison-and-export.md`, add the external tool
to `docs/validation/source-ledger.md`, update `docs/validation/INDEX.md`, then
delete this ticket and its queue row.
