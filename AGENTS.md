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

## Gates

Run before reporting any change complete:

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
```

UI changes need rendered validation at mobile, tablet, and desktop widths.
