/**
 * An opened non-CDS annotation record: what the release says about one
 * noncoding gene or pseudogene, and nothing it does not say.
 *
 * Read-only by design (owner decision D10, 2026-10-14). No pin, no shortlist,
 * no codon, protein or recoding metric. Overlap partners and flanking genes are
 * the existing native context; a partner or flank that is a plotted CDS can be
 * opened as that CDS.
 */
import { biotypeLabel, EXCLUSION_REASONS, isUnplottedCoding } from '../core/annotation-records.js';
import { createNeighbourDisclosure, updateNeighbourDisclosure } from './gene-neighbours.js';
import { formatCount } from './format.js';

const node = (tag, className, text = '') => {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text) result.textContent = text;
  return result;
};

const strandWords = (strand) => (strand === '+' ? 'plus' : strand === '-' ? 'minus' : 'unknown');

/** The record's facts as label/value pairs, assembled without the DOM. */
export function annotationRecordFacts(record) {
  const segments = record.segments.map(({ from, to }) => `${from.toLocaleString('en-US')}–${to.toLocaleString('en-US')}`);
  return [
    ['Gene type', biotypeLabel(record)],
    ['Pseudogene', record.pseudo || record.biotype === 'pseudogene' ? 'yes' : 'no'],
    ['Replicon', record.seqid],
    ['Strand', strandWords(record.strand)],
    [record.segments.length === 1 ? 'Segment' : 'Segments',
      `${segments.join(', ')} (1-based inclusive, from ${record.segmentSource} features)`],
  ];
}

/**
 * @param {object} record a catalogue record that is not a plotted CDS.
 * @param {{index: object|null, onOpenPartner?: (id: string, geneIndex: number) => void,
 *   onShowTrna?: (id: string) => void}} options `index` is the loaded overlap index.
 */
export function annotationRecordLead(record, exclusion = null) {
  if (isUnplottedCoding(record)) {
    const why = EXCLUSION_REASONS[exclusion?.reason] ?? (exclusion?.reason
      ? `the pipeline excluded it (${exclusion.reason})` : 'it is not in the plotted CDS set');
    return `Annotated protein-coding gene that this map does not plot, because ${why}. As a record outside `
      + 'the plotted set, no codon, protein or recoding metric is shown, and it cannot be pinned, '
      + 'shortlisted or filtered.';
  }
  return 'Annotation record, not a CDS: no codon, protein or recoding metric applies, and it cannot be '
    + 'pinned, shortlisted or filtered.';
}

/**
 * @param {object} record
 * @param {{index?: object|null, exclusion?: object|null, trnaState?: string,
 *   onOpenPartner?: Function|null, onShowTrna?: Function|null}} options
 *   `exclusion` is the pipeline's `excluded.json` row for the record, when it has one.
 */
export function renderAnnotationRecord(record, {
  index = null, exclusion = null, trnaState = 'ready', onOpenPartner = null, onShowTrna = null,
} = {}) {
  const card = node('div', 'annotation-record');
  card.id = `annotation-record-${record.id}`;
  card.dataset.recordId = record.id;
  card.append(node('p', 'panel-note', annotationRecordLead(record, exclusion)));
  const facts = node('dl', 'annotation-record-facts');
  for (const [label, value] of annotationRecordFacts(record)) {
    facts.append(node('dt', '', label), node('dd', '', value));
  }
  card.append(facts);

  if (record.biotype === 'tRNA' && onShowTrna && trnaState !== 'absent') {
    const trna = node('button', 'chip-button', 'Show in the tRNA browser');
    trna.type = 'button';
    trna.dataset.geneId = record.id;
    trna.dataset.searchAction = 'show-trna';
    // Only a loaded list can select the locus; a list in flight or failed says so.
    trna.disabled = trnaState !== 'ready';
    trna.addEventListener('click', () => onShowTrna(record.id));
    card.append(trna);
    if (trnaState !== 'ready') {
      card.append(node('p', 'panel-note', trnaState === 'failed'
        ? 'The tRNA browser list could not be loaded; retry it from the tRNA tab.'
        : 'The tRNA browser list is still loading.'));
    }
  }

  // Shared bases with other annotated genes, as the overlap layer records them.
  const partners = index?.partnersById?.get(record.id) ?? [];
  const overlap = node('div', 'annotation-record-overlaps');
  overlap.append(node('p', 'gene-view-overlap-heading',
    partners.length ? `Shares bases with ${formatCount(partners.length)} annotated `
      + `${partners.length === 1 ? 'gene' : 'genes'}` : 'Shares no base with another annotated gene'));
  if (partners.length) {
    const list = node('ul', 'gene-view-partners');
    for (const partner of partners) {
      const item = node('li', '');
      item.append(node('span', 'gene-view-partner-text',
        `${partner.id}${partner.name ? ` ${partner.name}` : ''} · ${biotypeLabel(partner)} · `
        + `${formatCount(partner.sharedBases)} shared bp.`));
      if (partner.selectable && onOpenPartner) {
        const open = node('button', 'chip-button gene-view-open-partner', `Open ${partner.id}`);
        open.type = 'button';
        open.dataset.geneId = record.id;
        open.dataset.searchAction = `open-partner-${partner.id}`;
        open.addEventListener('click', () => onOpenPartner(partner.id, partner.geneIndex));
        item.append(open);
      }
      list.append(item);
    }
    overlap.append(list);
  }
  card.append(overlap);

  // The same flanking-gene disclosure the gene viewers use, for this record.
  const neighbours = createNeighbourDisclosure();
  updateNeighbourDisclosure(neighbours,
    { id: record.id, strand: record.strand, flankingNeighbours: index?.neighbours?.get(record.id) ?? null },
    null, onOpenPartner);
  card.append(neighbours);
  return card;
}
