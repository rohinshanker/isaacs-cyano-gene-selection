/** Native RF01116 family evidence stays independent of all CDS associations. */
import { DEFAULT_ORGANISM, layerOf } from './organisms.js';
import { sameReplicon, repliconLength } from './chromosome-model.js';
import { transcriptionPieces } from './gene-view-model.js';
import { markerLayerForKey, markerOf } from './marker-layers.js';

export function validateRfamEvidence(payload, organism = DEFAULT_ORGANISM) {
  const fail = () => { throw new Error('rfam_rf01116.json has invalid or unpinned native family evidence'); };
  const family = payload?.family;
  if (!layerOf(organism ?? DEFAULT_ORGANISM, 'rfamEvidence')
    || payload?.schemaVersion !== 1 || payload.id !== 'rfam-rf01116'
    || payload.origin !== 'computed' || payload.measurement !== 'predicted'
    || payload.assembly !== 'GCF_000817325.1_ASM81732v1'
    || family?.accession !== 'RF01116' || family.name !== 'Yfr1'
    || family.release !== '15.1' || family.gaBits !== 38
    || !Array.isArray(payload.sites) || !payload.provenance
    || typeof payload.provenance.searchCoverage?.statement !== 'string'
    || typeof payload.provenance.originJunctionSearch?.coverageNote !== 'string'
    || !Array.isArray(payload.limitations)
    || payload.limitations.length === 0 || payload.limitations.some((entry) => typeof entry !== 'string')) fail();
  const ids = new Set();
  for (const row of payload.sites) {
    const length = (organism ?? DEFAULT_ORGANISM).genome.replicons
      .find((replicon) => replicon.accession === row?.replicon)?.lengthBp;
    if (!row || row.type !== 'rnaFamily' || row.origin !== 'computed'
      || row.measurement !== 'predicted' || !['+', '-'].includes(row.strand)
      || !Number.isInteger(row.position) || !Number.isInteger(row.endPosition)
      || !length || row.position < 1 || row.position > length
      || row.endPosition < 1 || row.endPosition > length
      || row.originSpanning !== (row.position > row.endPosition)
      || row.id !== `RF01116:${row.replicon}:${row.position}:${row.endPosition}:${row.strand}`
      || ids.has(row.id) || row.producer !== 'Infernal 1.1.5 / Rfam 15.1 RF01116'
      || !Number.isFinite(row.scoreBits) || row.scoreBits < family.gaBits
      || !Number.isFinite(row.evalue) || row.evalue < 0
      || typeof row.truncation !== 'string' || !Number.isInteger(row.modelStart)
      || !Number.isInteger(row.modelEnd) || row.modelStart < 1
      || row.modelEnd < row.modelStart || row.modelEnd > 59 || !row.raw) fail();
    ids.add(row.id);
  }
  return payload;
}

export function rfamMarkers(payload) {
  return (payload?.sites ?? []).map((site) => ({
    ...site, ...markerOf(site, markerLayerForKey('rfamEvidence')),
  }));
}

/** Inclusive native pieces, including a true circular wrap. */
export function rfamNativeRuns(marker) {
  if (marker.endPosition >= marker.position) return [{ from: marker.position, to: marker.endPosition }];
  return [{ from: marker.position, to: repliconLength(marker.replicon) }, { from: 1, to: marker.endPosition }];
}

/** Project onto the existing gene context only; never enlarge its domain. */
export function rfamGeneRows(payload, gene, domain) {
  if (!gene || !domain) return [];
  const first = transcriptionPieces(gene)[0];
  if (!first) return [];
  const minus = gene.strand === '-';
  const anchor = minus ? first.high : first.low;
  const length = repliconLength(gene.seqid);
  return rfamMarkers(payload).filter((marker) => sameReplicon(marker.replicon, gene.seqid))
    .flatMap((marker) => {
      const runs = rfamNativeRuns(marker).flatMap(({ from, to }) => {
        const low = minus ? anchor - to : from - anchor;
        const high = minus ? anchor - from : to - anchor;
        return [-length, 0, length].flatMap((shift) => {
          const start = Math.max(domain.min, low + shift);
          const end = Math.min(domain.max, high + shift + 1);
          return end > start ? [{ from: start, to: end }] : [];
        });
      });
      return runs.length ? [{ ...marker, runs }] : [];
    });
}

export function rfamSiteText(row, payload) {
  return `${payload.family.accession} / ${payload.family.name} family homology · computed prediction · `
    + `${row.replicon}:${row.position}–${row.endPosition} (${row.strand}), one-based inclusive bp`
    + `${row.originSpanning ? ', crosses circular origin' : ''} · ${row.scoreBits} bits `
    + `(GA ${payload.family.gaBits} bits) · E-value ${row.evalue} · model ${row.modelStart}–${row.modelEnd} `
    + `· truncation: ${row.truncation} · ${row.producer} · assembly ${payload.assembly}. `
    + 'Family interval only; full transcript ends, targets and regulatory activity are unknown. No CDS ownership assigned. '
    + 'Original native sequence; not recomputed for the active recoding scheme.';
}
