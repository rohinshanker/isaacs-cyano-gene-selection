/**
 * The note a view shows in place of evidence whose file has not landed.
 *
 * Loading is not missing. A file still in flight has unknown content, so its
 * place is taken by a sentence that says it is loading, never by the wording
 * the view uses when the evidence is absent, and never by a zero. A file that
 * could not be loaded says that instead, and the Retry control for it is in the
 * loading tail at the top of the map card.
 */
import { firstUnsettled, FILE_STATE } from '../core/data-files.js';

/** The sentence for one pending state. */
export function pendingText(state, what) {
  return state === FILE_STATE.FAILED
    ? `${what.charAt(0).toUpperCase()}${what.slice(1)} could not be loaded.`
    : `Loading ${what}…`;
}

/**
 * A note element for evidence that is loading or failed.
 * @param {'loading'|'failed'} state
 * @param {string} what the evidence, as a lower-case noun phrase.
 */
export function pendingNote(state, what) {
  const note = document.createElement('p');
  note.className = 'panel-note evidence-pending';
  note.dataset.pending = state;
  note.setAttribute('role', 'status');
  note.textContent = pendingText(state, what);
  return note;
}

/**
 * The note for the first of `keys` that is not usable yet, or null when every
 * one has settled, in which case the caller draws its evidence as usual.
 */
export function pendingNoteFor(dataset, keys, what) {
  const waiting = firstUnsettled(dataset, keys);
  return waiting ? pendingNote(waiting.state, what) : null;
}
