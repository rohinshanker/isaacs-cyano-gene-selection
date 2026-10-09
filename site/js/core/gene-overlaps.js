/**
 * The overlapping-gene (OG) relation: one overlap graph, read by every view.
 *
 * DOM-free. The pipeline publishes `gene_overlaps.json` per organism from that
 * organism's pinned annotation; this module validates it, re-derives every
 * shared interval from the two features' own segments, and indexes the result
 * **once**, at the moment the file is joined. Nothing here runs again on a
 * pointer move, a redraw, a zoom, or a filter change: a view asks the index.
 *
 * The definition is owner decision Q1/Q2 of 2026-10-09 and lives in exactly one
 * place, the payload's own `definition` block, which {@link describeOverlapRule}
 * reads so the sentence a reader sees cannot drift from the rule the data was
 * built under:
 *
 * - every annotated **gene** of the release counts, tRNA, rRNA and other
 *   non-coding and pseudogene rows included — not only the protein-coding loci
 *   `genes.json` holds. The release's own gene rows include computationally
 *   annotated ones; what this layer adds is no scan of its own;
 * - a gene occupies its **annotated segments**, never its start-to-end
 *   envelope, so the gap inside a joined CDS is unoccupied and an
 *   origin-crossing feature is its two real pieces;
 * - two genes overlap when they share **at least one genomic base on the same
 *   replicon**, on either strand. A one-base overlap counts, abutting ends do
 *   not, and no coordinate is ever compared across replicons or organisms.
 *
 * `genes.json`'s own `overlapsNeighbor` is a different quantity and keeps its
 * own meaning: the adjacent-CDS envelope flag that goes with
 * `neighborUpstreamNt`/`neighborDownstreamNt`. It is not the OG relation, it
 * cannot see a non-adjacent or non-coding partner, and consumers prefer this
 * index wherever it is joined. See docs/validation/gene-overlaps.md.
 *
 * A gene with no entry here has no partner *under this definition*, which is a
 * measured absence — and it is one only because the payload names every gene
 * it compared in `coveredGenes`, which the validator checks every plotted CDS
 * against. A gene whose file has not landed has no entry either, and the two
 * are never confused: absence of the whole index is the
 * {@link OVERLAP_UNAVAILABLE} state, which every surface states in words, and
 * no other field is allowed to stand in for it.
 */
import { sameReplicon } from './chromosome-model.js';

/** The payload version this reader accepts. */
export const GENE_OVERLAPS_DATASET_VERSION = 'gene-overlaps-v1';

/** The `Colour by` key of the OG colour channel, the way `functionCategory` is. */
export const OVERLAP_COLOR_KEY = 'overlapClass';

/**
 * The OG classes, in legend order: the colour vocabulary, the filter's
 * vocabulary, and the only buckets a gene can fall in.
 *
 * Mutually exclusive and exhaustive over genes whose overlap context is known.
 * What they separate is the strand relation, which is a property of the
 * annotation's geometry; this module makes no claim about what an overlap
 * means for a recoding decision. Containment is carried per partner rather
 * than as a class of its own, since a gene can contain one partner and be
 * contained by another.
 */
export const OVERLAP_CLASSES = Object.freeze([
  Object.freeze({
    id: 'no-overlap',
    label: 'No overlapping gene',
    note: 'Shares no base with any other annotated gene on its replicon.',
  }),
  Object.freeze({
    id: 'overlap-same-strand',
    label: 'Overlaps on the same strand',
    note: 'Every partner whose strand the release records is on this gene\u2019s strand.',
  }),
  Object.freeze({
    id: 'overlap-opposite-strand',
    label: 'Overlaps on the opposite strand',
    note: 'Every partner whose strand the release records is on the other strand.',
  }),
  Object.freeze({
    id: 'overlap-both-strands',
    label: 'Overlaps on both strands',
    note: 'Partners on this gene\u2019s strand and on the other, so both relations hold.',
  }),
  Object.freeze({
    id: 'overlap-strand-unrecorded',
    label: 'Overlaps a gene of unrecorded strand',
    note: 'It overlaps, and the release records a strand for none of its partners, so no '
      + 'relation can be stated. Saying "both strands" here would invent a transcription '
      + 'direction nobody annotated.',
  }),
]);

/** The class ids a legend row or a URL filter can name. */
export const OVERLAP_CLASS_IDS = Object.freeze(OVERLAP_CLASSES.map((entry) => entry.id));

/** The bucket index of the class every gene takes while nothing is known. */
export const OVERLAP_UNAVAILABLE = Object.freeze({
  id: 'overlap-unavailable',
  label: 'Overlap context not loaded',
  note: 'The overlapping-gene layer has not been read, so no gene is known to '
    + 'overlap or not to overlap. This is not an absence of overlaps.',
});

/** The three states the OG filter can be in; `any` hides nothing. */
export const OVERLAP_FILTERS = Object.freeze(['any', 'only', 'none']);

/** The reader-facing name of each OG filter state. */
export const OVERLAP_FILTER_LABELS = Object.freeze({
  any: 'Show all genes',
  only: 'Only overlapping genes',
  none: 'Only non-overlapping genes',
});

/** What the OG abbreviation stands for, wherever the tag is shown. */
export const OVERLAP_TAG_LABEL = 'OG';
export const OVERLAP_TAG_EXPANSION = 'overlapping genes';

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function fail(message) {
  throw new Error(`gene_overlaps.json ${message}`);
}

/** `[from, to]` pairs as objects, after checking each one lies on its replicon. */
function readSegments(raw, lengthBp, label) {
  if (!Array.isArray(raw) || raw.length === 0) fail(`has no segments for ${label}`);
  const segments = raw.map((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) fail(`has a malformed segment for ${label}`);
    const [from, to] = pair;
    if (!isPositiveInteger(from) || !isPositiveInteger(to) || to < from) {
      fail(`has an invalid segment for ${label}`);
    }
    if (to > lengthBp) fail(`places ${label} past the end of its replicon`);
    return { from, to };
  });
  for (let i = 1; i < segments.length; i += 1) {
    // Canonical and minimal: ascending, and never touching, because the
    // producer merges anything that does. Two segments that abut describe one
    // continuous stretch, and a reader shown them as two would read a break
    // the annotation does not report.
    if (segments[i].from <= segments[i - 1].to + 1) {
      fail(`has segments for ${label} that are not in canonical order`);
    }
  }
  return segments;
}

/** Every base two canonical segment lists share, in coordinate order. */
export function sharedSegments(left, right) {
  const shared = [];
  for (const a of left) {
    for (const b of right) {
      const from = Math.max(a.from, b.from);
      const to = Math.min(a.to, b.to);
      if (from <= to) shared.push({ from, to });
    }
  }
  shared.sort((a, b) => a.from - b.from || a.to - b.to);
  const merged = [];
  for (const piece of shared) {
    const last = merged[merged.length - 1];
    if (last && piece.from <= last.to + 1) last.to = Math.max(last.to, piece.to);
    else merged.push({ ...piece });
  }
  return merged;
}

/** Bases a canonical segment list occupies. */
export function coveredBases(segments) {
  return segments.reduce((total, piece) => total + (piece.to - piece.from + 1), 0);
}

/**
 * Whether one gene's bases are a subset of the other's, which is the fact a
 * reader needs for a gene drawn entirely inside its partner.
 *
 * `equal` is kept apart from `contains`: two genes annotated over exactly the
 * same bases are a different situation from one inside a longer one, and
 * calling it containment would name a direction the annotation does not have.
 */
export function containmentOf(own, partner) {
  const shared = coveredBases(sharedSegments(own, partner));
  const ownBases = coveredBases(own);
  const partnerBases = coveredBases(partner);
  if (shared === ownBases && shared === partnerBases) return 'equal';
  if (shared === partnerBases) return 'contains';
  if (shared === ownBases) return 'containedBy';
  return 'partial';
}

/** How two strands relate, or `unknown` where the release reports none. */
export function strandRelation(own, partner) {
  if (own !== '+' && own !== '-') return 'unknown';
  if (partner !== '+' && partner !== '-') return 'unknown';
  return own === partner ? 'same' : 'opposite';
}

/**
 * The OG class a set of partners puts a gene in.
 *
 * The recorded relations decide it. A partner whose strand the release does
 * not record adds no relation — it cannot, since there is none to read — so a
 * gene with one recorded partner and one unrecorded one is classed by the
 * recorded one, and only a gene whose partners are *all* unrecorded falls in
 * the class that says so.
 */
export function classOfPartners(partners) {
  if (!Array.isArray(partners) || partners.length === 0) return 'no-overlap';
  let same = false;
  let opposite = false;
  for (const partner of partners) {
    if (partner.relation === 'same') same = true;
    else if (partner.relation === 'opposite') opposite = true;
  }
  if (same && opposite) return 'overlap-both-strands';
  if (opposite) return 'overlap-opposite-strand';
  if (same) return 'overlap-same-strand';
  return 'overlap-strand-unrecorded';
}

/** The bucket index of a class id, or -1. */
export function overlapBucketOf(classId) {
  return OVERLAP_CLASS_IDS.indexOf(classId);
}

/**
 * Validate one organism's overlap layer and index it.
 *
 * Every relationship is re-derived here rather than trusted: the shared
 * intervals are recomputed from the two features' segments and compared base
 * for base, the coverage block is reconciled against the listed features and
 * pairs, and every listed gene that is also a plotted CDS is checked against
 * that gene's own `cdsSegments`, strand and replicon in `genes.json`. A layer
 * built from another release, hand-edited, or joined one row off cannot load.
 *
 * @param {object} payload the parsed file.
 * @param {object[]} genes `dataset.genes`, for the plotted-CDS join.
 * @param {{genome: {accession: string, replicons: object[]}}} organism the registry record.
 * @returns {object} the index every view reads.
 */
export function validateGeneOverlaps(payload, genes, organism) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('is not an object');
  }
  if (payload.schemaVersion !== 1) fail('has an unknown schemaVersion');
  if (payload.datasetVersion !== GENE_OVERLAPS_DATASET_VERSION) {
    fail(`is not ${GENE_OVERLAPS_DATASET_VERSION}`);
  }
  if (payload.origin !== 'computed' || typeof payload.producer !== 'string'
    || payload.producer.length === 0) {
    fail('must name its computed origin and producer');
  }
  const definition = payload.definition;
  if (!definition || typeof definition !== 'object'
    || !['features', 'extent', 'overlap', 'excluded']
      .every((key) => typeof definition[key] === 'string' && definition[key].length > 0)) {
    fail('must state the definition it was built under');
  }
  const declared = organism?.genome;
  if (payload.release?.accession !== declared?.accession) {
    fail(`declares assembly ${payload.release?.accession ?? 'none'}, not `
      + `${declared?.accession ?? 'the organism’s genome of record'}`);
  }
  if (typeof payload.release?.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(payload.release.sha256)
    || typeof payload.release?.gff !== 'string' || payload.release.gff.length === 0) {
    fail('must name the annotation file it was built from and its digest');
  }

  const replicons = payload.replicons;
  if (!Array.isArray(replicons) || replicons.length !== (declared?.replicons?.length ?? 0)) {
    fail('does not describe this organism’s replicons');
  }
  const lengthByAccession = new Map();
  for (const replicon of replicons) {
    const match = declared.replicons
      .find((entry) => sameReplicon(entry.accession, replicon?.accession));
    if (!match || match.lengthBp !== replicon.lengthBp) {
      fail(`describes ${replicon?.accession ?? 'an unnamed replicon'} with a length this `
        + 'organism’s genome of record does not report');
    }
    lengthByAccession.set(replicon.accession, replicon.lengthBp);
  }

  const rawFeatures = payload.features;
  if (!Array.isArray(rawFeatures)) fail('has no features array');
  const geneIndexById = new Map();
  for (let index = 0; index < (genes?.length ?? 0); index += 1) {
    geneIndexById.set(genes[index].id, index);
  }
  const seen = new Set();
  const features = rawFeatures.map((feature, position) => {
    const id = feature?.id;
    if (typeof id !== 'string' || id.length === 0) fail(`has an unnamed feature at ${position}`);
    if (seen.has(id)) fail(`lists ${id} more than once`);
    seen.add(id);
    const lengthBp = lengthByAccession.get(feature.seqid);
    if (lengthBp === undefined) fail(`places ${id} on ${feature.seqid}, which is not a replicon`);
    if (typeof feature.biotype !== 'string' || feature.biotype.length === 0) {
      fail(`gives ${id} no biotype`);
    }
    if (feature.strand !== '+' && feature.strand !== '-' && feature.strand !== null) {
      fail(`gives ${id} an unreadable strand`);
    }
    if (feature.segmentSource !== 'child' && feature.segmentSource !== 'gene') {
      fail(`does not say where ${id}'s segments came from`);
    }
    if (typeof feature.pseudo !== 'boolean') fail(`does not say whether ${id} is a pseudogene`);
    const segments = readSegments(feature.segments, lengthBp, id);
    const geneIndex = geneIndexById.get(id);
    if (geneIndex !== undefined) {
      const gene = genes[geneIndex];
      const own = Array.isArray(gene.cdsSegments) && gene.cdsSegments.length > 0
        ? [...gene.cdsSegments].map(([from, to]) => ({ from, to })).sort((a, b) => a.from - b.from)
        : [{ from: gene.start, to: gene.end }];
      if (!sameReplicon(gene.seqid, feature.seqid) || gene.strand !== feature.strand
        || own.length !== segments.length
        || own.some((piece, i) => piece.from !== segments[i].from || piece.to !== segments[i].to)) {
        fail(`disagrees with genes.json about ${id}`);
      }
    }
    return Object.freeze({
      id,
      name: feature.name ?? null,
      biotype: feature.biotype,
      seqid: feature.seqid,
      strand: feature.strand,
      segments: Object.freeze(segments.map((piece) => Object.freeze(piece))),
      segmentSource: feature.segmentSource,
      pseudo: feature.pseudo,
      selectable: geneIndex !== undefined,
      geneIndex: geneIndex === undefined ? -1 : geneIndex,
    });
  });

  const rawPairs = payload.pairs;
  if (!Array.isArray(rawPairs)) fail('has no pairs array');
  const partnersById = new Map(features.map((feature) => [feature.id, []]));
  const intervalsByReplicon = new Map(
    [...lengthByAccession.keys()].map((accession) => [accession, []]),
  );
  let pairwiseSharedBases = 0;
  let previous = null;
  for (const pair of rawPairs) {
    if (!Array.isArray(pair) || pair.length !== 3) fail('has a malformed pair');
    const [first, second, pieces] = pair;
    if (!Number.isInteger(first) || !Number.isInteger(second)
      || first < 0 || second >= features.length || first >= second) {
      fail('has a pair that does not name two distinct features in order');
    }
    if (previous !== null && (first < previous[0]
      || (first === previous[0] && second <= previous[1]))) {
      fail('has pairs that are not in ascending order');
    }
    previous = [first, second];
    const left = features[first];
    const right = features[second];
    if (!sameReplicon(left.seqid, right.seqid)) {
      fail(`pairs ${left.id} and ${right.id} across two replicons`);
    }
    const recomputed = sharedSegments(left.segments, right.segments);
    if (recomputed.length === 0) fail(`pairs ${left.id} and ${right.id}, which share no base`);
    const given = readSegments(pieces, lengthByAccession.get(left.seqid),
      `the overlap of ${left.id} and ${right.id}`);
    if (given.length !== recomputed.length
      || given.some((piece, i) => piece.from !== recomputed[i].from
        || piece.to !== recomputed[i].to)) {
      fail(`reports bases for ${left.id} and ${right.id} that their segments do not share`);
    }
    const bases = coveredBases(recomputed);
    pairwiseSharedBases += bases;
    const relation = strandRelation(left.strand, right.strand);
    partnersById.get(left.id).push(Object.freeze({
      ...right,
      sharedIntervals: Object.freeze(recomputed.map((piece) => Object.freeze({ ...piece }))),
      sharedBases: bases,
      relation,
      containment: containmentOf(left.segments, right.segments),
    }));
    partnersById.get(right.id).push(Object.freeze({
      ...left,
      sharedIntervals: Object.freeze(recomputed.map((piece) => Object.freeze({ ...piece }))),
      sharedBases: bases,
      relation,
      containment: containmentOf(right.segments, left.segments),
    }));
    for (const piece of recomputed) {
      intervalsByReplicon.get(left.seqid).push(Object.freeze({
        // The pair, not the interval, is what a mark is. Two different pairs
        // can share exactly the same bases — MG1655's b4793/b4647 and
        // b4793/b4455 both cover 3,720,448–3,720,471 — so a coordinate alone
        // cannot tell one mark from another, and anything that identified a
        // mark by coordinates would reach the first and never the rest.
        key: `${left.seqid}#${left.id}#${right.id}#${piece.from}-${piece.to}`,
        from: piece.from,
        to: piece.to,
        bases: piece.to - piece.from + 1,
        relation,
        genes: Object.freeze([left, right]),
      }));
    }
  }

  // The widest partner first, then the longest-shared, then the locus, so a
  // compact strip with room for one name shows the partner that shares most.
  for (const partners of partnersById.values()) {
    partners.sort((a, b) => b.sharedBases - a.sharedBases || (a.id < b.id ? -1 : 1));
    Object.freeze(partners);
  }
  for (const intervals of intervalsByReplicon.values()) {
    intervals.sort((a, b) => a.from - b.from || a.to - b.to
      || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    Object.freeze(intervals);
  }

  // The inventory of every annotated gene that was compared. Zero partners is
  // a measured absence only for an identity that is in it, so a plotted CDS
  // this layer did not look at is refused rather than quietly read as a gene
  // that overlaps nothing.
  const coveredList = payload.coveredGenes;
  if (!Array.isArray(coveredList) || coveredList.length === 0
    || coveredList.some((id) => typeof id !== 'string' || id.length === 0)) {
    fail('has no coveredGenes inventory');
  }
  const covered = new Set(coveredList);
  if (covered.size !== coveredList.length) fail('lists a gene more than once in coveredGenes');
  for (const feature of features) {
    if (!covered.has(feature.id)) fail(`lists ${feature.id} as overlapping but not as compared`);
  }
  const uncovered = [];
  for (let index = 0; index < (genes?.length ?? 0); index += 1) {
    if (!covered.has(genes[index].id)) uncovered.push(genes[index].id);
  }
  if (uncovered.length > 0) {
    fail(`did not compare ${uncovered.length} plotted `
      + `CDS${uncovered.length === 1 ? '' : 's'}, starting with ${uncovered[0]}`);
  }

  const coverage = payload.coverage;
  if (!coverage || typeof coverage !== 'object') fail('has no coverage block');
  const byBiotype = coverage.byBiotype;
  if (!byBiotype || typeof byBiotype !== 'object' || Array.isArray(byBiotype)
    || Object.values(byBiotype).some((count) => !Number.isInteger(count) || count < 0)) {
    fail('has no biotype census');
  }
  const censusTotal = Object.values(byBiotype).reduce((total, count) => total + count, 0);
  const degrees = [...partnersById.values()].map((partners) => partners.length);
  if (!Number.isInteger(coverage.annotatedGenes) || coverage.annotatedGenes < features.length
    || censusTotal !== coverage.annotatedGenes
    || coverage.annotatedGenes !== covered.size
    || coverage.overlappingGenes !== features.length
    || coverage.overlappingPairs !== rawPairs.length
    || coverage.pairwiseSharedBases !== pairwiseSharedBases
    || coverage.maxPartners !== Math.max(0, ...degrees)
    || !Number.isInteger(coverage.childlessGenes) || coverage.childlessGenes < 0
    || coverage.childlessGenes > coverage.annotatedGenes) {
    fail('reports coverage the features and pairs it lists do not support');
  }

  const total = genes?.length ?? 0;
  const values = new Int16Array(total);
  const counts = new Int32Array(OVERLAP_CLASSES.length);
  let selectableOverlapping = 0;
  for (let index = 0; index < total; index += 1) {
    const partners = partnersById.get(genes[index].id) ?? [];
    if (partners.length > 0) selectableOverlapping += 1;
    const bucket = overlapBucketOf(classOfPartners(partners));
    values[index] = bucket;
    counts[bucket] += 1;
  }

  return Object.freeze({
    state: 'ready',
    definition: Object.freeze({ ...definition }),
    release: Object.freeze({ ...payload.release }),
    replicons: Object.freeze(replicons.map((replicon) => Object.freeze({ ...replicon }))),
    features: Object.freeze(features),
    coveredGenes: covered,
    partnersById,
    intervalsByReplicon,
    values,
    counts,
    coverage: Object.freeze({
      ...coverage,
      byBiotype: Object.freeze({ ...byBiotype }),
      // Derived here, not published: how much of the annotation the map can
      // actually select is a fact about this gene file, not about the release.
      selectableGenes: total,
      selectableOverlapping,
      partnersNotSelectable: features.filter((feature) => !feature.selectable).length,
    }),
  });
}

/** One plotted gene's partners, widest shared overlap first; `[]` when it has none. */
export function partnersOf(index, gene) {
  if (!index || index.state !== 'ready') return [];
  return index.partnersById.get(gene?.id) ?? [];
}

/** The OG class of one plotted gene, or the unavailable id when nothing is joined. */
export function overlapClassOf(index, gene) {
  if (!index || index.state !== 'ready') return OVERLAP_UNAVAILABLE.id;
  return classOfPartners(index.partnersById.get(gene?.id) ?? []);
}

/** The three classes that mean "this gene overlaps something". */
export const OVERLAPPING_CLASS_IDS = Object.freeze(
  OVERLAP_CLASS_IDS.filter((id) => id !== 'no-overlap'),
);

/**
 * The class selection one of the filter's three named states stands for.
 *
 * There is one filter channel, the set of classes the reader is keeping, and
 * both surfaces write it: the filter panel's three options, and the colour
 * key's per-class rows. Two channels would let the panel and the key disagree
 * about which genes are hidden, and a reader could not tell which was in force.
 */
export function overlapSelectionFor(filter) {
  if (filter === 'only') return [...OVERLAPPING_CLASS_IDS];
  if (filter === 'none') return ['no-overlap'];
  return [];
}

/**
 * Which of the filter's three named states a class selection is, or null when
 * it is a selection the three options cannot express — two classes out of the
 * four, say, chosen from the colour key. The caller then checks none of the
 * three and names the selection instead of showing a wrong one as chosen.
 */
export function overlapFilterOf(selection) {
  const chosen = new Set(selection ?? []);
  if (chosen.size === 0) return 'any';
  if (chosen.size === OVERLAPPING_CLASS_IDS.length
    && OVERLAPPING_CLASS_IDS.every((id) => chosen.has(id))) return 'only';
  if (chosen.size === 1 && chosen.has('no-overlap')) return 'none';
  return null;
}

/**
 * Whether the class selection can act at all.
 *
 * It cannot while the layer has not been read: with no class resolved for any
 * gene, "only non-overlapping" would either hide everything or, worse, show
 * everything and read as a genome whose genes overlap nothing. The selection
 * is kept and suspended, and {@link OVERLAP_UNAVAILABLE} is what the panel and
 * the key say while it is.
 */
export function overlapFilterActs(index, selection) {
  return Array.isArray(selection) && selection.length > 0
    && Boolean(index) && index.state === 'ready';
}

/**
 * Whether a gene passes a class selection. An empty selection hides nothing,
 * and a suspended one hides nothing either — see {@link overlapFilterActs}.
 */
export function passesOverlapClassFilter(index, gene, selection) {
  if (!overlapFilterActs(index, selection)) return true;
  return selection.includes(classOfPartners(index.partnersById.get(gene?.id) ?? []));
}

/** The overlap row's marks for one replicon, in coordinate order. */
export function repliconOverlapMarks(index, accession) {
  if (!index || index.state !== 'ready') return [];
  for (const [key, intervals] of index.intervalsByReplicon) {
    if (sameReplicon(key, accession)) return intervals;
  }
  return [];
}

/** Marks whose interval intersects an inclusive window. */
export function overlapMarksInWindow(marks, window) {
  if (!window) return marks;
  return marks.filter((mark) => mark.to >= window.from && mark.from <= window.to);
}

/** A biotype as copy writes it: the release's own token, readable. */
export function biotypeLabel(biotype) {
  if (typeof biotype !== 'string' || biotype.length === 0) return 'annotated gene';
  if (biotype === 'protein_coding') return 'protein-coding gene';
  if (biotype === 'pseudogene') return 'pseudogene';
  if (biotype === 'other') return 'annotated gene of an unstated type';
  return `${biotype.replace(/_/g, ' ')} gene`;
}

/** A partner as one line of text: who it is, which way it reads, what it shares. */
export function describePartner(partner) {
  const name = partner.name ? `${partner.id} (${partner.name})` : partner.id;
  const direction = partner.strand === '+' ? 'forward strand'
    : partner.strand === '-' ? 'reverse strand' : 'unrecorded strand';
  const intervals = partner.sharedIntervals
    .map((piece) => (piece.from === piece.to ? `${piece.from}` : `${piece.from}–${piece.to}`))
    .join(', ');
  const relation = partner.relation === 'same' ? 'same strand'
    : partner.relation === 'opposite' ? 'opposite strand' : 'strand not recorded';
  const containment = partner.containment === 'contains' ? ', which it contains'
    : partner.containment === 'containedBy' ? ', inside which it lies'
      : partner.containment === 'equal' ? ', over exactly the same bases' : '';
  const selectable = partner.selectable ? ''
    : ', not among the plotted CDSs, so it cannot be opened in the gene visualizer';
  return `${name}, a ${biotypeLabel(partner.biotype)} on the ${direction} (${relation})`
    + `${containment}, sharing ${partner.sharedBases} `
    + `base${partner.sharedBases === 1 ? '' : 's'} at ${intervals}${selectable}.`;
}

/**
 * The rule in one sentence, for a legend or a control that stands open.
 *
 * Short on purpose: a key is read at a glance, and the field names and the
 * census behind the rule belong in the explanation disclosure, which is where
 * {@link describeOverlapDefinition} puts them.
 */
export function describeOverlapRule(index) {
  if (!index || index.state !== 'ready') return OVERLAP_UNAVAILABLE.note;
  return `${OVERLAP_TAG_LABEL} marks ${OVERLAP_TAG_EXPANSION}: two annotated genes that share at `
    + 'least one base on the same replicon, on either strand, counted over every annotated gene '
    + 'of this release including its tRNA, rRNA and pseudogene rows.';
}

/**
 * The full definition, in the payload's own words, for the explanation
 * disclosure.
 *
 * It is the layer's own `definition` block and nothing else, so the sentence a
 * reader is shown cannot drift from the rule the data was built under.
 */
export function describeOverlapDefinition(index) {
  if (!index || index.state !== 'ready') return OVERLAP_UNAVAILABLE.note;
  const { definition } = index;
  return `An overlap is ${definition.overlap}. It is counted over ${definition.features}, and `
    + `each gene occupies ${definition.extent}. Excluded: ${definition.excluded}.`;
}

/**
 * What the layer covers, in one sentence, so a reader can tell a gene with no
 * partner from a gene nobody looked at.
 *
 * The counts are the whole annotation's, not the listed subset's, and they do
 * not move when a filter hides a partner: the tag records genomic context.
 */
export function describeOverlapCoverage(index) {
  if (!index || index.state !== 'ready') return OVERLAP_UNAVAILABLE.note;
  const { coverage, release } = index;
  const biotypes = Object.entries(coverage.byBiotype)
    .map(([biotype, count]) => `${count.toLocaleString('en-US')} ${biotypeLabel(biotype)}${count === 1 ? '' : 's'}`)
    .join(', ');
  return `Every annotated gene of ${release.accession} was compared, and each is named in the `
    + `layer\u2019s own inventory: ${coverage.annotatedGenes.toLocaleString('en-US')} gene `
    + `records — ${biotypes} — of which ${coverage.overlappingGenes.toLocaleString('en-US')} `
    + 'share at least one base with another, in '
    + `${coverage.overlappingPairs.toLocaleString('en-US')} pairs over `
    + `${coverage.pairwiseSharedBases.toLocaleString('en-US')} pairwise shared bases, counted `
    + 'once per pair, so a base two pairs both share is counted twice and this is not a count '
    + `of distinct genomic bases. `
    + `${coverage.selectableOverlapping.toLocaleString('en-US')} of the `
    + `${coverage.selectableGenes.toLocaleString('en-US')} plotted CDSs carry an ${OVERLAP_TAG_LABEL} `
    + `tag, and ${coverage.partnersNotSelectable.toLocaleString('en-US')} partners are annotated `
    + 'genes this map does not plot, which are named but cannot be opened.'
    + (coverage.childlessGenes > 0
      ? ` ${coverage.childlessGenes.toLocaleString('en-US')} gene records have no annotated child `
        + 'feature, so the gene row’s own span is their extent.'
      : '');
}
