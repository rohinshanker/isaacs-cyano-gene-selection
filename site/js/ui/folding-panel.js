import { compareFoldingWindow } from '../core/folding-comparison.js';
import { FoldingClient } from '../core/folding-client.js';
import { serializeSchemeMap } from '../core/scheme.js';
import { RosettaHandoffPanel } from './rosetta-handoff-panel.js';

/** A compact, keyboard-scrollable alignment; every column is a window position. */
function comparisonDetails(value, comparison, label, geneId) {
  const details = document.createElement('details');
  details.className = 'folding-comparison';
  const summary = document.createElement('summary');
  summary.textContent = `${label}: aligned sequence and structure details`;
  summary.setAttribute('aria-label', `${geneId}: ${label}: aligned sequence and structure details`);
  const note = document.createElement('p');
  note.textContent = 'Positions are 1-based within this window, not genomic coordinates. WT = original. Highlight and ^ = pairing partner changed; underline and * = nucleotide edited. Dots are unpaired; matching parentheses form a pair. Scroll horizontally for all positions.';
  const changes = document.createElement('p');
  changes.textContent = `Pairing-changed positions: ${comparison.pairingChanged.join(', ') || 'none'}. Nucleotide-edited positions: ${comparison.sequenceChanged.join(', ') || 'none'}.`;
  const partners = document.createElement('details');
  partners.className = 'folding-partners';
  const partnerSummary = document.createElement('summary');
  partnerSummary.textContent = 'Pair partners (window positions)';
  partnerSummary.setAttribute('aria-label', `Pair partners (window positions): ${geneId}: ${label}`);
  const partnerNote = document.createElement('p');
  partnerNote.textContent = 'Pairs use 1-based window positions. All other positions are unpaired.';
  partners.append(partnerSummary, partnerNote);
  for (const [form, pairs] of [['WT', [...comparison.retained, ...comparison.lost]],
    ['Recoded', [...comparison.retained, ...comparison.gained]]]) {
    const list = document.createElement('p');
    const ordered = pairs.sort((a, b) => a[0] - b[0]);
    list.textContent = `${form} pairs: ${ordered.map(([left, right]) => `(${left}, ${right})`).join(', ') || 'none'}.`;
    partners.append(list);
  }
  details.append(summary, note, changes, partners);
  let built = false;
  // Large shortlists keep their per-base DOM out of the collapsed view.
  details.addEventListener('toggle', () => {
    if (!details.open || built) return;
    built = true;
    const alignment = document.createElement('pre');
    alignment.className = 'folding-alignment';
    alignment.tabIndex = 0;
    alignment.setAttribute('role', 'region');
    alignment.setAttribute('aria-label', `${geneId}: ${label}: window-relative sequence and dot-bracket alignment`);
    const rows = [
      ['Position', Array.from({ length: value.length }, (_, i) => String(i + 1))],
      ['WT RNA', [...value.wildSequence]], ['Recoded RNA', [...value.recodedSequence]],
      ['WT structure', [...value.wildStructure]], ['Recoded structure', [...value.recodedStructure]],
      ['Pairing change', Array.from({ length: value.length }, (_, i) => comparison.pairingChanged.includes(i + 1) ? '^' : ' ')],
      ['Sequence edit', Array.from({ length: value.length }, (_, i) => comparison.sequenceChanged.includes(i + 1) ? '*' : ' ')],
    ];
    for (const [name, symbols] of rows) {
      const row = document.createElement('span');
      row.className = 'folding-alignment-row';
      const heading = document.createElement('span');
      heading.textContent = name.padEnd(19);
      row.append(heading);
      symbols.forEach((symbol, i) => {
        const base = document.createElement('span');
        const pairing = comparison.pairingChanged.includes(i + 1);
        const edited = comparison.sequenceChanged.includes(i + 1);
        base.textContent = symbol.padStart(4);
        base.className = `${pairing ? 'folding-pair-change' : ''} ${edited ? 'folding-sequence-edit' : ''}`.trim();
        base.title = `Window position ${i + 1}: WT partner ${comparison.wildPartners[i] || 'unpaired'}, recoded partner ${comparison.recodedPartners[i] || 'unpaired'}; ${pairing ? 'pairing changed' : 'pairing unchanged'}; ${edited ? 'nucleotide edited' : 'nucleotide unchanged'}.`;
        row.append(base);
      });
      alignment.append(row);
    }
    details.append(alignment);
  });
  return details;
}

/** A changed input only invalidates something after the user has actually started a fold. */
export function foldInputsInvalidateResult(previousSignature, nextSignature, hasStarted) {
  return hasStarted && previousSignature !== undefined && previousSignature !== nextSignature;
}

/** A compact on-demand calculation with a captured, visible scheme identity. */
export class FoldingPanel {
  /**
   * @param {HTMLElement} host
   * @param {FoldingClient} client
   * @param {(label: string, operation: () => Promise<object>) => Promise<object>} runActivity
   *   Optional bridge to the application's shared loading presentation.
   */
  constructor(host, client = new FoldingClient(), runActivity = (_label, operation) => operation()) {
    this.host = host;
    this.client = client;
    this.runActivity = runActivity;
    this.generation = 0;
    host.className = 'folding-panel';
    host.innerHTML = `<div class="button-row">
      <button type="button" class="chip-button" id="fold-button" aria-describedby="fold-note">Fold recoded RNA</button>
      <button type="button" class="chip-button" data-fold-cancel hidden>Cancel folding</button>
    </div>
    <p class="panel-note" id="fold-note">Compare predicted RNA folding before and after the active recoding scheme. Runs locally for this shortlist when requested.</p>
    <details><summary>How to interpret RNA folding</summary>
      <p class="panel-note">Minimum free energy (MFE) predicts the most stable RNA secondary structure in a sequence window. More negative energy means a more stable predicted structure. ΔMFE is recoded minus wild type: positive means less stable; negative means more stable.</p>
      <p class="panel-note">Two windows are folded: genomic −30:+60 around the translation start (90 nt, wrapping circular replicon boundaries) and the first 100 CDS nt, or the whole CDS if shorter. Only selected CDS positions are recoded; other genomic bases remain wild type. Shared bases in overlapping neighbors can change. The initiation triplet is preserved, including non-ATG starts; a mapped terminal stop remains a stop.</p>
      <p class="panel-note">Folding is calculated on request to keep the map responsive. These are unconstrained, linear RNA predictions, not measured structures or expression. They omit cellular conditions, RNA–protein interactions, pseudoknots, and effects outside the windows. Overlaps can affect neighboring proteins; synonymous recoding here does not guarantee neighbor safety.</p>
      <p class="panel-note">The comparison uses one predicted MFE structure per sequence. Retained pairs occur in both structures; lost pairs occur only in WT; gained pairs occur only in recoded. Base-pair distance is lost + gained (<a href="https://www.tbi.univie.ac.at/RNA/ViennaRNA/doc/html/utils/struct/metrics.html" target="_blank" rel="noopener noreferrer">ViennaRNA definition</a>). Pairing changes compare partner positions, separately from nucleotide edits. These counts are not accessibility probabilities, functional effects, or harm scores.</p>
      <p class="panel-note">ViennaRNA 2.7.2 · Turner 2004 · 37 °C · dangles 2 · salt 1.021 M · GU and lonely pairs allowed · minimum loop 3 · no G-quadruplexes. <a href="vendor/viennarna/PROVENANCE.md">Engine source, license, and build</a>. Credit: ViennaRNA authors and the Institute for Theoretical Chemistry, University of Vienna.</p>
    </details>
    <p class="panel-note" role="status" aria-live="polite" data-fold-status></p>
    <div data-fold-results></div>
    <section data-rosetta-host></section>`;
    this.button = host.querySelector('#fold-button');
    this.cancelButton = host.querySelector('[data-fold-cancel]');
    this.status = host.querySelector('[data-fold-status]');
    this.results = host.querySelector('[data-fold-results]');
    this.handoffRecords = new Map();
    this.rosetta = new RosettaHandoffPanel(host.querySelector('[data-rosetta-host]'), {
      onRecord: (record) => this.handoffRecords.set(JSON.stringify([
        record.locus, record.form, record.schemeName, record.region, record.sequenceHash, record.formats,
      ]), record),
    });
    this.button.addEventListener('click', () => this.run());
    this.cancelButton.addEventListener('click', () => this.client.cancel());
  }

  update(state) {
    const signature = JSON.stringify([state.ids, serializeSchemeMap(state.schemes?.active?.map)]);
    if (foldInputsInvalidateResult(this.signature, signature, this.hasStarted)) {
      this.client.cancel();
      this.generation += 1;
      this.results.replaceChildren();
      this.renderedRows = [];
      this.rosetta.clearFoldResults();
      this.status.textContent = 'Shortlist or scheme changed. Fold again for the current inputs.';
      this.setBusy(false);
    }
    this.signature = signature;
    this.state = state;
    this.rosetta.update(state);
    this.button.disabled = this.client.running || state.ids.length === 0;
  }

  setBusy(busy) {
    this.button.disabled = busy || this.state.ids.length === 0;
    this.cancelButton.hidden = !busy;
    this.host.setAttribute('aria-busy', String(busy));
  }

  renderResults(results) {
    const rows = this.renderedRows ??= [];
    // Client progress copies the array but retains completed result identities.
    // Preserve those nodes (including disclosure, focus and scroll state), while
    // reconciling new runs, replaced results, shortened lists and cleared DOM.
    if (results.length < rows.length || this.results.children.length !== rows.length
        || rows.some(({ result, node }, i) => result !== results[i] || node !== this.results.children[i])) {
      this.results.replaceChildren();
      rows.length = 0;
    }
    for (const result of results.slice(rows.length)) {
      const item = document.createElement('div');
      item.className = 'folding-result';
      const heading = document.createElement('strong');
      heading.textContent = `${result.id}${result.cached ? ' · cached' : ''}`;
      item.append(heading);
      if (result.error) {
        const error = document.createElement('p');
        error.textContent = result.error;
        item.append(error);
      } else {
        for (const [key, label] of [['start', 'Start −30:+60'], ['first100', 'First CDS nt']]) {
          const value = result.windows?.[key];
          const line = document.createElement('p');
          const validEnergy = value && [value.wildMfe, value.recodedMfe, value.delta].every(Number.isFinite);
          line.textContent = validEnergy ? `${label} (${value.length} nt): WT ${value.wildMfe.toFixed(2)} → recoded ${value.recodedMfe.toFixed(2)}; Δ ${value.delta >= 0 ? '+' : ''}${value.delta.toFixed(2)} kcal/mol` : `${label}: energy unavailable.`;
          item.append(line);
          const comparison = compareFoldingWindow(value);
          const counts = document.createElement('p');
          counts.className = 'folding-pair-summary';
          counts.textContent = comparison
            ? `Predicted pairs: ${comparison.retained.length} retained · ${comparison.lost.length} lost · ${comparison.gained.length} gained. Base-pair distance ${comparison.distance}. Pairing changed at ${comparison.pairingChanged.length} positions; ${comparison.sequenceChanged.length} nucleotide edits.`
            : 'Structure comparison unavailable: missing or invalid sequence/structure output.';
          item.append(counts);
          if (comparison) item.append(comparisonDetails(value, comparison, label, result.id));
        }
      }
      this.results.append(item);
      rows.push({ result, node: item });
    }
    this.rosetta.setFoldResults(results);
  }

  handoffs() { return [...this.handoffRecords.values()]; }

  async run() {
    if (this.client.running) return;
    this.hasStarted = true;
    const generation = ++this.generation;
    const { ids, dataset, schemes } = this.state;
    const active = schemes?.active ?? { name: '', map: {} };
    const label = `${active.name || 'Active scheme'} (${serializeSchemeMap(active.map) || 'identity map'})`;
    this.results.replaceChildren();
    this.renderedRows = [];
    this.setBusy(true);
    try {
      const report = await this.runActivity('RNA folding', () => this.client.run({
        dataset, ids, map: active.map, onProgress: (event) => {
          if (generation !== this.generation) return;
          this.status.textContent = event.phase === 'loading'
            ? `Preparing local engine for ${label}… First use downloads the engine from this site.`
            : `${event.completed}/${event.total} genes processed for ${label}.`;
          this.renderResults(event.results);
        },
      }));
      if (generation !== this.generation) return;
      this.renderResults(report.results);
      const failed = report.results.filter((result) => result.error).length;
      const cached = report.results.filter((result) => result.cached).length;
      this.status.textContent = `${report.cancelled ? 'Cancelled' : 'Finished'}: ${report.results.length - failed} succeeded, ${failed} failed, ${cached} cache hits for ${label}. ViennaRNA 2.7.2 · 37 °C · Turner 2004. Completed results are retained in this tab.`;
    } catch (error) {
      if (generation === this.generation) this.status.textContent = error.message;
    } finally {
      // A changed-input cancellation still needs to re-enable the current action.
      this.setBusy(false);
    }
  }
}
