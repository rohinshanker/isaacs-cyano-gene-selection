/**
 * The tRNA tab: an accessible track, a searchable locus list, and this layer's
 * own detail panel.
 *
 * It is its own application tab rather than a block under the CDS viewer
 * because it is its own population. Nothing here pins, previews, shortlists,
 * filters or recomputes a protein-coding gene, and the one route into the
 * chromosome view is the explicit hand-off below, which moves the camera and
 * the tab and leaves the protein selection where it was.
 */

import {
  clusterTrnaMarkers, matchesTrnaFilters, overlappingTrnas,
} from '../core/trna-loci.js';
import { formatCount } from './format.js';

const CANDIDATE_KIND = 'scan-only-candidate';

export const TRNA_TAB = Object.freeze({
  id: 'trna',
  name: 'tRNA',
  // The panel's own boundary note states the independence rule, so this says
  // what the tab is and how it reaches the chromosome, and does not repeat it.
  blurb: 'The annotated tRNA loci of the genome of record, on their own track and in a '
    + 'searchable list, each with its own detail. Selecting one opens this layer\'s detail '
    + 'alone; the button on that detail moves the chromosome view to its native coordinate. An '
    + 'organism whose release publishes no validated tRNA layer says so here instead.',
  source: 'Read from the organism\'s published tRNA layer: release-pinned annotation beside the '
    + 'pinned local scan it was compared against. No coordinate from another strain is placed '
    + 'on this track.',
});

function option(value, label) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

function field(label, value) {
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = value;
  return [term, description];
}

function displayIsotype(value) {
  return value === 'Undet' ? 'Undetermined (Undet)' : value;
}

function displayAnticodon(value) {
  return value === 'NNN' ? 'Undetermined (NNN)' : value;
}

/** Stable, truthful label shared by markers, rows, and announcements. */
export function trnaLabel(locus) {
  if (locus.kind === CANDIDATE_KIND) {
    return `Predicted pseudogene candidate at ${locus.replicon}:${locus.start}-${locus.end}`;
  }
  return `${locus.locusTag} · ${locus.scanIsotype} · ${locus.scanAnticodon}`;
}

export class TrnaViewer {
  constructor(host, handlers = {}) {
    this.host = host;
    this.handlers = handlers;
    this.payload = null;
    this.fileState = 'loading';
    this.fileError = null;
    this.viewport = null;
    this.selectedId = null;
    this.showTrack = true;
    this.showCandidate = false;
    this.filters = { query: '', strand: 'all', kind: 'all', isotype: 'all', anticodon: 'all' };
    this.build();
  }

  build() {
    this.host.replaceChildren();
    this.section = document.createElement('section');
    this.section.className = 'trna-viewer';
    this.section.setAttribute('aria-labelledby', 'trna-viewer-title');

    const headingRow = document.createElement('div');
    headingRow.className = 'trna-heading-row';
    this.heading = document.createElement('h3');
    this.heading.id = 'trna-viewer-title';
    this.heading.textContent = 'tRNA loci';
    this.countSummary = document.createElement('p');
    this.countSummary.className = 'trna-count-summary';
    headingRow.append(this.heading, this.countSummary);

    this.boundary = document.createElement('p');
    this.boundary.className = 'panel-note';
    this.boundary.textContent = 'This noncoding layer is independent of protein-gene selection, '
      + 'the shortlist, tAI/CDS populations, and recoding models. Sequences are genomic loci in '
      + 'transcription orientation, not measured mature or modified tRNAs.';

    this.status = document.createElement('div');
    this.status.className = 'trna-status';
    this.status.setAttribute('role', 'status');

    this.ready = document.createElement('div');
    this.ready.className = 'trna-ready';

    const visibility = document.createElement('div');
    visibility.className = 'trna-visibility';
    const trackRow = document.createElement('span');
    trackRow.className = 'checkbox-row';
    this.trackToggle = document.createElement('input');
    this.trackToggle.type = 'checkbox';
    this.trackToggle.id = 'trna-show-track';
    this.trackToggle.checked = true;
    const trackLabel = document.createElement('label');
    trackLabel.htmlFor = this.trackToggle.id;
    trackLabel.textContent = 'Show tRNA track';
    trackRow.append(this.trackToggle, trackLabel);

    const candidateRow = document.createElement('span');
    candidateRow.className = 'checkbox-row';
    this.candidateToggle = document.createElement('input');
    this.candidateToggle.type = 'checkbox';
    this.candidateToggle.id = 'trna-show-candidate';
    const candidateLabel = document.createElement('label');
    candidateLabel.htmlFor = this.candidateToggle.id;
    candidateLabel.textContent = 'Show predicted pseudogene candidate';
    candidateRow.append(this.candidateToggle, candidateLabel);
    visibility.append(trackRow, candidateRow);

    this.trackFigure = document.createElement('div');
    this.trackFigure.className = 'trna-track-figure';
    this.trackCaption = document.createElement('p');
    this.trackCaption.className = 'trna-track-caption';
    this.trackCaption.id = 'trna-track-caption';
    this.track = document.createElement('div');
    this.track.className = 'trna-track';
    this.track.setAttribute('role', 'group');
    this.track.setAttribute('aria-labelledby', 'trna-track-caption');
    this.trackAxis = document.createElement('span');
    this.trackAxis.className = 'trna-track-axis';
    this.trackMarkers = document.createElement('div');
    this.trackMarkers.className = 'trna-track-markers';
    this.track.append(this.trackAxis, this.trackMarkers);
    // The window is the chromosome view's, so the track says so: a reader who
    // left that tab zoomed in must be able to tell a narrow window from an
    // empty layer. The list below is never limited by it.
    this.trackWindowNote = document.createElement('p');
    this.trackWindowNote.className = 'panel-note trna-track-window-note';
    this.trackWindowNote.textContent = 'The track follows the Chromosome/Gene coordinate '
      + 'window, which starts at the whole primary replicon. The locus list below is never '
      + 'limited by that window.';
    this.trackFigure.append(this.trackCaption, this.track, this.trackWindowNote);

    const filters = document.createElement('div');
    filters.className = 'trna-filters';
    const searchField = document.createElement('span');
    searchField.className = 'field-row trna-search-field';
    const searchLabel = document.createElement('label');
    searchLabel.htmlFor = 'trna-search';
    searchLabel.textContent = 'Search';
    this.search = document.createElement('input');
    this.search.type = 'search';
    this.search.id = 'trna-search';
    this.search.placeholder = 'Locus, amino acid, or anticodon';
    searchField.append(searchLabel, this.search);
    this.strand = this.select('trna-strand', 'Strand', [
      ['all', 'All strands'], ['+', 'Plus strand'], ['-', 'Minus strand'],
    ]);
    this.kind = this.select('trna-kind', 'Record type', [
      ['all', 'All record types'], ['refseq', 'RefSeq annotated'],
      [CANDIDATE_KIND, 'Predicted candidate'],
    ]);
    this.isotype = this.select('trna-isotype', 'Isotype', [['all', 'All isotypes']]);
    this.anticodon = this.select('trna-anticodon', 'Anticodon', [['all', 'All anticodons']]);
    filters.append(searchField, this.strand.wrapper, this.kind.wrapper,
      this.isotype.wrapper, this.anticodon.wrapper);

    this.resultsSummary = document.createElement('p');
    this.resultsSummary.className = 'trna-results-summary';
    this.resultsSummary.setAttribute('role', 'status');
    this.list = document.createElement('ul');
    this.list.className = 'trna-list';
    this.empty = document.createElement('p');
    this.empty.className = 'trna-empty';
    this.empty.textContent = 'No tRNA loci match these filters.';
    this.empty.hidden = true;

    this.detail = document.createElement('article');
    this.detail.className = 'trna-detail';
    this.detail.hidden = true;

    this.ready.append(visibility, this.trackFigure, filters, this.resultsSummary,
      this.list, this.empty, this.detail);
    this.section.append(headingRow, this.boundary, this.status, this.ready);
    this.host.append(this.section);

    this.trackToggle.addEventListener('change', () => {
      this.showTrack = this.trackToggle.checked;
      this.renderTrack();
      this.handlers.onAnnounce?.(`tRNA track ${this.showTrack ? 'shown' : 'hidden'}.`);
    });
    this.candidateToggle.addEventListener('change', () => {
      this.showCandidate = this.candidateToggle.checked;
      this.renderContent();
      this.handlers.onAnnounce?.(`Predicted pseudogene candidate ${this.showCandidate
        ? 'shown' : 'hidden'}.`);
    });
    this.search.addEventListener('input', () => {
      this.filters.query = this.search.value;
      this.renderContent();
    });
    for (const [control, key] of [[this.strand.select, 'strand'], [this.kind.select, 'kind'],
      [this.isotype.select, 'isotype'], [this.anticodon.select, 'anticodon']]) {
      control.addEventListener('change', () => {
        this.filters[key] = control.value;
        this.renderContent();
      });
    }
    this.resizeObserver = new ResizeObserver(() => this.renderTrack());
    this.resizeObserver.observe(this.track);
  }

  select(id, label, choices) {
    const wrapper = document.createElement('span');
    wrapper.className = 'field-row';
    const labelNode = document.createElement('label');
    labelNode.htmlFor = id;
    labelNode.textContent = label;
    const select = document.createElement('select');
    select.id = id;
    for (const [value, text] of choices) select.append(option(value, text));
    wrapper.append(labelNode, select);
    return { wrapper, select };
  }

  update({ payload = null, fileState = 'absent', fileError = null, viewport = null } = {}) {
    const changedPayload = this.payload !== payload;
    this.payload = payload;
    this.fileState = fileState;
    this.fileError = fileError;
    this.viewport = viewport;
    if (changedPayload && payload) this.populateRecordedFilters();
    this.render();
  }

  setViewport(viewport) {
    this.viewport = viewport;
    if (this.fileState === 'ready') this.renderTrack();
  }

  populateRecordedFilters() {
    const loci = this.payload?.loci ?? [];
    const fill = (control, values, label) => {
      const selected = control.value;
      control.replaceChildren(option('all', `All ${label}`));
      for (const value of values) control.append(option(value, value));
      control.value = values.includes(selected) ? selected : 'all';
    };
    fill(this.isotype.select, [...new Set(loci.flatMap((locus) => (
      [locus.refseqIsotype, locus.scanIsotype])).filter(Boolean))].sort(), 'isotypes');
    fill(this.anticodon.select, [...new Set(loci.flatMap((locus) => (
      [locus.refseqAnticodon, locus.scanAnticodon])).filter(Boolean))].sort(), 'anticodons');
  }

  render() {
    this.status.replaceChildren();
    const ready = this.fileState === 'ready' && this.payload;
    this.ready.hidden = !ready;
    if (ready) {
      const { annotated, predictedCandidates } = this.payload.counts;
      this.countSummary.textContent = `${formatCount(annotated)} RefSeq-annotated loci · `
        + `${formatCount(predictedCandidates)} additional predicted pseudogene candidate `
        + '(hidden by default)';
      this.renderContent();
      return;
    }
    this.countSummary.textContent = '';
    const message = document.createElement('p');
    if (this.fileState === 'loading') {
      message.textContent = 'Loading the optional tRNA layer…';
    } else if (this.fileState === 'failed') {
      message.textContent = `The tRNA layer could not be loaded${this.fileError?.message
        ? `: ${this.fileError.message}` : '.'}`;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'chip-button';
      retry.textContent = 'Retry tRNA layer';
      retry.addEventListener('click', () => this.handlers.onRetry?.());
      this.status.append(message, retry);
      return;
    } else {
      message.textContent = 'This organism does not publish a validated tRNA viewer layer.';
    }
    this.status.append(message);
  }

  candidateAllowed(locus) {
    return locus.kind !== CANDIDATE_KIND || this.showCandidate;
  }

  matchingLoci() {
    const matches = (this.payload?.loci ?? [])
      .filter((locus) => this.candidateAllowed(locus) && matchesTrnaFilters(locus, this.filters));
    const selected = this.payload?.loci.find((locus) => locus.id === this.selectedId) ?? null;
    if (selected && !matches.some((locus) => locus.id === selected.id)) matches.push(selected);
    return { matches, selectedRetained: Boolean(selected
      && !this.candidateAllowed(selected)) || Boolean(selected
      && !matchesTrnaFilters(selected, this.filters)) };
  }

  renderContent() {
    if (!this.payload) return;
    const active = document.activeElement;
    const activeListLocus = this.list.contains(active) ? active?.dataset?.trnaId ?? null : null;
    const { matches, selectedRetained } = this.matchingLoci();
    this.resultsSummary.textContent = `${formatCount(matches.length)} ${matches.length === 1 ? 'locus' : 'loci'} `
      + `${matches.length === 1 ? 'is' : 'are'} shown${selectedRetained
        ? '; the selected locus is retained outside the current filters' : ''}.`;
    this.empty.hidden = matches.length > 0;
    this.list.replaceChildren();
    for (const locus of matches) this.list.append(this.listItem(locus, selectedRetained));
    this.renderTrack();
    this.renderDetail();
    if (activeListLocus) {
      this.list.querySelector?.(`[data-trna-id="${CSS.escape(activeListLocus)}"]`)?.focus();
    }
  }

  listItem(locus, selectedRetained) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'trna-row';
    button.dataset.trnaId = locus.id;
    button.setAttribute('aria-pressed', String(locus.id === this.selectedId));
    if (locus.id === this.selectedId) button.classList.add('is-selected');
    const name = document.createElement('strong');
    name.textContent = trnaLabel(locus);
    const facts = document.createElement('span');
    facts.textContent = `${locus.replicon}:${locus.start.toLocaleString('en-US')}–`
      + `${locus.end.toLocaleString('en-US')} · ${locus.strand} strand · ${locus.lengthNt} nt`;
    button.append(name, facts);
    if (locus.kind === CANDIDATE_KIND) {
      const badge = document.createElement('span');
      badge.className = 'trna-candidate-badge';
      badge.textContent = 'Predicted candidate · pseudo';
      button.append(badge);
    }
    if (selectedRetained && locus.id === this.selectedId) {
      const retained = document.createElement('span');
      retained.className = 'trna-retained';
      retained.textContent = 'Selected · retained outside filters';
      button.append(retained);
    }
    button.addEventListener('click', () => this.selectLocus(locus, button));
    item.append(button);
    return item;
  }

  selectLocus(locus, focusTarget = null) {
    this.selectedId = locus.id;
    this.renderContent();
    this.handlers.onAnnounce?.(`${trnaLabel(locus)} selected in the independent tRNA detail.`);
    const restored = this.list.querySelector?.(`[data-trna-id="${CSS.escape(locus.id)}"]`);
    (restored ?? focusTarget)?.focus?.();
  }

  visibleTrackLoci() {
    return this.matchingLoci().matches;
  }

  renderTrack() {
    if (!this.trackFigure || !this.payload) return;
    const focusedMarker = this.trackMarkers.contains(document.activeElement)
      ? document.activeElement : null;
    const focusedIds = focusedMarker?.dataset?.trnaIds?.split('\n').filter(Boolean) ?? [];
    this.trackToggle.checked = this.showTrack;
    this.candidateToggle.checked = this.showCandidate;
    this.trackFigure.hidden = !this.showTrack;
    this.trackMarkers.replaceChildren();
    if (!this.showTrack) return;
    const viewport = this.viewport;
    if (!viewport) {
      this.trackCaption.textContent = 'tRNA track · chromosome window unavailable';
      return;
    }
    this.trackCaption.textContent = `tRNA track · ${viewport.replicon} `
      + `${viewport.from.toLocaleString('en-US')}–${viewport.to.toLocaleString('en-US')}`;
    const width = this.track.getBoundingClientRect().width || 1;
    const clusters = clusterTrnaMarkers(this.visibleTrackLoci(), viewport, width);
    for (const cluster of clusters) {
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = cluster.loci.length > 1 ? 'trna-marker is-cluster' : 'trna-marker';
      marker.dataset.trnaIds = cluster.loci.map((locus) => locus.id).join('\n');
      if (cluster.candidate) marker.classList.add('has-candidate');
      marker.style.left = `${(cluster.x / width) * 100}%`;
      if (cluster.loci.length > 1) {
        const count = document.createElement('span');
        count.textContent = String(cluster.loci.length);
        marker.append(count);
      }
      marker.setAttribute('aria-label', cluster.loci.length > 1
        ? `${cluster.loci.length} tRNA loci${cluster.candidate
          ? ', including the predicted pseudogene candidate,' : ''} share this track position; `
          + 'open the locus list below'
        : trnaLabel(cluster.loci[0]));
      marker.addEventListener('click', () => {
        if (cluster.loci.length === 1) this.selectLocus(cluster.loci[0], marker);
        else {
          const row = cluster.loci.map((locus) => this.list.querySelector?.(
            `[data-trna-id="${CSS.escape(locus.id)}"]`,
          )).find(Boolean);
          if (!row) {
            this.selectLocus(cluster.loci[0], marker);
            return;
          }
          row?.focus();
          row?.scrollIntoView?.({ block: 'nearest' });
          this.handlers.onAnnounce?.(`${cluster.loci.length} tRNA loci share this marker; `
            + 'the first locus in the filtered list is focused.');
        }
      });
      this.trackMarkers.append(marker);
    }
    if (clusters.length === 0) {
      const note = document.createElement('span');
      note.className = 'trna-track-empty';
      note.textContent = 'No tRNA loci in this window';
      this.trackMarkers.append(note);
    }
    if (focusedIds.length > 0) {
      const replacement = [...this.trackMarkers.querySelectorAll('.trna-marker')]
        .find((marker) => marker.dataset.trnaIds.split('\n')
          .some((id) => focusedIds.includes(id)));
      replacement?.focus();
    }
  }

  renderDetail() {
    const locus = this.payload?.loci.find((row) => row.id === this.selectedId) ?? null;
    this.detail.hidden = !locus;
    this.detail.replaceChildren();
    if (!locus) return;
    const title = document.createElement('h4');
    title.textContent = trnaLabel(locus);
    const status = document.createElement('p');
    status.className = 'trna-detail-status';
    status.textContent = locus.kind === CANDIDATE_KIND
      ? 'Scan-only predicted pseudogene candidate; excluded from the 44-locus copy-count model.'
      : 'RefSeq annotation and the pinned local scan are coordinate-concordant.';
    const reveal = document.createElement('button');
    reveal.type = 'button';
    reveal.className = 'chip-button trna-show-on-chromosome';
    reveal.textContent = 'Show on chromosome';
    reveal.setAttribute('aria-label', `Show ${trnaLabel(locus)} on the chromosome view without `
      + 'changing the pinned gene');
    reveal.addEventListener('click', () => this.handlers.onShowOnChromosome?.(locus));
    const facts = document.createElement('dl');
    facts.className = 'trna-facts';
    const rows = [
      field('Stable identity', locus.id),
      field('Native coordinates', `${locus.replicon}:${locus.start}-${locus.end} (${locus.strand})`),
      field('Length', `${locus.lengthNt} nt`),
      field('RefSeq locus', locus.locusTag ?? 'None — scan-only candidate'),
      field('RefSeq product', locus.refseqProduct ?? 'Not annotated'),
      field('RefSeq isotype', locus.refseqIsotype
        ? displayIsotype(locus.refseqIsotype) : 'Not annotated'),
      field('RefSeq genomic anticodon', locus.refseqAnticodon
        ? displayAnticodon(locus.refseqAnticodon) : 'Not annotated'),
      field('Scan isotype', displayIsotype(locus.scanIsotype)),
      field('Scan anticodon', displayAnticodon(locus.scanAnticodon)),
      field('Annotation vs scan', locus.annotationScanStatus),
      field('Pseudogene flag', locus.pseudo ? 'Yes (scan prediction)' : 'No'),
    ];
    if (locus.modelEffectiveAnticodon
      && locus.modelEffectiveAnticodon !== locus.refseqAnticodon) {
      rows.push(field('Model-effective anticodon', locus.modelEffectiveAnticodon));
    }
    const overlaps = overlappingTrnas(locus, this.payload.loci);
    rows.push(field('Overlapping tRNA records', overlaps.length === 0
      ? 'None' : overlaps.map((row) => row.locusTag ?? row.id).join(', ')));
    for (const row of rows) facts.append(...row);

    const sequenceHeading = document.createElement('h5');
    sequenceHeading.textContent = 'Genomic sequence in transcription orientation';
    const sequence = document.createElement('code');
    sequence.className = 'trna-sequence';
    sequence.textContent = locus.sequence;
    const sequenceNote = document.createElement('p');
    sequenceNote.className = 'panel-note';
    sequenceNote.textContent = 'Genomic locus sequence only; this is not a measured mature, '
      + 'modified, expressed, or charged tRNA sequence.';

    const sourcesHeading = document.createElement('h5');
    sourcesHeading.textContent = 'Pinned evidence';
    const sources = document.createElement('p');
    sources.className = 'trna-sources';
    const refseq = document.createElement('a');
    refseq.href = this.payload.sources.refseq.href;
    refseq.textContent = this.payload.sources.refseq.label;
    const comparison = document.createElement('a');
    comparison.href = this.payload.sources.comparison.href;
    comparison.textContent = this.payload.sources.comparison.label;
    sources.append(refseq, document.createTextNode(' · '), comparison);
    const run = document.createElement('p');
    run.className = 'panel-note';
    run.textContent = `${this.payload.assembly} · ${this.payload.annotationRelease} · `
      + `${this.payload.run.tool} ${this.payload.run.version}, ${this.payload.run.mode} · `
      + `run ${this.payload.run.id}`;
    this.detail.append(title, status, reveal, facts, sequenceHeading, sequence, sequenceNote,
      sourcesHeading, sources, run);
  }
}
