/**
 * The recoding scheme control.
 *
 * A scheme is a codon-to-codon map. The user picks target codons; each one gets
 * a replacement prefilled from the genome, editable to any synonymous codon.
 * Nothing that would change a protein can be selected, and the result is checked
 * against every gene's real sequence before it is applied.
 */
import {
  PRESETS, prefillReplacement, recodableCodons, codonOccurrenceCounts,
  destinationsOf, isDistribution, ROTATION_SIZE, rebalanceShares,
} from '../core/scheme.js';
import { formatCount } from './format.js';

/** Amino acid full names, for labelling codon groups in plain language. */
const AA_NAMES = {
  A: 'Alanine', C: 'Cysteine', D: 'Aspartate', E: 'Glutamate', F: 'Phenylalanine',
  G: 'Glycine', H: 'Histidine', I: 'Isoleucine', K: 'Lysine', L: 'Leucine',
  M: 'Methionine', N: 'Asparagine', P: 'Proline', Q: 'Glutamine', R: 'Arginine',
  S: 'Serine', T: 'Threonine', V: 'Valine', W: 'Tryptophan', Y: 'Tyrosine',
  '*': 'Stop',
};

function option(value, label) {
  const element = document.createElement('option');
  element.value = value;
  element.textContent = label;
  return element;
}

/** Selection and disabled state for the saved-scheme controls. */
export function savedSchemeControlState(savedNames, selectedName) {
  const selected = savedNames.includes(selectedName) ? selectedName : '';
  return {
    selected,
    selectDisabled: savedNames.length === 0,
    actionsDisabled: selected === '',
  };
}

export class SchemeEditor {
  /**
   * @param {HTMLElement} host
   * @param {object} dataset
   * @param {{onChange: (map: object) => void, onHighExpressedChange: (value: boolean) => void,
   *   onClear: () => void, onNameChange: (name: string) => void, onSaveScheme: (name: string) => void,
   *   onLoadScheme: (name: string) => void, onDeleteScheme: (name: string) => void}} handlers
   */
  constructor(host, dataset, handlers) {
    this.host = host;
    this.dataset = dataset;
    this.handlers = handlers;
    // Wherever a codon is offered as a target the count quoted is the editable one,
    // which leaves out each gene's start codon. A dataset that does not publish it
    // gets raw counts, labelled as such.
    const occurrences = codonOccurrenceCounts(dataset);
    this.codonOccurrences = occurrences.counts;
    this.countsEditable = occurrences.published;
    this.build();
  }

  build() {
    const { table } = this.dataset;
    this.host.replaceChildren();

    const presetRow = document.createElement('div');
    presetRow.className = 'button-row';
    for (const preset of PRESETS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip-button';
      button.textContent = preset.name;
      button.title = preset.note;
      button.addEventListener('click', () => this.applyPreset(preset));
      presetRow.append(button);
    }
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'chip-button';
    clear.textContent = 'No scheme';
    clear.addEventListener('click', () => {
      if (this.handlers.onClear) this.handlers.onClear();
      else this.handlers.onChange({});
    });
    presetRow.append(clear);
    this.presetNote = document.createElement('p');
    this.presetNote.className = 'muted';
    this.presetNote.hidden = true;
    presetRow.append(this.presetNote);

    const addRow = document.createElement('div');
    addRow.className = 'field-row';
    const addLabel = document.createElement('label');
    addLabel.htmlFor = 'scheme-add-target';
    addLabel.textContent = 'Add target codon';
    this.addSelect = document.createElement('select');
    this.addSelect.id = 'scheme-add-target';
    const byAa = new Map();
    for (const codon of recodableCodons(table)) {
      const aa = table.aas[table.indexOf(codon)];
      if (!byAa.has(aa)) byAa.set(aa, []);
      byAa.get(aa).push(codon);
    }
    this.addSelect.append(option('', 'Choose a codon…'));
    for (const [aa, codons] of [...byAa.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const group = document.createElement('optgroup');
      group.label = `${AA_NAMES[aa] ?? aa} (${aa})`;
      for (const codon of codons) {
        group.append(option(
          codon,
          `${codon} — ${formatCount(this.codonOccurrences.get(codon))} `
            + `${this.countsEditable ? 'editable' : 'in genome'}`,
        ));
      }
      this.addSelect.append(group);
    }
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'chip-button';
    addButton.textContent = 'Add';
    addButton.addEventListener('click', () => this.addTarget());
    this.addSelect.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.addTarget();
      }
    });
    addRow.append(addLabel, this.addSelect, addButton);

    const prefillRow = document.createElement('div');
    prefillRow.className = 'field-row checkbox-row';
    this.highExpressed = document.createElement('input');
    this.highExpressed.type = 'checkbox';
    this.highExpressed.id = 'scheme-high-expressed';
    this.highExpressed.addEventListener('change', () => {
      this.handlers.onHighExpressedChange(this.highExpressed.checked);
    });
    const prefillLabel = document.createElement('label');
    prefillLabel.htmlFor = 'scheme-high-expressed';
    prefillLabel.textContent = 'Prefill replacements from highly expressed genes';
    prefillRow.append(this.highExpressed, prefillLabel);

    this.targetList = document.createElement('ul');
    this.targetList.className = 'target-list';

    this.status = document.createElement('p');
    this.status.className = 'scheme-status';
    this.status.setAttribute('role', 'status');

    const saveRow = document.createElement('div');
    saveRow.className = 'field-row';
    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = 'scheme-name';
    nameLabel.textContent = 'Scheme name';
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.id = 'scheme-name';
    this.nameInput.placeholder = 'e.g. Syn61-style';
    this.nameInput.autocomplete = 'off';
    // A typed name is a draft the moment it exists, not only once Save is
    // clicked: it must survive an unrelated re-render (adding a target
    // codon, say), which it can only do by living in application state
    // rather than solely in this input's own DOM value.
    this.nameInput.addEventListener('input', () => {
      this.handlers.onNameChange(this.nameInput.value);
    });
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'chip-button';
    saveButton.textContent = 'Save';
    saveButton.addEventListener('click', () => {
      const name = this.nameInput.value.trim();
      if (name) this.handlers.onSaveScheme(name);
    });
    saveRow.append(nameLabel, this.nameInput, saveButton);

    const savedRow = document.createElement('div');
    savedRow.className = 'field-row';
    const savedLabel = document.createElement('label');
    savedLabel.htmlFor = 'scheme-saved';
    savedLabel.textContent = 'Saved schemes';
    this.savedSelect = document.createElement('select');
    this.savedSelect.id = 'scheme-saved';
    this.savedSelect.disabled = true;
    this.savedSelect.addEventListener('change', () => this.syncSavedSchemeControls());
    this.loadButton = document.createElement('button');
    this.loadButton.type = 'button';
    this.loadButton.className = 'chip-button';
    this.loadButton.textContent = 'Load';
    this.loadButton.disabled = true;
    this.loadButton.addEventListener('click', () => {
      if (this.savedSelect.value) this.handlers.onLoadScheme(this.savedSelect.value);
    });
    this.deleteButton = document.createElement('button');
    this.deleteButton.type = 'button';
    this.deleteButton.className = 'chip-button danger';
    this.deleteButton.textContent = 'Delete';
    this.deleteButton.disabled = true;
    this.deleteButton.addEventListener('click', () => {
      if (this.savedSelect.value) this.handlers.onDeleteScheme(this.savedSelect.value);
    });
    savedRow.append(savedLabel, this.savedSelect, this.loadButton, this.deleteButton);

    this.host.append(presetRow, addRow, prefillRow, this.targetList, this.status, saveRow, savedRow);
  }

  /** Keep every saved-scheme action aligned with the current selection. */
  syncSavedSchemeControls() {
    const disabled = !this.savedSelect.value;
    this.loadButton.disabled = disabled;
    this.deleteButton.disabled = disabled;
  }

  applyPreset(preset) {
    const map = preset.map ? structuredClone(preset.map) : {};
    for (const codon of preset.map ? [] : preset.targets) {
      const replacement = prefillReplacement(
        codon, this.dataset.meta, this.dataset.table, this.highExpressed.checked, preset.targets,
      );
      if (replacement) map[codon] = replacement;
    }
    this.presetNote.textContent = preset.note;
    this.presetNote.hidden = false;
    this.nameInput.value = preset.name;
    this.handlers.onNameChange(preset.name);
    this.handlers.onChange(map);
  }

  addTarget() {
    const codon = this.addSelect.value;
    if (!codon) return;
    const map = { ...this.currentMap };
    if (map[codon]) return;
    const targets = [...Object.keys(map), codon];
    const replacement = prefillReplacement(
      codon, this.dataset.meta, this.dataset.table, this.highExpressed.checked, targets,
    );
    if (!replacement) {
      this.reportUnrecodable(codon);
      return;
    }
    map[codon] = replacement;
    this.addSelect.value = '';
    this.handlers.onChange(map);
  }

  /** Explain the one case where a codon cannot join the scheme. */
  reportUnrecodable(codon) {
    this.status.classList.add('error');
    this.status.replaceChildren();
    const message = document.createElement('span');
    message.textContent = `${codon} has no synonymous codon left that this scheme keeps. `
      + 'Remove one of the other targets first.';
    this.status.append(message);
  }

  /**
   * @param {{map: object, highExpressed: boolean, name: string, savedNames: string[],
   *   errors: string[], verification: object|null, stopCodonsPresent: boolean}} state
   */
  /**
   * Turn a single replacement into a two-way spread.
   *
   * The second destination is the next synonym the scheme keeps, so the result
   * is valid the moment it is made and the user is never shown an error they
   * did not cause. Shares start even, with the remainder going to the first
   * destination so they sum exactly.
   */
  splitDestinations(codon, destinations, synonyms) {
    const targets = new Set(Object.keys(this.currentMap));
    const first = destinations[0]?.codon;
    const partner = synonyms.find(
      (option_) => option_ !== first && option_ !== codon && !targets.has(option_),
    );
    if (!partner) return first;
    const half = Math.floor(ROTATION_SIZE / 2);
    return [
      { codon: first, share: ROTATION_SIZE - half },
      { codon: partner, share: half },
    ];
  }

  /**
   * The advanced settings a spread target opens: one row per destination.
   *
   * Each row is a codon and its whole-percent share. The running total is shown
   * because the scheme is rejected unless the shares sum to a hundred, so the
   * user can see why before the error appears rather than after.
   */
  shareRows(codon, destinations, synonyms) {
    const wrapper = document.createElement('div');
    wrapper.className = 'target-shares';
    const total = destinations.reduce((sum, d) => sum + (Number(d.share) || 0), 0);
    const targets = new Set(Object.keys(this.currentMap));

    const replace = (next) => {
      this.handlers.onChange({ ...this.currentMap, [codon]: next });
    };

    destinations.forEach((destination, position) => {
      const row = document.createElement('div');
      row.className = 'target-share-row';

      const pick = document.createElement('select');
      pick.className = 'target-share-codon';
      pick.setAttribute('aria-label', `Replacement ${position + 1} for ${codon}`);
      for (const alternative of synonyms) {
        const taken = destinations.some(
          (other, i) => i !== position && other.codon === alternative,
        );
        if (taken || targets.has(alternative)) continue;
        pick.append(option(alternative, alternative));
      }
      pick.value = destination.codon;
      pick.addEventListener('change', () => {
        const next = destinations.map((other, i) => (i === position
          ? { codon: pick.value, share: other.share } : other));
        replace(next);
      });

      const share = document.createElement('input');
      share.type = 'number';
      share.className = 'target-share-value';
      share.min = '1';
      share.max = String(ROTATION_SIZE);
      share.step = '1';
      share.value = String(destination.share);
      share.setAttribute('aria-label', `Share for ${destination.codon} replacing ${codon}`);
      share.addEventListener('change', () => {
        // Rebalanced rather than rejected: a share edit is always a valid
        // scheme, so the user never sees an error for a state they were
        // passing through. The field snaps to what was actually applied.
        replace(rebalanceShares(destinations, position, Number(share.value)));
      });

      const unit = document.createElement('span');
      unit.className = 'target-share-unit';
      unit.textContent = '%';

      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'share-remove';
      drop.textContent = '\u00d7';
      drop.setAttribute('aria-label', `Remove ${destination.codon} from ${codon}'s spread`);
      // Removing the second-to-last destination collapses the spread back to a
      // single replacement rather than leaving a one-entry distribution.
      drop.disabled = destinations.length <= 2 && position > 1;
      drop.addEventListener('click', () => {
        const kept = destinations.filter((_, i) => i !== position);
        if (kept.length === 1) {
          replace(kept[0].codon);
          return;
        }
        const missing = ROTATION_SIZE - kept.reduce((sum, d) => sum + d.share, 0);
        replace(kept.map((d, i) => (i === 0 ? { ...d, share: d.share + missing } : d)));
      });

      row.append(pick, share, unit, drop);
      wrapper.append(row);
    });

    const spare = synonyms.find((alternative) => !destinations.some(
      (d) => d.codon === alternative,
    ) && !targets.has(alternative) && alternative !== codon);
    if (spare) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'chip-button';
      add.textContent = 'Add a replacement';
      add.addEventListener('click', () => {
        // The new destination takes its share from the largest existing one, so
        // the total stays at a hundred without touching the others.
        const largest = destinations.reduce(
          (best, d, i) => (d.share > destinations[best].share ? i : best), 0,
        );
        const give = Math.floor(destinations[largest].share / 2);
        if (give < 1) return;
        const next = destinations.map((d, i) => (i === largest
          ? { ...d, share: d.share - give } : d));
        next.push({ codon: spare, share: give });
        replace(next);
      });
      wrapper.append(add);
    }

    const sum = document.createElement('p');
    sum.className = total === ROTATION_SIZE ? 'target-share-total' : 'target-share-total warn';
    sum.textContent = total === ROTATION_SIZE
      ? `Shares total ${total}%.`
      : `Shares total ${total}%, and must total ${ROTATION_SIZE}%.`;
    wrapper.append(sum);

    const note = document.createElement('p');
    note.className = 'target-share-note';
    note.textContent = `Occurrences of ${codon} take these replacements in turn, `
      + 'counting from the start of each gene, so the same scheme always gives the '
      + 'same sequence. Every replacement keeps the amino acid.';
    wrapper.append(note);

    return wrapper;
  }

  update(state) {
    this.currentMap = state.map;
    this.highExpressed.checked = state.highExpressed;
    if (document.activeElement !== this.nameInput) this.nameInput.value = state.name ?? '';

    const controls = savedSchemeControlState(state.savedNames, this.savedSelect.value);
    this.savedSelect.replaceChildren(option('', state.savedNames.length ? 'Choose…' : 'None saved yet'));
    for (const name of state.savedNames) this.savedSelect.append(option(name, name));
    this.savedSelect.value = controls.selected;
    this.savedSelect.disabled = controls.selectDisabled;
    this.loadButton.disabled = controls.actionsDisabled;
    this.deleteButton.disabled = controls.actionsDisabled;

    const { table } = this.dataset;
    this.targetList.replaceChildren();
    const codons = Object.keys(state.map).sort();
    if (codons.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'target-empty';
      empty.textContent = 'No targets yet. Pick a preset or add a codon above.';
      this.targetList.append(empty);
    }
    for (const codon of codons) {
      const index = table.indexOf(codon);
      const aa = table.aas[index];
      const occurrences = this.codonOccurrences.get(codon) ?? 0;
      const item = document.createElement('li');
      item.className = 'target-item';

      const heading = document.createElement('span');
      heading.className = 'target-codon';
      heading.textContent = codon;
      const meaning = document.createElement('span');
      meaning.className = 'target-aa';
      meaning.textContent = `${AA_NAMES[aa] ?? aa} (${aa})`;

      const synonyms = table.synonymsOf(codon);
      const destinations = destinationsOf(state.map[codon]);
      const spread = isDistribution(state.map[codon]);

      const select = document.createElement('select');
      select.className = 'target-replacement';
      select.setAttribute('aria-label', `Replacement for ${codon}`);
      for (const alternative of synonyms) {
        select.append(option(
          alternative,
          `${alternative} — ${formatCount(this.codonOccurrences.get(alternative))}`,
        ));
      }
      // A spread target's single dropdown would have nothing valid to show, so
      // it is hidden and the share rows below carry the replacements instead.
      select.hidden = spread;
      if (!spread) {
        select.value = destinations[0]?.codon ?? '';
        select.addEventListener('change', () => {
          this.handlers.onChange({ ...this.currentMap, [codon]: select.value });
        });
      }

      const arrow = document.createElement('span');
      arrow.className = 'target-arrow';
      arrow.textContent = spread ? 'is spread over' : 'becomes';

      const count = document.createElement('span');
      count.className = occurrences === 0 ? 'target-count warn' : 'target-count';
      const isStop = table.isStop[index] === 1;
      count.textContent = occurrences === 0
        ? 'not present in this dataset'
        : `${formatCount(occurrences)} ${isStop
          ? 'genes end with it'
          : this.countsEditable ? 'editable occurrences, start codons excluded' : 'occurrences'}`;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove target ${codon}`);
      remove.addEventListener('click', () => {
        const map = { ...this.currentMap };
        delete map[codon];
        this.handlers.onChange(map);
      });

      // The spread toggle. Switching on splits the current single replacement
      // with the next synonym the scheme keeps; switching off keeps the largest
      // share, so neither direction silently invents or discards a destination.
      const spreadLabel = document.createElement('label');
      spreadLabel.className = 'target-spread-toggle';
      const spreadBox = document.createElement('input');
      spreadBox.type = 'checkbox';
      spreadBox.checked = spread;
      spreadBox.disabled = synonyms.length < 2;
      spreadBox.setAttribute('aria-label', `Spread ${codon} over several replacements`);
      spreadLabel.append(spreadBox, document.createTextNode('Spread over several codons'));
      spreadBox.addEventListener('change', () => {
        this.handlers.onChange({
          ...this.currentMap,
          [codon]: spreadBox.checked
            ? this.splitDestinations(codon, destinations, synonyms)
            : destinations.reduce((best, d) => (d.share > best.share ? d : best), destinations[0])
              .codon,
        });
      });

      item.append(heading, meaning, arrow, select, count, remove, spreadLabel);
      if (spread) {
        item.append(this.shareRows(codon, destinations, synonyms));
      }
      this.targetList.append(item);
    }

    this.status.replaceChildren();
    this.status.classList.toggle('error', state.errors.length > 0);
    if (state.errors.length > 0) {
      const heading = document.createElement('strong');
      heading.textContent = 'Scheme rejected: ';
      const text = document.createElement('span');
      text.textContent = state.errors.join(' ');
      this.status.append(heading, text);
    } else if (state.verification) {
      const text = document.createElement('span');
      text.textContent = state.verification.ok
        ? `Protein identity verified across ${formatCount(state.verification.genesChecked)} genes `
          + `and ${formatCount(state.verification.codonsChecked)} codons.`
        : `Protein would change in ${state.verification.firstMismatch.gene}.`;
      this.status.append(text);
    }
    const note = document.createElement('span');
    note.className = 'scheme-note';
    note.textContent = ' Burden counts sense codons plus the terminal stop when a scheme '
      + 'reassigns it. The start codon is never recoded: it reads as methionine whatever the '
      + 'triplet is, so replacing it would change the protein even when the codon table says '
      + 'otherwise.';
    this.status.append(note);
    if (state.genesWithoutTerminalStop > 0) {
      const gap = document.createElement('span');
      gap.className = 'scheme-note warn';
      gap.textContent = ` ${formatCount(state.genesWithoutTerminalStop)} genes in this dataset `
        + 'carry no terminalStop field, so stop reassignment cannot be costed for them.';
      this.status.append(gap);
    }
  }
}
