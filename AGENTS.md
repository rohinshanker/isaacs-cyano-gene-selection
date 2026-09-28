# Isaacs Lab Cyano Gene Selection: agent instructions

These add to the shared working policy; they do not replace it.

## Claude Science

Scientific claims are verified through the lab owner's Claude Science account,
which no agent can call. Read
[docs/validation/claude-science-handoff.md](docs/validation/claude-science-handoff.md)
before touching any ticket that rests on a scientific claim, a literature sweep, or
a licence question. In short:

- A ticket is never blocked as a whole. Do every claim-independent step now; gate
  only the step that rests on the claim, by claim id.
- Write each dependency as one falsifiable claim in the ticket's "Claude Science
  claims" table, with your own pre-grounding, and add it to the "Pending Claude
  Science" section of `docs/notes/tickets/INDEX.md`.
- Your own search is pre-grounding, not verification. A claim is verified only when
  its results block is pasted into the ticket with resolvable sources and an intake
  check.
- Claude Science output is evidence, never admission, licence permission, a locus
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
