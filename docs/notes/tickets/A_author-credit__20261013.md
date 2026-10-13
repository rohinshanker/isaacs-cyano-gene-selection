# A_author-credit__20261013 — Active

Scope: Show “By Rohin Shanker” above the initial loading bar and beneath the organism description for every organism.
Status: active
Opened: 2026-10-13
Updated: 2026-10-13

## Current State

Owned by cyano-ui-fixes in work/author-credit-20261013, based on da174b7.
Use shared static markup and existing typography. Keep the initial credit out of
the compact post-reveal progress slot; the header credit remains beneath every
organism description. The owner requests publication to main.

## Verification

Pending rendered loading/reveal checks for all six organisms at phone, tablet,
desktop and wide widths, plus repository completion gates.

## Cleanup

Distill the shared credit/loading visibility rule into progressive-loading.md;
resolve and remove only this ticket after validation. Preserve other sessions.
