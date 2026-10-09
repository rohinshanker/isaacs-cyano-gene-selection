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
  await withFakeDocument(async (document) => {
    const host = document.createElement('span');
    document.body.append(host);
    const info = new InfoPopover(host, { id: 'scale-info-test', label: 'About the scale' });
    info.update('Scale: Symmetric log. Current transition ±10.');
    assert.equal(info.popover.hidden, true);
    assert.equal(info.button.getAttribute('aria-expanded'), 'false');

    host.dispatch('pointerenter');
    assert.equal(info.popover.hidden, false);
    host.dispatch('pointerleave');
    await new Promise((resolve) => setTimeout(resolve, 140));
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

test('information popover keeps hover open while the pointer crosses its gap', async () => {
  await withFakeDocument(async (document) => {
    const host = document.createElement('span');
    document.body.append(host);
    const info = new InfoPopover(host, { id: 'scale-info-gap', label: 'About the scale' });
    host.dispatch('pointerenter');
    host.dispatch('pointerleave');
    assert.equal(info.popover.hidden, false, 'the gap gets a short hover bridge');
    info.popover.dispatch('pointerenter');
    await new Promise((resolve) => setTimeout(resolve, 140));
    assert.equal(info.popover.hidden, false, 'reaching the panel cancels the pending close');
    info.popover.dispatch('pointerleave');
    await new Promise((resolve) => setTimeout(resolve, 140));
    assert.equal(info.popover.hidden, true, 'leaving the whole interaction region closes it');
  });
});

test('hover-open information popover dismisses on document Escape without moving focus', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('span');
    const elsewhere = document.createElement('button');
    document.body.append(host, elsewhere);
    elsewhere.focus();
    const info = new InfoPopover(host, { id: 'scale-info-hover-escape', label: 'About the scale' });
    host.dispatch('pointerenter');
    let prevented = false;
    document.dispatch('keydown', {
      key: 'Escape', preventDefault: () => { prevented = true; }, stopPropagation: () => {},
    });
    assert.equal(prevented, true);
    assert.equal(info.popover.hidden, true);
    assert.equal(document.activeElement, elsewhere, 'pointer-only dismissal does not steal focus');
    assert.equal(document.listeners.keydown.length, 0, 'closed popover removes global Escape');
    assert.equal(document.listeners.pointerdown.length, 0, 'closed popover removes outside click');
  });
});

test('open information popover follows resize and scroll and cleans up viewport listeners', async () => {
  await withFakeDocument((document) => {
    globalThis.window.innerWidth = 1280;
    globalThis.window.innerHeight = 800;
    const host = document.createElement('span');
    document.body.append(host);
    const info = new InfoPopover(host, { id: 'scale-info-resize', label: 'About the scale' });
    let buttonTop = 600;
    info.button.getBoundingClientRect = () => ({ left: 1000, right: 1020,
      top: buttonTop, bottom: buttonTop + 20, width: 20, height: 20 });
    info.popover.getBoundingClientRect = () => ({ width: 300, height: 90 });
    info.button.dispatch('click');
    assert.equal(info.popover.style.top, '624px', 'initial placement fits below the trigger');

    globalThis.window.innerHeight = 650;
    globalThis.window.dispatch('resize');
    assert.equal(info.popover.style.top, '506px', 'resize recomputes vertical placement');
    buttonTop = 400;
    globalThis.window.dispatch('scroll');
    assert.equal(info.popover.style.top, '424px', 'scroll follows the moved trigger');

    info.button.dispatch('click');
    assert.equal(globalThis.window.listeners.resize.length, 0);
    assert.equal(globalThis.window.listeners.scroll.length, 0);
  });
});


test('responsive reflow dismisses a pinned popover whose anchor leaves the viewport', async () => {
  await withFakeDocument((document) => {
    globalThis.window.innerWidth = 1280;
    globalThis.window.innerHeight = 800;
    const host = document.createElement('span');
    document.body.append(host);
    const info = new InfoPopover(host, { id: 'scale-width-reflow', label: 'About the scale' });
    let top = 200;
    info.button.getBoundingClientRect = () => ({ left: 300, right: 328, top, bottom: top + 25 });
    info.popover.getBoundingClientRect = () => ({ width: 300, height: 80 });
    info.button.dispatch('click');
    assert.equal(info.popover.hidden, false);
    top = 3000;
    globalThis.window.innerWidth = 375;
    globalThis.window.innerHeight = 812;
    globalThis.window.dispatch('resize');
    assert.equal(info.popover.hidden, true);
    assert.equal(info.button.getAttribute('aria-expanded'), 'false');
    assert.equal(globalThis.window.listeners.resize.length, 0);
  });
});
