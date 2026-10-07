# Isaacs Lab Cyano Gene Selection: agent instructions

These add to the shared working policy; they do not replace it.

## Claude Science

Owner decision, 2026-10-05: Claude Science is the last resort. Read and verify a
source yourself whenever you can reach it by a route that circumvents nothing; a
quotation is verified once it is re-matched mechanically against the retrieved
text and the retrieval is recorded. Send a claim or package to Claude Science,
which only the owner can call, only when no such route exists or the owner asks
for an independent check. Read
[docs/validation/claude-science-handoff.md](docs/validation/claude-science-handoff.md)
before touching any ticket that rests on a scientific claim, a literature sweep, or
a licence question. In short:

- A ticket is never blocked as a whole. Do every claim-independent step now; gate
  only the step that rests on the claim, by claim id.
- Write each dependency as one falsifiable claim in the ticket's "Claude Science
  claims" table, with your own pre-grounding, and add it to the "Pending Claude
  Science" section of `docs/notes/tickets/INDEX.md`.
- For a claim that does go to Claude Science, your own search is pre-grounding; it
  is verified when its results block is pasted into the ticket with resolvable
  sources and an intake check. For a source you read yourself, record the quote,
  its location, the retrieval date and the checksum in the ticket.
- Evidence, whoever gathers it, is never admission, licence permission, a locus
  join, or a lab decision.
- Do not automate the Claude Science application.

## Closing a ticket

Owner decision, 2026-10-07, after a ticket was deleted and pushed while nine
audit findings against its own shipped data were still open.

**A ticket is closed by the session that owns it, and only after it names who is
closing it and what remains.** Closing means renaming the file and its H1 to
`R_...`, recording the final validation, distilling the reusable guidance, and
removing the queue row. Deleting the file is the last step of that, never the
first.

Before closing, state in the ticket itself:

- **Who is closing it**, by session name, and on what date.
- **Every open finding against the work**, by its identifier, with the word
  `open` or the commit that resolved it. A finding nobody has claimed is open,
  whatever the fixing session's own list says.
- **What a later reader would need** that lives only in the ticket. Move it to
  `docs/validation/` or a handoff file first; the ticket is deleted, the
  distillation is not.

**Do not close a ticket you do not own.** If another session's ticket looks
finished, say so to that session and leave it alone.

**Do not close a ticket while an audit of its work is unresolved.** An audit that
confirms the numbers can still find label, provenance and link defects, and those
are reasons the work is not finished. Shipping correct values under a wrong label
is a defect in the ticket's own scope.

**A closure that loses an open finding is reverted, not argued about.** When a
merge offers a deletion on one side and open findings on the other, keep the
ticket. Resurrecting it costs a commit; losing the findings costs the audit.

## Gates

Run before reporting any change complete:

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
```

UI changes need rendered validation at mobile, tablet, and desktop widths.
