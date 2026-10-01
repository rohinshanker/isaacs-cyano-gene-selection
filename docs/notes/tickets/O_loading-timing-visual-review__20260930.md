# O_loading-timing-visual-review__20260930 — Open

- **Scope:** The owner judges, by eye, the times chosen for the loading
  presentation, and the chosen values are written into
  `site/js/ui/load-timing.js`. Covers that file, its test, and the timing table
  in `docs/validation/progressive-loading.md`. No change to what loads, in what
  order, or what any view shows.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-09-30

## Current State

Opened at the owner's request when the loading presentation was built: "these
times can be tuned later, and once this is implemented there should be a ticket
for a visual test I can do to see if I like the times picked." The presentation
is shipped with first-guess defaults. Nothing has been tuned.

**This is a test only the owner can run.** It asks whether the animation feels
right, and no agent can answer that. An agent's part is to apply the values the
owner settles on.

## The visual test

Serve the site and open it with overrides in the address bar. No file needs
editing to try a value, and an override is never written into the link's hash.

```sh
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000/?<overrides>`. A reload replays the whole sequence.
On a fast connection the data arrives almost at once, so the bar's own behaviour
is easiest to judge with the network throttled in the browser's developer tools
("Fast 4G" or "Slow 4G") and the cache disabled.

| What to judge | Parameter | Default | Try |
| --- | --- | ---: | --- |
| How long the chromosome bar stays at minimum | `load-min` | 1000 ms | 600, 1500, 2000 |
| How fast text types in | `load-letters` | 110 letters/s | 70, 160 |
| The longest any one text takes | `load-text-max` | 1600 ms | 1000, 2500 |
| How far behind the letters resolve | `load-lag` | 8 letters | 4, 12 |
| Flip speed just after a letter is typed | `load-flip-fast` | 40 ms | 25, 70 |
| Flip speed just before it resolves | `load-flip-slow` | 170 ms | 110, 260 |
| How fast the map's points appear | `load-map-appear` | 700 ms | 400, 1200 |
| How long the map takes to colour | `load-map-colour` | 2000 ms | 1200, 3000 |
| Whether the page lands on the map or at its top | `load-anchor` | 1 (on the map) | 0 |

Several can be combined, for example
`?load-min=1500&load-letters=90&load-map-colour=3000`.

Questions to answer while watching:

1. Is one second of the chromosome bar too long when the data is already there,
   or too short to register?
2. Can the flipping letters be seen, and does the slowing-down before a letter
   resolves read as intended, or is it lost at this speed?
3. Does a long paragraph finish soon enough, and a short label slowly enough?
4. Do the text and the map feel like one reveal, or does one end awkwardly before
   the other?
5. Does the map's colour arrive at a pace that can be followed?
6. On a throttled connection, where the points appear in the neutral colour and
   take their categories several seconds later: does that second wave read as the
   same animation?
7. **Where should a visit land?** The map sits lower in the page than the loading
   grid, so to keep the fill-in in view the page is scrolled at the reveal and
   the visit lands on the map, with the header and tabs above it. With
   `?load-anchor=0` the page stays at its top and the map is wherever the layout
   puts it: mostly below the fold on a laptop and off screen on a phone. This is
   a change to where every visit starts, made so the animation you asked for can
   be seen, and it is yours to keep or reverse.
8. Dropdown options and input placeholders are not scrambled: they show their
   finished text among the flipping letters. Is that seam acceptable, or should
   form controls be held back until the text has settled?

## What an agent does with the answers

Write the chosen values into `LOAD_TIMING` in `site/js/ui/load-timing.js`, update
the assertions in `tests/js/load-timing.test.mjs` that state the owner's times,
update the timing table in `docs/validation/progressive-loading.md`, run the
three gates, and render the sequence once with no overrides to confirm it matches
what the owner approved.

If the owner wants something the tunables cannot express, such as a different
order for the points or a different letter set, that is a change to the
animation and gets its own ticket.

## Claude Science claims

None. Durations of a visual effect.

## Acceptance criteria

- The owner has watched the sequence with at least one alternative for each row
  they care about and has stated the values to keep.
- `LOAD_TIMING`, its test, and the timing table agree on those values.
- The three gates pass, and one rendered pass with no overrides confirms them.

## Verification

Not started. The overrides themselves are verified: every parameter in the table
is covered by `tests/js/load-timing.test.mjs`, and the sequence was rendered at
375, 768, 1280 and 1440 px with the defaults on 2026-09-30.

## Cleanup

On resolution, the chosen values are already recorded where they are used and in
the loading contract. Delete this ticket and its index row.
