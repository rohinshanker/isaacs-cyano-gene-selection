/**
 * The confirmation every reset goes through.
 *
 * A reset throws away work the user did: a framing they dragged into place, a
 * shortlist they built, a set of metrics they chose. None of it is recoverable
 * from the page once gone, so each one asks first. The confirming button is red
 * and carries the reset's own verb; Cancel is ordinary and is what Escape,
 * a backdrop click, and the initial focus all resolve to, so the safe answer is
 * the easy one.
 */

/** Anything focusable, without naming a DOM class this module would then need. */
function canFocus(node) {
  return Boolean(node) && typeof node.focus === 'function';
}

/** The one dialog element, created on first use and reused after that. */
let host = null;
let active = null;

function build() {
  const backdrop = document.createElement('div');
  backdrop.className = 'confirm-backdrop';
  backdrop.hidden = true;

  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');

  const title = document.createElement('h2');
  title.className = 'confirm-title';
  title.id = 'confirm-dialog-title';
  const body = document.createElement('p');
  body.className = 'confirm-body';
  body.id = 'confirm-dialog-body';
  dialog.setAttribute('aria-labelledby', title.id);
  dialog.setAttribute('aria-describedby', body.id);

  const actions = document.createElement('div');
  actions.className = 'confirm-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'chip-button confirm-cancel';
  cancel.textContent = 'Cancel';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'chip-button confirm-reset';
  // Cancel first in DOM order, so it takes focus and a straight Tab reaches the
  // destructive button second rather than landing on it by default.
  actions.append(cancel, confirm);
  dialog.append(title, body, actions);
  backdrop.append(dialog);
  document.body.append(backdrop);

  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) settle(false);
  });
  cancel.addEventListener('click', () => settle(false));
  confirm.addEventListener('click', () => settle(true));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      settle(false);
      return;
    }
    if (event.key !== 'Tab') return;
    // A two-button trap. Without it, Tab walks out of the dialog into the page
    // behind it, which a modal must not allow.
    const order = [cancel, confirm];
    const index = order.indexOf(document.activeElement);
    event.preventDefault();
    const next = event.shiftKey
      ? order[(index <= 0 ? order.length : index) - 1]
      : order[(index + 1) % order.length];
    next.focus();
  });

  host = { backdrop, dialog, title, body, cancel, confirm };
  return host;
}

function settle(answer) {
  if (!active) return;
  const { resolve, opener } = active;
  active = null;
  host.backdrop.hidden = true;
  // Return focus where it came from, so a keyboard user is not dropped at the
  // top of the document after cancelling. Focusing a detached element is a
  // no-op in a browser, so the check is only that there is something to focus.
  if (canFocus(opener)) opener.focus({ preventScroll: true });
  resolve(answer);
}

/**
 * Ask before a reset. Resolves true only on the red confirming button.
 *
 * @param {object} options
 * @param {string} options.title short question, e.g. "Reset panel widths?"
 * @param {string} options.body what will be lost, in one or two sentences.
 * @param {string} [options.confirmLabel] the red button's text.
 * @param {HTMLElement} [options.opener] element to refocus afterwards.
 * @returns {Promise<boolean>}
 */
export function confirmReset({ title, body, confirmLabel = 'Reset', opener = null } = {}) {
  const ui = host ?? build();
  // A second question while one is open answers the first as Cancel rather
  // than stacking two modals over each other.
  if (active) settle(false);
  ui.title.textContent = title;
  ui.body.textContent = body;
  ui.confirm.textContent = confirmLabel;
  ui.backdrop.hidden = false;
  const opening = opener ?? (canFocus(document.activeElement) ? document.activeElement : null);
  return new Promise((resolve) => {
    active = { resolve, opener: opening };
    ui.cancel.focus();
  });
}

/**
 * Wire a button to run `action` only after confirmation.
 *
 * Every reset control in the page goes through this, so none can be added
 * later that skips the question by forgetting to ask.
 */
export function confirmedReset(button, { title, body, confirmLabel, action }) {
  button.addEventListener('click', async () => {
    const agreed = await confirmReset({ title, body, confirmLabel, opener: button });
    if (agreed) action();
  });
}

/** Test seam: forget the built dialog so a fresh DOM starts clean. */
export function resetConfirmDialogForTests() {
  if (host?.backdrop?.isConnected) host.backdrop.remove();
  host = null;
  active = null;
}
