/** Shared annotation-only disclosure for the preview and pinned viewers. */
const stateByDetails = new WeakMap();
const node = (tag, className, text = '') => {
  const result = document.createElement(tag);
  result.className = className;
  result.textContent = text;
  return result;
};
const NONCODING_BIOTYPES = new Set(['tRNA', 'rRNA', 'tmRNA', 'ncRNA', 'SRP_RNA', 'RNase_P_RNA', 'antisense_RNA']);
const strandWords = (strand) => strand === '+' ? '→ plus strand'
  : strand === '-' ? '← minus strand' : '? strand unknown';

export function createNeighbourDisclosure() {
  const details = node('details', 'method-help gene-neighbours');
  const summary = node('summary', '', 'Neighbouring genes');
  summary.dataset.detailAction = 'neighbour-summary';
  const content = node('div', 'gene-neighbours-content');
  details.append(summary, content);
  stateByDetails.set(details, { summary, content });
  return details;
}

export function updateNeighbourDisclosure(details, gene, pending, onOpenPartner) {
  const state = stateByDetails.get(details);
  state.onOpenPartner = onOpenPartner;
  const context = gene?.flankingNeighbours ?? null;
  if (state.geneId === gene?.id && state.context === context && state.pending === pending) return;
  const active = document.activeElement;
  const held = state.content.contains(active);
  const action = held ? active.dataset?.detailAction : null;
  state.geneId = gene?.id;
  state.context = context;
  state.pending = pending;
  state.content.replaceChildren();
  if (!context) {
    state.content.append(node('p', 'panel-note', pending === 'loading'
      ? 'Native neighbour context is loading.' : pending === 'failed'
        ? 'Native neighbour context failed to load.'
        : 'Native neighbour context unavailable: this payload has no complete annotation catalogue.'));
  } else {
    state.content.append(node('p', 'panel-note',
      'Native annotation outside this gene’s outer transcribed bounds, in its transcription orientation. '
      + 'Separate from OG shared bases and the adjacent-CDS gap metrics. Gaps count unoccupied bases; '
      + 'abutting genes have a 0 bp gap.'));
    const schematic = node('div', 'panel-note gene-neighbours-schematic');
    schematic.setAttribute('aria-label', '5′ upstream, focal gene in transcription direction, 3′ downstream; schematic not to scale');
    const focalLabel = node('strong', '', 'This gene →');
    focalLabel.setAttribute('aria-label', `${gene.id}, focal transcription direction`);
    focalLabel.title = gene.id;
    schematic.append(node('span', '', '5′'), focalLabel,
      node('span', '', '3′'));
    state.content.append(schematic, node('p', 'panel-note', 'Schematic not to scale; no sequence bases are inferred.'));
    for (const [key, label] of [['upstream', '5′ upstream'], ['downstream', '3′ downstream']]) {
      const flank = context[key];
      const section = node('div', 'gene-neighbours-side');
      section.append(node('p', 'gene-view-overlap-heading', label));
      if (flank.status !== 'ready') {
        section.append(node('p', 'panel-note', flank.status === 'overlap-blocked'
          ? `Overlap-blocked by ${flank.blockedBy.join(', ')}. Inspect these partners in OG; no separated immediate flank is reported.`
          : flank.status === 'unsupported-geometry' ? 'Native context unavailable: this origin join needs native transcription-order evidence.'
          : flank.status === 'unknown-strand' ? 'Transcription direction unavailable: focal strand unknown.'
            : 'No eligible annotated flank outside the outer transcribed bounds on this replicon.'));
      } else {
        const list = node('ul', 'gene-view-partners');
        for (const neighbour of flank.neighbours) {
          const noncoding = NONCODING_BIOTYPES.has(neighbour.biotype);
          const item = node('li', noncoding ? 'gene-neighbour-noncoding' : 'gene-neighbour-coding');
          const relative = neighbour.strand === '+' || neighbour.strand === '-'
            ? neighbour.strand === gene.strand ? '→ with focal transcription' : '← against focal transcription'
            : '? relative direction unknown';
          const name = neighbour.name ? ` ${neighbour.name}` : '';
          const segments = neighbour.segments.map(({ from, to }) => `${from}–${to}`).join(', ');
          item.append(node('span', 'gene-view-partner-text',
            `${neighbour.id}${name} · ${neighbour.biotype}${noncoding ? ' (noncoding gene)' : ''}${neighbour.pseudo ? ' · pseudogene' : ''} · `
            + `${strandWords(neighbour.strand)} · ${relative} · gap ${neighbour.gapNt} bp. `
            + `${neighbour.seqid}: ${segments} (1-based inclusive; ${neighbour.segmentSource} segments).`));
          if (neighbour.selectable && onOpenPartner) {
            const button = node('button', 'chip-button gene-view-open-partner', `Open ${neighbour.id}`);
            button.type = 'button';
            button.dataset.detailAction = `neighbour-open-${neighbour.id}`;
            button.addEventListener('click', () => state.onOpenPartner?.(neighbour.id, neighbour.geneIndex));
            item.append(button);
          } else if (!neighbour.selectable) {
            item.append(node('span', 'gene-view-partner-note',
              ' Annotated context, not a selectable recoding candidate.'));
          }
          list.append(item);
        }
        section.append(list);
      }
      state.content.append(section);
    }
  }
  if (held) {
    const replacement = action ? state.content.querySelector(`[data-detail-action="${action}"]`) : null;
    (replacement ?? state.summary).focus({ preventScroll: true });
  }
}
