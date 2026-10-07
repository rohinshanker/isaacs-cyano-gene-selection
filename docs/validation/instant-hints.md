# Instant hover hints

`ui/instant-hints.js` owns one delegated hint controller for the site. Existing
HTML `title` and SVG `<title>` writers remain the text source. Conversion must
preserve their exact text, including precision, punctuation, units and newlines,
and remove the native hint to prevent a delayed duplicate. To clear a retained
trigger's hint, write an empty title; detached triggers are cleaned up.

Pointer entry shows the text immediately. Movement follows the pointer with a
small offset and viewport clamping. Clicking dismisses it without preventing the
control's action. Suppression lasts until pointer exit, including intervening
focus changes; a keyboard-only focus visit rearms when focus leaves. Hints do not
intercept input. Scroll (including nested containers), resize, navigation and
hidden/detached triggers clear stale hints.

Existing accessible names remain intact. Additional text uses a referenced
hidden description, retaining any previous `aria-describedby` tokens. An exact
existing accessible label/description is not duplicated. Hidden description
nodes must not appear as standalone content in linear screen-reader navigation.
Keyboard focus and touch-pointer entry expose the same original information.

Run unit contracts and the integrated browser checks:

```sh
node --test tests/js/instant-hints.test.mjs
playwright-cli -s=<unique-session> run-code --filename=tools/ui/check_instant_hints.js
```

Open the actual app with `?uiArtifacts=<absolute ignored directory>` first. The
browser check verifies exact temperature/light/CO₂ and source-detail text,
mouse following, click suppression/re-entry, guide coexistence, underlying info
activation, keyboard access, nested-scroll cleanup, popup closure, native-title
removal and runtime diagnostics at four widths. Inspect its screenshots. Test
long existing text and viewport edges, plus other SVG writers such as length
bins. Chromium touch emulation complements hardware checks; record real iOS
coverage separately when hardware is available.
