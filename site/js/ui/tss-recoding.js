import { describeTssEdit, TSS_EDIT_LABEL, TSS_EDIT_DESCRIPTION } from '../core/tss-recoding.js';
import { describeNeighborSite } from '../core/neighbor-sites.js';

/** A compact disclosure keeps the initial view quiet and every crowded site reachable. */
export class TssEditPanel {
  constructor() {
    this.element = document.createElement('details');
    this.element.className = 'method-help tss-edit-details';
    this.summary = document.createElement('summary');
    this.summary.dataset.detailAction = 'tss-edit-summary';
    this.note = document.createElement('p');
    this.note.className = 'panel-note';
    this.list = document.createElement('ol');
    this.list.className = 'gene-view-site-rows';
    this.element.append(this.summary, this.note, this.list);
  }

  update(model, gene, visible = true, onReveal = null) {
    this.element.hidden = !model;
    const result = model?.forGene(gene);
    const reason = result?.reason ?? model?.reason ?? 'TSS comparison not evaluated.';
    if (this.result === result && this.visible === visible && this.reason === reason) return;
    const focused = this.element.contains(document.activeElement);
    const action = focused ? document.activeElement.dataset?.detailAction : null;
    this.result = result;
    this.reason = reason;
    this.visible = visible;
    const valid = result?.status === 'evaluated';
    this.summary.textContent = valid ? `${TSS_EDIT_LABEL}: ${result.edited} edited / ${result.evaluated} evaluated${result.evaluated === 0 ? ' · 0 recorded sites' : ''}` : `${TSS_EDIT_LABEL}: not evaluated`;
    this.note.textContent = (valid ? '' : `${reason} `) + TSS_EDIT_DESCRIPTION
      + (visible ? ' Purple lines locate the original TSS base; a small diamond identifies an edited base.' : ' Start-site marks are hidden; comparison and site details remain available.');
    this.list.replaceChildren();
    for (const site of result?.sites ?? []) {
      const row = document.createElement('li');
      row.className = 'tss-edit-row';
      const text = document.createElement('p');
      text.textContent = `${describeTssEdit(site, gene)} ${describeNeighborSite(site, gene)}`;
      row.append(text);
      if (onReveal) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip-button';
        button.textContent = `Inspect ${site.ids.join(', ') || site.position}`;
        button.disabled = !visible;
        button.dataset.detailAction = `tss-edit-${site.key}`;
        button.addEventListener('click', () => onReveal(site));
        row.append(button);
      }
      this.list.append(row);
    }
    if (focused) ([...this.element.querySelectorAll('[data-detail-action]')].find((node) => node.dataset.detailAction === action) ?? this.summary).focus?.({ preventScroll: true });
  }
}
