# O_shareable-state-and-scheme-drafts__20260918 — Open

- **Scope**: URL/local-storage state restoration and recoding-scheme draft names.
- **Status**: open
- **Opened**: 2026-09-18
- **Updated**: 2026-09-18
- **Priority**: P1 — the address bar can claim one analysis while the page shows another.

## Current State

Verified on viewer commit `fd0e42981ba4347189e27faf25e1e8f3aee42524`.

- Navigating an already-open viewer from a 10-gene radar hash to
  `#p=umap&c=cai&l=M744_RS09000&t=delta` changes the address bar but leaves the
  native map, GC3 colour, 10-gene shortlist, and radar view on screen. The new
  state appears only after reload because the application decodes the hash only
  in `boot()` and has no `hashchange`/`popstate` handler.
- An empty shortlist is omitted from the hash. On initial load that absence means
  “read the previous shortlist from localStorage”, so a shared link cannot
  explicitly reproduce an empty shortlist for a recipient who already has one.
- Clicking a named preset such as Amber only leaves the Scheme name input empty.
  A name typed into that input disappears when a target codon is subsequently
  added, because the draft is not application state and a re-render restores the
  old empty value.
- The chosen “Judge activity by” metric is component-local state. After reload a
  non-default traffic threshold still filters correctly but reappears as a generic
  filter while the traffic control resets to CAI.

## Proposed Resolution

- Centralize decoded-state application and call it from boot plus
  `hashchange`/`popstate`, with a guard so the viewer's own `replaceState` calls do
  not loop.
- Version the serialized state and encode explicit empty values where local
  persistence must not override a shared link.
- Add `trafficKey` and the scheme-name draft to normal state. Presets should set
  their name; target/replacement edits must preserve a draft until Save or an
  explicit clear.
- Define precedence once: explicit URL state, then local persistence only for
  fields the URL truly leaves unspecified, then defaults.

## Verification

- Changing between two complete hashes in the same tab updates every visible
  control without reload and without a stale frame.
- Back/forward navigation, a shared empty shortlist, and a recipient with seeded
  localStorage all reproduce the encoded view.
- Preset names and unsaved draft names survive target and replacement edits.
- The traffic metric and its threshold round-trip together.
- Extend `url-state.test.mjs` and add browser coverage for live hash changes.

## Cleanup

When resolved, document the state-precedence and URL-version contract in
`docs/validation/`, update its index, and remove this ticket and its index row.
