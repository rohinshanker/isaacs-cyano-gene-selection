import { FoldingClient } from '../core/folding-client.js';
import { serializeSchemeMap } from '../core/scheme.js';
import { RosettaHandoffPanel } from './rosetta-handoff-panel.js';

/** A changed input only invalidates something after the user has actually started a fold. */
export function foldInputsInvalidateResult(previousSignature, nextSignature, hasStarted) {
  return hasStarted && previousSignature !== undefined && previousSignature !== nextSignature;
}

/** A compact on-demand calculation with a captured, visible scheme identity. */
export class FoldingPanel {
  constructor(host, client = new FoldingClient()) {
    this.host = host;
    this.client = client;
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
      <p class="panel-note">ViennaRNA 2.7.2 · Turner 2004 · 37 °C · dangles 2 · salt 1.021 M · GU and lonely pairs allowed · minimum loop 3 · no G-quadruplexes. <a href="vendor/viennarna/PROVENANCE.md">Engine source, license, and build</a>. Credit: ViennaRNA authors and the Institute for Theoretical Chemistry, University of Vienna.</p>
    </details>
    <p class="panel-note" role="status" aria-live="polite" data-fold-status></p>
    <progress aria-label="RNA folding progress" hidden></progress>
    <div data-fold-results></div>
    <section data-rosetta-host></section>`;
    this.button = host.querySelector('#fold-button');
    this.cancelButton = host.querySelector('[data-fold-cancel]');
    this.status = host.querySelector('[data-fold-status]');
    this.progress = host.querySelector('progress');
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
    this.progress.hidden = !busy;
    this.host.setAttribute('aria-busy', String(busy));
  }

  renderResults(results) {
    this.results.replaceChildren();
    for (const result of results) {
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
          const value = result.windows[key];
          const line = document.createElement('p');
          line.textContent = `${label} (${value.length} nt): WT ${value.wildMfe.toFixed(2)} → recoded ${value.recodedMfe.toFixed(2)}; Δ ${value.delta >= 0 ? '+' : ''}${value.delta.toFixed(2)} kcal/mol`;
          item.append(line);
        }
      }
      this.results.append(item);
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
    this.progress.value = 0;
    this.progress.max = ids.length;
    this.setBusy(true);
    try {
      const report = await this.client.run({ dataset, ids, map: active.map, onProgress: (event) => {
        if (generation !== this.generation) return;
        this.progress.value = event.completed;
        this.status.textContent = event.phase === 'loading'
          ? `Preparing local engine for ${label}… First use downloads the engine from this site.`
          : `${event.completed}/${event.total} genes processed for ${label}.`;
        this.renderResults(event.results);
      } });
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
