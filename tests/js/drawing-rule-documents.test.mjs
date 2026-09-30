/**
 * What the code's own explanations and the validation documents say about the
 * drawing rule, checked against what the code does.
 *
 * Paint order decides which gene is *seen*, so every statement about it is part
 * of the deliverable: a document that describes an order the comparator does not
 * produce sends the next reader to the wrong answer, and the review of
 * `b6e21e9` found four such statements. Prose cannot be exercised, so it is
 * read — the same way `module-constants.test.mjs` reads the published modules.
 *
 * These assertions are short load-bearing phrases and, where a claim was
 * retracted, the *absence* of it. They are deliberately not whole sentences:
 * the point is that the claim is present or gone, not that the wording is
 * frozen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { comparePaintPriority, paintPriority } from '../../site/js/core/paint-priority.js';
import { STATE_VERSION } from '../../site/js/core/url-state.js';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('the STATE_VERSION explanation does not claim an old link drew the same picture', async () => {
  const source = await read('site/js/core/url-state.js');
  const explanation = source.slice(0, source.indexOf('export const STATE_VERSION'));
  assert.equal(STATE_VERSION, 6, 'keeping 6 is the accepted answer; the reason for it is not');
  // What it used to say: that the colour buckets were already issued in
  // ascending order, so a link shared before `dt` existed showed the picture
  // `dt=highest` shows now. It did not: the chromosome view put whichever CDS
  // started last on top, and the no-value and evidence layers moved as well.
  assert.ok(!/showed the same picture/.test(explanation),
    'the explanation must not claim an old link drew the same picture');
  assert.match(explanation, /does \*not\* mean "the picture this link used to draw"/);
  assert.match(explanation, /whichever CDS started last on top/);
  assert.match(explanation, /no code left that draws it/);
  // And the claim it does make is the one the test is actually about.
  assert.match(explanation, /exactly one meaning and no older one to preserve/);
});

test('the shared drawing contract states the rule the comparator implements', async () => {
  const doc = await read('docs/validation/viewer-interaction-state.md');
  // The earlier locus, which is what the comparator now does.
  const valued = { categorical: false, passes: () => true, hasValue: () => true };
  const earlier = paintPriority(1, valued);
  const later = paintPriority(2, valued);
  assert.ok(comparePaintPriority(earlier, later) > 0,
    'the earlier locus sorts last and lands on top');
  assert.match(doc, /Ties break by the \*\*earlier locus\*\*/);
  // One rule, with the batching exception named and bounded.
  assert.match(doc, /paintBatchOrder/);
  assert.match(doc, /One residual difference follows from batching/);
  assert.match(doc, /a value ramp separates every batch by value, so it has no\s+residual at all/);
  // Picking follows the picture, on both views.
  assert.match(doc, /\*\*Picking follows the picture, on both views\.\*\*/);
  assert.match(doc, /the nearest centre decides only where the pointer is on no disc/);
  assert.match(doc, /The open ring for a gene\s+with no value is not a disc/);
  // And the retracted version-number claim is gone from here too.
  assert.ok(!/which is both the fresh view and what every earlier viewer\s+drew/.test(doc),
    'the document must not repeat the compatibility claim either');
  assert.match(doc, /It does not mean "the picture this link used to draw"/);
});

test('the chromosome contract states the per-column majority and the clamped figures', async () => {
  const doc = await read('docs/validation/chromosome-view.md');
  assert.match(doc, /\*\*The majority is a property of the column, not of the CDS\.\*\*/);
  assert.match(doc,
    /resolved on its own, by `topByPaintOrder` with the\s+majority counted \*\*in that column\*\*/);
  // The first-column rule the review found wrong must be gone, not softened.
  assert.ok(!/counted in the column the\s*\n?CDS's first piece snapped onto/.test(doc),
    'the first-column majority must no longer be stated as the rule');
  // Hit testing.
  assert.match(doc, /A click on an occupied column selects the\s+CDS that column shows/);
  assert.match(doc, /only\*\* where the pointer's column drew nothing/);
  assert.match(doc, /166 of 787 shared columns/);
  // The two figures the review found untrue of the picture.
  assert.match(doc, /\*\*The crowding count is clamped to the columns the band draws into\.\*\*/);
  assert.match(doc, /1,883 occupied columns on a 564 px canvas/);
  assert.match(doc, /counted once if \*any\* segment the band drew came out under\s+the threshold/);
  assert.match(doc, /The sentence reads at every count it can take/);
});

test('the evidence contract states that owner decision D1 applies per segment', async () => {
  const doc = await read('docs/validation/source-derived-categories.md');
  assert.match(doc, /applied \*\*per drawn segment\*\*, not per CDS/);
  assert.match(doc, /M744_RS00920/);
  assert.match(doc, /counts once if any segment the view drew is solid/);
  // Which of two different categories is seen, on each view, with the exception.
  assert.match(doc, /decided per column on the chromosome view/);
  assert.match(doc, /by batch on\s+the scatter map/);
});
