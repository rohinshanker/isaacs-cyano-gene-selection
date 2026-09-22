import {
  TRROSETTA_URL, copyTextWithFallback, handoffHeader, handoffSequence, sha256, writeHandoffFormats,
} from '../core/rosetta-handoff.js';
import { FOLD_SETTINGS } from '../core/folding-sequences.js';

const EXTENSIONS = {
  sequence: 'txt', fasta: 'fasta', a3m: 'a3m', a2m: 'a2m', stockholm: 'sto',
  dotBracket: 'dbn', ct: 'ct',
};

function option(value, label) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

function slug(value) {
  return String(value).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Return a fold only when its captured input is byte-identical to the hand-off. */
export function matchingFoldStructure(result, sequence, form, region) {
  if (!result || !['start', 'cds'].includes(region)) return null;
  const window = region === 'start' ? result.windows?.start : result.windows?.first100;
  const which = form === 'recoded' ? 'recoded' : 'wild';
  if (window?.[`${which}Sequence`] !== sequence) return null;
  const structure = window[`${which}Structure`];
  const mfe = window[`${which}Mfe`];
  return typeof structure === 'string' && Number.isFinite(mfe) ? { structure, mfe } : null;
}

export class RosettaHandoffPanel {
  constructor(host, { onRecord = () => {} } = {}) {
    this.host = host;
    this.onRecord = onRecord;
    this.foldResults = [];
    host.className = 'rosetta-handoff';
    host.innerHTML = `<h3>Send to trRosettaRNA</h3>
      <p class="panel-note">Prepare an exact strand-oriented RNA input. This site never submits it.</p>
      <div class="rosetta-controls">
        <label>Locus <select data-rosetta-locus></select></label>
        <label>Sequence <select data-rosetta-form><option value="wild-type">Wild type</option><option value="recoded">Recoded under current scheme</option></select></label>
        <label>Region <select data-rosetta-region><option value="start">Start window (−30 through 59)</option><option value="cds">Full CDS</option><option value="range">Context coordinate range</option></select></label>
      </div>
      <div class="field-row" data-rosetta-range hidden>
        <label>Inclusive start <input type="number" min="-30" max="59" value="-30" data-rosetta-start></label>
        <label>Inclusive end <input type="number" min="-30" max="59" value="59" data-rosetta-end></label>
      </div>
      <div class="button-row"><button type="button" class="chip-button" data-rosetta-build>Prepare files</button>
        <a class="chip-button rosetta-link" href="${TRROSETTA_URL}" target="_blank" rel="noopener noreferrer">Open trRosettaRNA ↗</a></div>
      <p class="panel-note" role="status" aria-live="polite" data-rosetta-status></p>
      <div data-rosetta-warning></div><div data-rosetta-outputs></div>
      <details><summary>Scope, privacy, and licences</summary>
        <p class="panel-note">The sequence leaves this site only when you paste, upload, and submit it to trRosettaRNA. This site sends nothing and captures no result. A returned model is outside this repository’s provenance unless the lab later pins the PDB.</p>
        <p class="panel-note">trRosettaRNA was trained on RNAs of 30–200 nt and relies on homolog alignments. Recoded regions have no natural homologs at changed codons, so predictions are weakest where wild type and recoded differ.</p>
        <p class="panel-note">The trRosettaRNA server and standalone package are external projects. Their server terms and privacy settings apply. The standalone code is Apache-2.0 and its PyRosetta dependency has separate licence terms.</p>
        <p class="panel-note">The public form did not accept documented URL query prefill when checked 2026-09-22, so this link opens the plain form.</p>
      </details>`;
    this.locus = host.querySelector('[data-rosetta-locus]');
    this.form = host.querySelector('[data-rosetta-form]');
    this.region = host.querySelector('[data-rosetta-region]');
    this.range = host.querySelector('[data-rosetta-range]');
    this.start = host.querySelector('[data-rosetta-start]');
    this.end = host.querySelector('[data-rosetta-end]');
    this.status = host.querySelector('[data-rosetta-status]');
    this.warning = host.querySelector('[data-rosetta-warning]');
    this.outputs = host.querySelector('[data-rosetta-outputs]');
    this.region.addEventListener('change', () => { this.range.hidden = this.region.value !== 'range'; });
    for (const control of [this.locus, this.form]) {
      control.addEventListener('change', () => this.clearFoldResults('Gene or sequence form changed. Fold again before preparing structure files.'));
    }
    for (const control of [this.region, this.start, this.end]) {
      control.addEventListener('change', () => this.clearPrepared());
    }
    host.querySelector('[data-rosetta-build]').addEventListener('click', () => this.prepare());
  }

  update(state) {
    const signature = JSON.stringify([state.pinnedId, state.ids, state.schemes?.active]);
    if (this.stateSignature !== undefined && signature !== this.stateSignature) {
      this.clearFoldResults('Gene selection or scheme changed. Fold again before preparing structure files.');
    }
    this.stateSignature = signature;
    this.state = state;
    const current = this.locus.value;
    const ids = [...new Set([state.pinnedId, ...state.ids].filter(Boolean))];
    this.locus.replaceChildren(...ids.map((id) => option(id, id === state.pinnedId ? `${id} (pinned)` : id)));
    if (ids.includes(current)) this.locus.value = current;
    this.host.querySelector('[data-rosetta-build]').disabled = ids.length === 0;
    this.status.textContent = ids.length ? '' : 'Pin or shortlist a locus to prepare a hand-off.';
  }

  setFoldResults(results) {
    this.foldResults = results.filter((entry) => !entry.error);
    this.clearPrepared('Fold results changed. Prepare files again to include an exact matching structure.');
  }

  clearFoldResults(message = '') {
    this.foldResults = [];
    this.clearPrepared(message);
  }

  clearPrepared(message = '') {
    this.outputs.replaceChildren();
    this.warning.replaceChildren();
    if (message) this.status.textContent = message;
  }

  matchingStructure(gene, sequence, form, region) {
    const result = this.foldResults.find((entry) => entry.id === gene.id);
    return matchingFoldStructure(result, sequence, form, region);
  }

  async prepare() {
    try {
      const id = this.locus.value;
      const gene = this.state.dataset.genes[this.state.dataset.indexById.get(id)];
      const form = this.form.value;
      const region = this.region.value;
      const selected = handoffSequence({ gene, table: this.state.dataset.table,
        map: this.state.schemes.active.map, form, region, start: this.start.value, end: this.end.value });
      const schemeName = this.state.schemes.active.name || 'active-scheme';
      const header = handoffHeader({ locus: id, strain: 'Synechococcus-elongatus-UTEX-2973',
        form, schemeName, region: selected.label, siteVersion: this.state.dataset.meta.builtAt ?? 'unversioned' });
      const fold = this.matchingStructure(gene, selected.sequence, form, region);
      const files = writeHandoffFormats({ sequence: selected.sequence, header,
        structure: fold?.structure ?? null, mfe: fold?.mfe ?? null });
      const hash = await sha256(selected.sequence);
      const formats = Object.keys(files);
      this.renderWarnings(selected.sequence.length, form, Boolean(fold));
      this.renderFiles({ id, form, region: selected.label, sequence: selected.sequence, hash, files, formats,
        schemeName, structureIncluded: Boolean(fold) });
      this.status.textContent = `Prepared ${formats.length} formats for ${id}; SHA-256 ${hash.slice(0, 12)}….`;
    } catch (error) {
      this.clearPrepared();
      this.status.textContent = error.message;
    }
  }

  renderWarnings(length, form, structure) {
    const messages = [];
    if (length < 30 || length > 200) messages.push(`Length warning: ${length} nt is outside the 30–200 nt training range.`);
    if (form === 'recoded') messages.push('Homology warning: changed codons in recoded RNA have no natural homologs.');
    if (!structure) messages.push('Structure files unavailable: complete a ViennaRNA fold for this exact sequence and current scheme first.');
    for (const message of messages) {
      const node = document.createElement('p');
      node.className = 'provenance-warning';
      node.textContent = message;
      this.warning.append(node);
    }
  }

  renderFiles(record) {
    this.outputs.replaceChildren();
    for (const [format, content] of Object.entries(record.files)) {
      const item = document.createElement('section');
      item.className = 'rosetta-output';
      const title = document.createElement('strong');
      title.textContent = format === 'dotBracket' ? 'Dot bracket' : format;
      const preview = document.createElement('pre');
      preview.textContent = content;
      const actions = document.createElement('div');
      actions.className = 'button-row';
      const copy = document.createElement('button');
      copy.type = 'button'; copy.className = 'chip-button'; copy.textContent = `Copy ${title.textContent}`;
      copy.addEventListener('click', async () => {
        try {
          await copyTextWithFallback(content);
          this.status.textContent = `Copied ${title.textContent}.`;
          this.record(record, format);
        } catch (error) {
          this.status.textContent = error.message;
        }
      });
      const download = document.createElement('button');
      download.type = 'button'; download.className = 'chip-button'; download.textContent = `Download .${EXTENSIONS[format]}`;
      download.addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url; link.download = `${slug(record.id)}_${slug(record.form)}_${slug(record.schemeName)}_${slug(record.region)}_${slug(format)}.${EXTENSIONS[format]}`;
        document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
        this.status.textContent = `Downloaded ${link.download}.`;
        this.record(record, format);
      });
      actions.append(copy, download);
      item.append(title, actions, preview);
      this.outputs.append(item);
    }
  }

  record(record, format) {
    this.onRecord({ locus: record.id, form: record.form,
      schemeName: record.form === 'recoded' ? record.schemeName : null, region: record.region,
      formats: [format], sequenceHash: record.hash,
      viennaRnaVersion: ['dotBracket', 'ct'].includes(format) ? FOLD_SETTINGS.version : null });
  }
}
