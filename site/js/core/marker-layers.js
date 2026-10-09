/**
 * The shared representation of a positional feature the views can mark.
 *
 * DOM-free. One record shape for every admitted marker layer, so the
 * chromosome view, the two gene visualizers and the sequence close-up read the
 * same fields and cannot describe the same site differently. What a view does
 * with a record is its own; what the record *says* is here.
 *
 * Three things are kept apart on purpose, because conflating any two of them
 * would invent a coordinate or a finding:
 *
 * - **Geometry.** A feature is an explicit `point` or an explicit `interval`.
 *   An interval needs both ends; one end alone is an unmapped interval, never a
 *   point, because the missing end is not zero and not the other end.
 * - **Coordinate basis.** A native genomic coordinate (`position`, and
 *   `endPosition` for an interval) is the assembly's own and may go on a
 *   genomic axis or a sequence column. A distance published against another
 *   gene model is gene-relative evidence and places a mark on a gene-relative
 *   track only. Neither is ever re-measured into the other: the views carry
 *   both and name the gap. That is the rule
 *   `docs/validation/data-contract.md` states for positional features, and it
 *   is why a record has room for both and a preference for neither.
 * - **What was measured, and what landed.** `measurement` is whether the
 *   source measured the site or predicted it. `coordinateStatus` is whether
 *   this record carries a usable native coordinate at all. A row with no
 *   coordinate is kept and marked unmapped; it is never dropped, because a
 *   dropped row is indistinguishable from a row the study never published.
 * - **Record origin and producer.** `origin` says whether the row came from an
 *   admitted source record or was computed for this release; `producer` names
 *   the explicit producer contract. Presentation priority reads only that
 *   origin. It never guesses from a tool name, display text, or confidence.
 *
 * {@link MARKER_TYPES} is a representation vocabulary and nothing more. A type
 * having an entry here does not admit a dataset, licence a source or assert
 * that any such feature is published for any organism: an organism's record
 * declares which layers exist, and {@link availableMarkerLayers} is what
 * decides which of them a reader can be offered a control for.
 */
import { sameReplicon } from './chromosome-model.js';
import { pendingState } from './data-files.js';
import { layerOf, ORGANISMS } from './organisms.js';

/**
 * Length of the replicon a marker names, under either naming scheme.
 *
 * A source extract writes `CP006471` where the release writes `NZ_CP006471.1`
 * for the same sequence, and `repliconLength` matches an accession exactly, so
 * the lookup here is the normalised comparison the rest of this module uses.
 * Without it an interval across the circular origin could not be measured from
 * a source row at all. Null for a sequence no genome of record declares, which
 * is the one case a wrapped span cannot be measured in.
 */
function markerRepliconLength(accession) {
  for (const organism of ORGANISMS) {
    const replicon = organism.genome.replicons
      .find((entry) => sameReplicon(entry.accession, accession));
    if (replicon) return replicon.lengthBp;
  }
  return null;
}

/** The two geometries a marker can have. There is no implicit third. */
export const MARKER_GEOMETRIES = Object.freeze(['point', 'interval']);
export const MARKER_ORIGINS = Object.freeze(['source', 'computed']);

/**
 * How each feature type is represented and named.
 *
 * TSS and TIS are separate entries and must stay separate: transcription
 * initiation and translation initiation are different measurements at
 * different positions, and a single "start site" type would merge two findings
 * into one mark. `gTSS`, `aTSS`, `iTSS` and `nTSS` are the type strings the
 * admitted Tan 2018 extract publishes; the rest are the representations a
 * future admitted layer of that type would use, with no data behind them here.
 */
export const MARKER_TYPES = Object.freeze({
  gTSS: Object.freeze({
    id: 'gTSS',
    geometry: 'point',
    label: 'gene-linked transcription start site',
    shortLabel: 'start site',
    measures: 'transcription initiation',
  }),
  aTSS: Object.freeze({
    id: 'aTSS',
    geometry: 'point',
    label: 'antisense transcription start site',
    shortLabel: 'antisense start site',
    measures: 'transcription initiation',
  }),
  iTSS: Object.freeze({
    id: 'iTSS',
    geometry: 'point',
    label: 'internal transcription start site',
    shortLabel: 'internal start site',
    measures: 'transcription initiation',
  }),
  nTSS: Object.freeze({
    id: 'nTSS',
    geometry: 'point',
    label: 'orphan or novel transcription start site',
    shortLabel: 'orphan or novel start site',
    measures: 'transcription initiation',
  }),
  TSS: Object.freeze({
    id: 'TSS',
    geometry: 'point',
    label: 'transcription start site',
    shortLabel: 'start site',
    measures: 'transcription initiation',
  }),
  TIS: Object.freeze({
    id: 'TIS',
    geometry: 'point',
    label: 'translation initiation site',
    shortLabel: 'initiation site',
    measures: 'translation initiation',
  }),
  TTS: Object.freeze({
    id: 'TTS',
    geometry: 'point',
    label: 'transcription termination site',
    shortLabel: 'termination site',
    measures: 'transcription termination',
  }),
  promoter: Object.freeze({
    id: 'promoter',
    geometry: 'interval',
    label: 'promoter',
    shortLabel: 'promoter',
    measures: 'promoter extent',
  }),
  rbs: Object.freeze({
    id: 'rbs',
    geometry: 'interval',
    label: 'ribosome binding site',
    shortLabel: 'ribosome binding site',
    measures: 'ribosome binding',
  }),
  bindingSite: Object.freeze({
    id: 'bindingSite',
    geometry: 'interval',
    label: 'transcription-factor binding site',
    shortLabel: 'binding site',
    measures: 'factor binding',
  }),
});

/** The type with this id, or null for a type this representation does not know. */
export function markerTypeOf(id) {
  return typeof id === 'string' && Object.hasOwn(MARKER_TYPES, id) ? MARKER_TYPES[id] : null;
}

/**
 * The places a marker layer can be shown, each with its own visibility.
 *
 * Four separate views rather than one global selection: the chromosome axis,
 * the gene visualizer in the controls column, the gene visualizer in the gene
 * detail column, and the sequence close-up. They answer different questions at
 * different scales, so a reader putting marks away in one is not asking for
 * them to go everywhere. A shared representation is not a shared choice.
 */
export const MARKER_VIEWS = Object.freeze([
  Object.freeze({ id: 'chromosome', label: 'the chromosome view' }),
  Object.freeze({ id: 'gene-controls', label: 'the controls-column gene visualizer' }),
  Object.freeze({ id: 'gene-detail', label: 'the gene-detail gene visualizer' }),
  Object.freeze({ id: 'sequence', label: 'the sequence close-up' }),
]);

/** The view ids, in the order a link writes them. */
export const MARKER_VIEW_IDS = Object.freeze(MARKER_VIEWS.map((view) => view.id));

/**
 * Every marker layer this representation can carry, in the order a link writes
 * them, each tied to the data-file key that would supply it.
 *
 * An entry says how a layer's rows are represented, not that any organism
 * publishes it. `types` is what its rows may be; `measurement` is what its
 * rows are when a row does not say for itself.
 */
const MARKER_LAYER_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'tss',
    key: 'tssEvidence',
    types: Object.freeze(['gTSS']),
    measurement: 'measured',
    origin: 'source',
    producer: 'Tan 2018 Table S1',
  }),
]);

/** The layer ids, in the order a link writes them. */
export const MARKER_LAYER_IDS = Object.freeze(MARKER_LAYER_REGISTRY.map((layer) => layer.id));

/** The registry entry for a data-file key, or null. */
export function markerLayerForKey(key) {
  return MARKER_LAYER_REGISTRY.find((layer) => layer.key === key) ?? null;
}

/**
 * The marker layers one organism publishes, in registry order.
 *
 * A layer exists for an organism only when its record declares the data file,
 * so an organism with no such study is never offered a control for it and is
 * never told that no feature of that type is there: nothing was looked for.
 * The study's own labels come from that record, so one name is used wherever
 * the layer is mentioned.
 */
export function markerLayersOf(organism) {
  return MARKER_LAYER_REGISTRY.flatMap((layer) => {
    const declared = layerOf(organism, layer.key);
    if (!declared) return [];
    return [Object.freeze({
      id: layer.id,
      key: layer.key,
      types: layer.types,
      measurement: layer.measurement,
      origin: layer.origin,
      producer: layer.producer,
      label: declared.label,
      fileLabel: declared.fileLabel,
      citation: declared.citation,
    })];
  });
}

/**
 * The declared layers whose file has landed with at least one row to govern.
 *
 * This is the one test for offering a reader a control. A declared layer whose
 * file is still in flight, or failed, or landed with nothing for this gene has
 * no mark to show or hide, and a control for it would read as a promise that
 * evidence could be shown.
 *
 * @param {object} organism the organism on screen.
 * @param {object} dataset the loaded dataset, for the file's load state.
 * @param {(layer: object) => boolean} [hasRows] whether the layer has a row in
 *   the scope the caller is drawing; defaults to asking nothing further.
 */
export function availableMarkerLayers(organism, dataset, hasRows = () => true) {
  return markerLayersOf(organism)
    .filter((layer) => pendingState(dataset, layer.key) === null && hasRows(layer));
}

/**
 * One source row as a shared marker record.
 *
 * Every field is the row's own. A field the row does not carry is null and
 * says so downstream; none is filled in from a neighbour, from the layer's
 * other rows or from a default coordinate.
 *
 * `layerId` is the source's identity here; what to *call* that source is
 * organism copy, which {@link markerLayersOf} resolves for the views that
 * print it. Keeping the name out of the record is what stops two views from
 * naming one study differently.
 *
 * @param {object} row a source row in its layer's own schema.
 * @param {object} layer a registry entry, from {@link markerLayerForKey} or
 *   {@link markerLayersOf}.
 */
export function markerOf(row, layer) {
  const type = markerTypeOf(row?.type);
  const position = Number.isFinite(row?.position) ? row.position : null;
  const endPosition = Number.isFinite(row?.endPosition) ? row.endPosition : null;
  // An explicit type decides the geometry. Without one, a row carrying both
  // ends is an interval and a row carrying one is a point: that is what the
  // row says, and it is the only reading that invents no second coordinate.
  const geometry = type?.geometry ?? (endPosition === null ? 'point' : 'interval');
  const complete = geometry === 'interval'
    ? position !== null && endPosition !== null
    : position !== null;
  const readCount = Object.values(row?.rawReads ?? {})
    .flat()
    .filter((value) => Number.isFinite(value)).length;
  return {
    id: row?.id ?? null,
    layerId: layer?.id ?? null,
    typeId: type?.id ?? (typeof row?.type === 'string' && row.type !== '' ? row.type : null),
    typeLabel: type?.label ?? null,
    geometry,
    strand: row?.strand === '+' || row?.strand === '-' ? row.strand : null,
    replicon: typeof row?.replicon === 'string' && row.replicon !== '' ? row.replicon : null,
    position,
    // Only an interval has a second end. A point carrying one would describe a
    // span its source never published.
    endPosition: geometry === 'interval' ? endPosition : null,
    // A row's own `measurement` wins; otherwise the layer's, which is what its
    // rows are. Null means the row and its layer both leave it unrecorded, and
    // is never read as either answer.
    measurement: row?.measurement === 'measured' || row?.measurement === 'predicted'
      ? row.measurement : layer?.measurement ?? null,
    origin: MARKER_ORIGINS.includes(row?.origin) ? row.origin : layer?.origin ?? null,
    producer: typeof row?.producer === 'string' && row.producer !== ''
      ? row.producer : layer?.producer ?? null,
    readCount,
    coordinateStatus: complete ? 'mapped' : 'unmapped',
  };
}

/**
 * The styling class and paint priority an explicit record origin requests.
 * Computed rows are supplementary: translucent and painted first so a source
 * record wins an overlap without hiding the computed row from focus or lists.
 */
export function markerPresentation(marker) {
  const supplementary = marker?.origin === 'computed';
  return Object.freeze({
    id: supplementary ? 'supplementary' : 'primary',
    priority: supplementary ? 0 : 1,
    opacity: supplementary ? 0.62 : 1,
  });
}

/** Stable lower-priority-first order for SVG paint stacking. */
export function markerPaintOrder(markers) {
  return [...markers].sort((a, b) => (
    markerPresentation(a).priority - markerPresentation(b).priority
  ));
}

/**
 * How many native bases a marker covers, or null when it has no complete
 * native coordinate. A point covers exactly one base.
 */
export function markerSpanNt(marker, lengthBp = markerRepliconLength(marker?.replicon)) {
  if (!marker || marker.coordinateStatus !== 'mapped') return null;
  if (marker.geometry !== 'interval') return 1;
  const { position, endPosition } = marker;
  if (endPosition >= position) return endPosition - position + 1;
  // An interval whose end precedes its start runs across the circular origin,
  // which every replicon here has. Without a known length it cannot be
  // measured, and guessing one would publish a span nothing reported.
  if (!(lengthBp > 0)) return null;
  return lengthBp - position + endPosition + 1;
}

/**
 * Whether a marker covers one native genomic position on its own replicon.
 *
 * The membership test every placement reads, so a point, an interval and an
 * interval that wraps the origin are decided in one place. A position on
 * another replicon is never covered, whatever its number.
 */
export function markerCoversPosition(marker, position,
  lengthBp = markerRepliconLength(marker?.replicon)) {
  if (!marker || marker.coordinateStatus !== 'mapped' || !Number.isFinite(position)) return false;
  if (marker.geometry !== 'interval') return marker.position === position;
  const { position: from, endPosition: to } = marker;
  if (to >= from) return position >= from && position <= to;
  if (!(lengthBp > 0)) return false;
  return position >= from || position <= to;
}

/** Whether a marker was measured on the replicon an accession names. */
export function markerOnReplicon(marker, accession) {
  return marker?.coordinateStatus === 'mapped' && sameReplicon(marker.replicon, accession);
}

/** The key a visibility choice is recorded under: one layer in one view. */
export function markerKey(layerId, viewId) {
  return `${layerId}.${viewId}`;
}

/** Every key, in the canonical order a link writes them. */
export function markerKeys() {
  return MARKER_LAYER_IDS.flatMap((layerId) => MARKER_VIEW_IDS.map((viewId) => markerKey(layerId, viewId)));
}

/**
 * The hidden set in canonical order, with unknown and repeated keys dropped.
 *
 * Canonical because the set is written into a shared link: two readers who
 * hid the same marks in the same views must produce the same link, whichever
 * order they clicked in.
 */
export function normalizeHiddenMarkers(values) {
  const asked = new Set(Array.isArray(values) ? values : []);
  return markerKeys().filter((key) => asked.has(key));
}

/**
 * Whether one layer's marks are drawn in one view. Absent from the hidden set
 * means visible, which is what a fresh view and a link with no field show.
 */
export function markerVisible(hidden, layerId, viewId) {
  const key = markerKey(layerId, viewId);
  return !(Array.isArray(hidden) && hidden.includes(key));
}

/**
 * The hidden set with one layer's marks shown or hidden in one view.
 * Returns a new array; the caller's own is never mutated.
 */
export function withMarkerVisible(hidden, layerId, viewId, visible) {
  const key = markerKey(layerId, viewId);
  const current = normalizeHiddenMarkers(hidden);
  if (visible) return current.filter((entry) => entry !== key);
  if (current.includes(key)) return current;
  return normalizeHiddenMarkers([...current, key]);
}

/** Whether every mark is visible everywhere, which is the fresh view. */
export function isDefaultMarkerVisibility(hidden) {
  return normalizeHiddenMarkers(hidden).length === 0;
}
