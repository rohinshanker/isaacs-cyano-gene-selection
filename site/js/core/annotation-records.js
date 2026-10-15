/**
 * Annotated genes that are not CDSs, and what a CDS's annotation says about its function.
 *
 * Owner decision D10, 2026-10-14. Noncoding genes and pseudogenes are found and
 * opened as annotation records only. They never join the CDS population, so no
 * codon, protein or recoding metric, filter, shortlist entry or projection can
 * reach them. Hypothetical proteins stay in the CDS population: they are
 * predicted protein-coding genes whose function is unknown, never noncoding.
 */
import { pendingState } from './data-files.js';

/** Reader-facing names for the biotypes the pinned catalogues use. */
export const BIOTYPE_LABELS = Object.freeze({
  tRNA: 'tRNA gene',
  rRNA: 'rRNA gene',
  tmRNA: 'tmRNA gene',
  ncRNA: 'noncoding RNA gene',
  SRP_RNA: 'SRP RNA gene',
  RNase_P_RNA: 'RNase P RNA gene',
  antisense_RNA: 'antisense RNA gene',
  pseudogene: 'pseudogene',
  protein_coding: 'protein-coding gene',
});

const NONCODING = new Set(['tRNA', 'rRNA', 'tmRNA', 'ncRNA', 'SRP_RNA', 'RNase_P_RNA', 'antisense_RNA']);

/** A record's kind in words, saying pseudogene whenever the flag is set. */
export function biotypeLabel(record) {
  const base = BIOTYPE_LABELS[record?.biotype] ?? `${record?.biotype ?? 'unrecorded'} gene`;
  return record?.pseudo && record.biotype !== 'pseudogene' ? `${base}, pseudogene` : base;
}

/** Whether a biotype is a noncoding RNA gene. */
export function isNoncodingBiotype(biotype) {
  return NONCODING.has(biotype);
}

/**
 * The non-CDS records of the loaded catalogue and whether they can be searched.
 *
 * `selectable` marks a catalogue record that is one of the plotted CDSs; every
 * other record is offered here. Loading, failed and unavailable are distinct,
 * so search can say why such records cannot match.
 *
 * @returns {{status: 'ready'|'loading'|'failed'|'unavailable', records: object[]}}
 */
export function annotationRecordsOf(dataset) {
  const pending = pendingState(dataset, 'geneOverlaps');
  if (pending === 'loading' || pending === 'failed') return { status: pending, records: [] };
  const catalogue = dataset?.geneOverlaps?.catalogue;
  if (!catalogue) return { status: 'unavailable', records: [] };
  return { status: 'ready', records: catalogue.filter((record) => !record.selectable) };
}

const normalize = (text) => String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const words = (text) => normalize(text).match(/[\p{L}\p{N}_]+/gu) ?? [];

const TIER = { idExact: 0, nameExact: 1, idPartial: 2, name: 3, kind: 4 };
const FIELD = ['locus tag', 'gene name', 'locus tag', 'gene name', 'gene type'];

/** The words a record's kind can be found by: its biotype, its label, and "noncoding" or "pseudogene". */
function kindWords(record) {
  const terms = new Set([...words(record.biotype), ...words(biotypeLabel(record))]);
  if (isNoncodingBiotype(record.biotype)) { terms.add('noncoding'); terms.add('rna'); }
  if (record.pseudo || record.biotype === 'pseudogene') terms.add('pseudogene');
  return terms;
}

function scoreRecord(record, query) {
  const id = normalize(record.id);
  const name = normalize(record.name);
  if (id === query) return TIER.idExact;
  if (name && name === query) return TIER.nameExact;
  if (id.includes(query)) return TIER.idPartial;
  const needed = words(query);
  if (name && needed.every((word) => words(name).includes(word))) return TIER.name;
  const kinds = kindWords(record);
  if (needed.length && needed.every((word) => kinds.has(word))) return TIER.kind;
  return null;
}

/**
 * Search the non-CDS records by locus tag, gene name, or kind ("tRNA",
 * "pseudogene", "noncoding"). Ranked like the CDS search: exact identifier,
 * exact name, partial identifier, name words, then kind; ties by locus tag.
 *
 * @returns {{total: number, shown: Array<{record: object, matchedOn: string}>, hiddenCount: number}}
 */
export function searchAnnotationRecords(records, query, { limit = 12 } = {}) {
  const normalized = normalize(query);
  if (!normalized) return { total: 0, shown: [], hiddenCount: 0 };
  const hits = [];
  for (const record of records) {
    const tier = scoreRecord(record, normalized);
    if (tier !== null) hits.push({ record, tier, matchedOn: FIELD[tier] });
  }
  hits.sort((a, b) => a.tier - b.tier || a.record.id.localeCompare(b.record.id));
  return { total: hits.length, shown: hits.slice(0, limit), hiddenCount: Math.max(0, hits.length - limit) };
}

/**
 * Product names that state, by annotation convention, that a protein's function
 * is unknown: NCBI's "hypothetical protein", UniProt-style "uncharacterized
 * protein" with or without "putative" and a symbol, and the Syn57 design's own
 * "uncharacterized design CDS". Exact forms only; any other wording is left as
 * annotated rather than guessed at.
 */
const UNKNOWN_FUNCTION = [
  /^hypothetical protein$/,
  /^(putative )?uncharacterized protein( [a-z0-9_.-]+)?$/,
  /^uncharacterized design cds$/,
];

/** True when a CDS's product says its function is unknown. */
export function hasUnknownFunction(gene) {
  const product = normalize(gene?.product);
  return Boolean(product) && UNKNOWN_FUNCTION.some((pattern) => pattern.test(product));
}

export const UNKNOWN_FUNCTION_NOTE = 'Predicted protein-coding gene of unknown function; not a noncoding gene.';

/** The note to show beside a CDS's product, or null when the annotation names a function. */
export function functionStatusNote(gene) {
  return hasUnknownFunction(gene) ? UNKNOWN_FUNCTION_NOTE : null;
}
