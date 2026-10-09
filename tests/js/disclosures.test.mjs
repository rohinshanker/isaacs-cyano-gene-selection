import assert from 'node:assert/strict';
import test from 'node:test';

import { InfoPopover, tanDisclosure } from '../../site/js/ui/disclosures.js';
import { withFakeDocument } from './fake-dom.mjs';

test('tan information uses a closed native disclosure without changing its content', async () => {
  await withFakeDocument((document) => {
    const content = document.createElement('p');
    content.className = 'provenance-warning';
    content.textContent = 'Source, caveat, and link remain here.';
    const details = tanDisclosure(content, 'Provenance / information');
    assert.equal(details.tagName, 'details');
    assert.equal(details.open, undefined);
    assert.equal(details.querySelector('summary').textContent, 'Provenance / information');
    assert.equal(details.querySelector('p.provenance-warning'), content);
  });
});

test('information popover opens by hover and focus, pins by click, and dismisses by Escape', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('span');
    document.body.append(host);
    const info = new InfoPopover(host, { id: 'scale-info-test', label: 'About the scale' });
    info.update('Scale: Symmetric log. Current transition ±10.');
    assert.equal(info.popover.hidden, true);
    assert.equal(info.button.getAttribute('aria-expanded'), 'false');

    host.dispatch('pointerenter');
    assert.equal(info.popover.hidden, false);
    host.dispatch('pointerleave');
    assert.equal(info.popover.hidden, true);

    host.dispatch('focusin');
    assert.equal(info.popover.hidden, false);
    info.button.dispatch('click');
    assert.equal(info.popover.hidden, false, 'click pins a transiently open popover');
    info.button.dispatch('click');
    assert.equal(info.popover.hidden, true, 'a second click dismisses the pinned popover');
    host.dispatch('pointerleave');
    assert.equal(info.popover.hidden, true,
      'leaving the pointer does not undo dismissal while the trigger still has focus');
    info.button.dispatch('click');
    assert.equal(info.popover.hidden, false, 'the next click pins it open again');
    let prevented = false;
    info.button.dispatch('keydown', {
      key: 'Escape', preventDefault: () => { prevented = true; }, stopPropagation: () => {},
    });
    assert.equal(prevented, true);
    assert.equal(info.popover.hidden, true);
    assert.equal(info.button.getAttribute('aria-expanded'), 'false');
    assert.match(info.popover.textContent, /Current transition/);
  });
});

test('information popover closes when keyboard focus leaves its host', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('span');
    const elsewhere = document.createElement('button');
    document.body.append(host, elsewhere);
    const info = new InfoPopover(host, { id: 'scale-info-focus', label: 'About the scale' });
    host.dispatch('focusin');
    info.button.dispatch('click');
    assert.equal(info.popover.hidden, false);
    host.dispatch('focusout', { relatedTarget: elsewhere });
    assert.equal(info.popover.hidden, true);
    assert.equal(info.button.getAttribute('aria-expanded'), 'false');
  });
});
