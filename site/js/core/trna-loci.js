/** DOM-free contracts for the optional tRNA chromosome layer. */

const LOCUS_KINDS = new Set(['refseq', 'scan-only-candidate']);
const STRANDS = new Set(['+', '-']);

function requiredText(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`trna-loci-v1.json has no ${field}`);
  }
  return value;
}

function nullableText(value, field) {
  if (value !== null && (typeof value !== 'string' || value.length === 0)) {
    throw new Error(`trna-loci-v1.json has invalid ${field}`);
  }
  return value;
}

/** Validate and return a payload for the browser consumer. */
export function validateTrnaPayload(payload, { organismId = null, assembly = null } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || payload.schemaVersion !== 1) {
    throw new Error('trna-loci-v1.json has an unknown schemaVersion');
  }
  if (organismId && payload.organismId !== organismId) {
    throw new Error(`trna-loci-v1.json belongs to ${payload.organismId}, not ${organismId}`);
  }
  if (assembly && payload.assembly !== assembly) {
    throw new Error(`trna-loci-v1.json belongs to ${payload.assembly}, not ${assembly}`);
  }
  if (payload.coordinateSystem !== '1-based inclusive'
    || payload.sequenceOrientation !== 'transcription') {
    throw new Error('trna-loci-v1.json has unsupported coordinate or sequence conventions');
  }
  if (!payload.run || !payload.sources || !Array.isArray(payload.loci)) {
    throw new Error('trna-loci-v1.json has no run, sources, or loci');
  }
  requiredText(payload.run.id, 'run id');
  requiredText(payload.run.tool, 'run tool');
  requiredText(payload.run.version, 'run version');
  for (const key of ['refseq', 'comparison']) {
    requiredText(payload.sources[key]?.label, `${key} source label`);
    const href = requiredText(payload.sources[key]?.href, `${key} source link`);
    if (!/^https:\/\//.test(href)) throw new Error(`trna-loci-v1.json has invalid ${key} source link`);
  }
  const ids = new Set();
  let annotated = 0;
  let candidates = 0;
  let previous = null;
  for (const locus of payload.loci) {
    requiredText(locus.id, 'locus id');
    if (ids.has(locus.id)) throw new Error(`trna-loci-v1.json repeats ${locus.id}`);
    ids.add(locus.id);
    if (!LOCUS_KINDS.has(locus.kind)) throw new Error(`${locus.id} has an invalid kind`);
    requiredText(locus.replicon, `${locus.id} replicon`);
    if (!Number.isInteger(locus.start) || !Number.isInteger(locus.end)
      || locus.start < 1 || locus.end < locus.start) {
      throw new Error(`${locus.id} has invalid coordinates`);
    }
    if (!STRANDS.has(locus.strand)) throw new Error(`${locus.id} has an invalid strand`);
    const length = locus.end - locus.start + 1;
    if (locus.lengthNt !== length || typeof locus.sequence !== 'string'
      || locus.sequence.length !== length || !/^[ACGTN]+$/.test(locus.sequence)) {
      throw new Error(`${locus.id} has an invalid sequence or length`);
    }
    requiredText(locus.scanIsotype, `${locus.id} scan isotype`);
    requiredText(locus.scanAnticodon, `${locus.id} scan anticodon`);
    requiredText(locus.annotationScanStatus, `${locus.id} annotation/scan status`);
    if (typeof locus.pseudo !== 'boolean') throw new Error(`${locus.id} has no pseudo flag`);
    if (locus.kind === 'refseq') {
      annotated += 1;
      requiredText(locus.locusTag, `${locus.id} RefSeq locus tag`);
      requiredText(locus.refseqProduct, `${locus.id} RefSeq product`);
      requiredText(locus.refseqIsotype, `${locus.id} RefSeq isotype`);
      requiredText(locus.refseqAnticodon, `${locus.id} RefSeq anticodon`);
      requiredText(locus.modelEffectiveAnticodon, `${locus.id} model-effective anticodon`);
      if (locus.pseudo) throw new Error(`${locus.id} unexpectedly marks a RefSeq locus pseudo`);
    } else {
      candidates += 1;
      for (const field of ['locusTag', 'refseqProduct', 'refseqIsotype', 'refseqAnticodon',
        'modelEffectiveAnticodon']) nullableText(locus[field], `${locus.id} ${field}`);
      if (locus.locusTag !== null || !locus.pseudo) {
        throw new Error(`${locus.id} must remain a scan-only pseudogene candidate`);
      }
    }
    const order = `${locus.replicon}\u0000${String(locus.start).padStart(12, '0')}\u0000${locus.id}`;
    if (previous !== null && order < previous) throw new Error('trna-loci-v1.json is not coordinate sorted');
    previous = order;
  }
  const expected = payload.counts;
  if (!expected || expected.annotated !== annotated || expected.predictedCandidates !== candidates
    || expected.totalRecords !== payload.loci.length) {
    throw new Error('trna-loci-v1.json counts do not match its loci');
  }
  return payload;
}

/** Human-searchable text. Candidate identity remains location/run based. */
export function trnaSearchText(locus) {
  return [locus.id, locus.locusTag, locus.refseqProduct, locus.refseqIsotype,
    locus.refseqAnticodon, locus.modelEffectiveAnticodon, locus.scanIsotype,
    locus.scanAnticodon, locus.replicon]
    .filter(Boolean).join(' ').toLocaleLowerCase('en-US');
}

/** Whether a locus passes the viewer's recorded-field filters. */
export function matchesTrnaFilters(locus, filters = {}) {
  const query = String(filters.query ?? '').trim().toLocaleLowerCase('en-US');
  if (query && !trnaSearchText(locus).includes(query)) return false;
  if (filters.strand && filters.strand !== 'all' && locus.strand !== filters.strand) return false;
  if (filters.kind && filters.kind !== 'all' && locus.kind !== filters.kind) return false;
  if (filters.isotype && filters.isotype !== 'all'
    && ![locus.refseqIsotype, locus.scanIsotype].includes(filters.isotype)) return false;
  if (filters.anticodon && filters.anticodon !== 'all'
    && ![locus.refseqAnticodon, locus.scanAnticodon].includes(filters.anticodon)) return false;
  return true;
}

/** Other records whose inclusive genomic spans overlap this locus. */
export function overlappingTrnas(locus, loci) {
  return loci.filter((other) => other.id !== locus.id && other.replicon === locus.replicon
    && other.start <= locus.end && other.end >= locus.start);
}

/**
 * The coordinate window the tRNA track opens on with no chromosome camera yet.
 *
 * The tab is reachable directly, from a link or a reload, so its track cannot
 * wait for the chromosome canvas to publish a window. The primary replicon at
 * full length is what a fresh chromosome view would hand it anyway, so a direct
 * visit and a visit through that tab start from the same picture.
 */
export function defaultTrnaViewport(genome) {
  const replicons = genome?.replicons ?? [];
  const replicon = replicons.find((entry) => entry.primary) ?? replicons[0];
  if (!replicon) return null;
  return { replicon: replicon.accession, from: 1, to: replicon.lengthBp };
}

/** Group visible loci whose centres land within ``minimumGap`` pixels. */
export function clusterTrnaMarkers(loci, window, width, minimumGap = 18) {
  if (!window || !Number.isFinite(width) || width <= 0) return [];
  const span = window.to - window.from + 1;
  if (span <= 0) return [];
  const denominator = Math.max(1, span - 1);
  const points = loci
    .filter((locus) => locus.replicon === window.replicon
      && locus.end >= window.from && locus.start <= window.to)
    .map((locus) => ({
      locus,
      x: ((Math.max(window.from, Math.min(window.to, (locus.start + locus.end) / 2))
        - window.from) / denominator) * width,
    }))
    .sort((a, b) => a.x - b.x || a.locus.start - b.locus.start);
  const groups = [];
  for (const point of points) {
    const last = groups[groups.length - 1];
    if (last && point.x - last.lastX < minimumGap) {
      last.points.push(point);
      last.lastX = point.x;
    } else {
      groups.push({ points: [point], lastX: point.x });
    }
  }
  return groups.map(({ points: members }) => ({
    x: members.reduce((sum, point) => sum + point.x, 0) / members.length,
    loci: members.map((point) => point.locus),
    candidate: members.some((point) => point.locus.kind === 'scan-only-candidate'),
  }));
}
