import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFakeDocument, FakeElement } from './fake-dom.mjs';
import {
  confirmReset, confirmedReset, resetConfirmDialogForTests,
} from '../../site/js/ui/confirm-dialog.js';

/** Run `body` with a clean dialog module and a fake document. */
function withDialog(body) {
  return withFakeDocument(async (document) => {
    resetConfirmDialogForTests();
    try {
      return await body(document);
    } finally {
      resetConfirmDialogForTests();
    }
  });
}

const parts = (document) => ({
  backdrop: document.querySelector('.confirm-backdrop'),
  dialog: document.querySelector('.confirm-dialog'),
  cancel: document.querySelector('.confirm-cancel'),
  confirm: document.querySelector('.confirm-reset'),
});

test('the question names the reset and carries its own confirming verb', async () => {
  await withDialog(async (document) => {
    const answer = confirmReset({
      title: 'Reset selections?',
      body: 'This clears the pinned gene and the shortlist.',
      confirmLabel: 'Reset selections',
    });
    const { backdrop, dialog, cancel, confirm } = parts(document);
    assert.equal(backdrop.hidden, false);
    assert.equal(dialog.getAttribute('role'), 'alertdialog');
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.equal(dialog.getAttribute('aria-labelledby'), 'confirm-dialog-title');
    assert.equal(dialog.getAttribute('aria-describedby'), 'confirm-dialog-body');
    assert.equal(document.querySelector('.confirm-title').textContent, 'Reset selections?');
    assert.equal(confirm.textContent, 'Reset selections');
    assert.equal(cancel.textContent, 'Cancel');
    cancel.dispatch('click');
    assert.equal(await answer, false);
  });
});

test('Cancel takes focus, so the safe answer is the one already selected', async () => {
  await withDialog(async (document) => {
    const answer = confirmReset({ title: 'Reset?', body: 'Gone.' });
    const { cancel, confirm } = parts(document);
    assert.equal(document.activeElement, cancel);
    // Cancel also comes first in the DOM, so a straight Tab reaches the
    // destructive button second rather than landing on it.
    const order = document.querySelector('.confirm-actions').children;
    assert.equal(order[0], cancel);
    assert.equal(order[1], confirm);
    cancel.dispatch('click');
    await answer;
  });
});

test('only the red button resolves true', async () => {
  await withDialog(async (document) => {
    const answer = confirmReset({ title: 'Reset?', body: 'Gone.' });
    parts(document).confirm.dispatch('click');
    assert.equal(await answer, true);
    assert.equal(parts(document).backdrop.hidden, true);
  });
});

test('Escape and a backdrop click both cancel', async () => {
  await withDialog(async (document) => {
    const escaped = confirmReset({ title: 'Reset?', body: 'Gone.' });
    const { dialog, backdrop } = parts(document);
    dialog.dispatch('keydown', { key: 'Escape', preventDefault() {} });
    assert.equal(await escaped, false);

    const clickedAway = confirmReset({ title: 'Reset?', body: 'Gone.' });
    backdrop.dispatch('pointerdown', { target: backdrop });
    assert.equal(await clickedAway, false);
  });
});

test('a click inside the dialog is not a click on the backdrop', async () => {
  await withDialog(async (document) => {
    const answer = confirmReset({ title: 'Reset?', body: 'Gone.' });
    const { backdrop, dialog, cancel } = parts(document);
    backdrop.dispatch('pointerdown', { target: dialog });
    assert.equal(backdrop.hidden, false, 'the dialog stays open');
    cancel.dispatch('click');
    assert.equal(await answer, false);
  });
});

test('Tab cycles between the two buttons instead of escaping the dialog', async () => {
  await withDialog(async (document) => {
    const answer = confirmReset({ title: 'Reset?', body: 'Gone.' });
    const { dialog, cancel, confirm } = parts(document);
    const tab = (shiftKey) => dialog.dispatch('keydown', {
      key: 'Tab', shiftKey, preventDefault() {},
    });
    assert.equal(document.activeElement, cancel);
    tab(false);
    assert.equal(document.activeElement, confirm);
    tab(false);
    assert.equal(document.activeElement, cancel, 'forward from the last wraps to the first');
    tab(true);
    assert.equal(document.activeElement, confirm, 'back from the first wraps to the last');
    cancel.dispatch('click');
    await answer;
  });
});

test('focus returns to the control that asked', async () => {
  await withDialog(async (document) => {
    const opener = new FakeElement('button');
    const answer = confirmReset({ title: 'Reset?', body: 'Gone.', opener });
    parts(document).cancel.dispatch('click');
    await answer;
    assert.equal(document.activeElement, opener);
  });
});

test('a second question answers the first as Cancel rather than stacking', async () => {
  await withDialog(async (document) => {
    const first = confirmReset({ title: 'First?', body: 'Gone.' });
    const second = confirmReset({ title: 'Second?', body: 'Gone.' });
    assert.equal(await first, false);
    assert.equal(document.querySelector('.confirm-title').textContent, 'Second?');
    parts(document).confirm.dispatch('click');
    assert.equal(await second, true);
  });
});

test('a wired reset runs its action only after the red button', async () => {
  await withDialog(async (document) => {
    let runs = 0;
    const button = new FakeElement('button');
    confirmedReset(button, {
      title: 'Reset?', body: 'Gone.', confirmLabel: 'Reset', action: () => { runs += 1; },
    });

    button.dispatch('click');
    await Promise.resolve();
    parts(document).cancel.dispatch('click');
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    assert.equal(runs, 0, 'cancelling runs nothing');

    button.dispatch('click');
    await Promise.resolve();
    parts(document).confirm.dispatch('click');
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    assert.equal(runs, 1);
  });
});
