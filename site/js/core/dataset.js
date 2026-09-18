/**
 * Loading and indexing of the pipeline's JSON, per docs/validation/data-contract.md.
 *
 * The pipeline is the only writer of those files; everything here is read-only
 * and happens once at start-up.
 */
import { CodonTable } from './codon-table.js';
import { buildCaiWeights, buildTaiWeights, buildCodonPairScores } from './codon-metrics.js';
import { compileScheme } from './scheme.js';
import { computeLiveMetrics } from './live-metrics.js';

async function fetchJson(fetchImpl, url, { optional = false } = {}) {
  let response;
  try {
    response = await fetchImpl(url, { cache: 'no-cache' });
  } catch (cause) {
    if (optional) return null;
    throw new Error(`could not read ${url}: ${cause.message}`, { cause });
  }
  if (!response.ok) {
    if (optional) return null;
    throw new Error(`could not read ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}

/** Mean absolute difference and worst case between a pipeline field and a recomputed one. */
function agreement(genes, key, recomputed) {
  let sum = 0;
  let worst = 0;
  let worstGene = null;
  let n = 0;
  for (let i = 0; i < genes.length; i += 1) {
    const reported = genes[i][key];
    const computed = recomputed[i];
    if (typeof reported !== 'number' || !Number.isFinite(reported) || !Number.isFinite(computed)) {
      continue;
    }
    const difference = Math.abs(reported - computed);
    sum += difference;
    if (difference > worst) {
      worst = difference;
      worstGene = genes[i].id;
    }
    n += 1;
  }
  return { key, compared: n, meanAbsDifference: n > 0 ? sum / n : NaN, worst, worstGene };
}

/**
 * Load and index the whole dataset.
 * @param {{baseUrl: URL|string, fetchImpl?: typeof fetch}} options
 */
export async function loadDataset({ baseUrl, fetchImpl = fetch }) {
  const base = new URL(String(baseUrl), typeof document === 'undefined' ? 'file:///' : document.baseURI);
  const url = (name) => new URL(name, base).href;

  const [meta, genes, codonPca, excluded] = await Promise.all([
    fetchJson(fetchImpl, url('meta.json')),
    fetchJson(fetchImpl, url('genes.json')),
    fetchJson(fetchImpl, url('codon_pca.json'), { optional: true }),
    fetchJson(fetchImpl, url('excluded.json'), { optional: true }),
  ]);

  requireArray(genes, 'genes.json');
  if (genes.length === 0) throw new Error('genes.json is empty');
  const table = new CodonTable(meta.codonAlphabet);

  const n = genes.length;
  const offsets = new Int32Array(n + 1);
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    const packedLength = genes[i].codons?.length ?? 0;
    if (packedLength === 0) throw new Error(`gene ${genes[i].id} has no packed codon string`);
    if (genes[i].lengthCodons !== packedLength) {
      throw new Error(
        `gene ${genes[i].id}: lengthCodons ${genes[i].lengthCodons} does not match ` +
          `${packedLength} packed codons`,
      );
    }
    offsets[i] = total;
    total += packedLength;
  }
  offsets[n] = total;

  const packed = new Uint8Array(total);
  // The packed string holds sense codons only, so the removed terminal stop is
  // kept beside it. A stop-reassignment scheme is invisible without it.
  const stopCodons = new Int8Array(n).fill(-1);
  const counts = new Uint16Array(n * 64);
  const genomeCounts = new Float64Array(64);
  const pairCounts = new Float64Array(4096);
  const lengthsNt = new Float64Array(n);
  let genesWithoutStop = 0;
  for (let i = 0; i < n; i += 1) {
    const decoded = table.decode(genes[i].codons);
    packed.set(decoded, offsets[i]);
    lengthsNt[i] = genes[i].lengthNt;
    const stop = genes[i].terminalStop;
    if (typeof stop === 'string') {
      const stopIndex = table.indexOf(stop);
      if (stopIndex < 0 || !table.isStop[stopIndex]) {
        throw new Error(`gene ${genes[i].id}: terminalStop ${stop} is not a stop codon`);
      }
      stopCodons[i] = stopIndex;
    } else {
      genesWithoutStop += 1;
    }
    const countBase = i * 64;
    for (let j = 0; j < decoded.length; j += 1) {
      const codon = decoded[j];
      counts[countBase + codon] += 1;
      genomeCounts[codon] += 1;
      if (j > 0) pairCounts[decoded[j - 1] * 64 + codon] += 1;
    }
  }

  const referenceTags = new Set(meta.caiReferenceSet?.locusTags ?? []);
  const referenceCounts = new Float64Array(64);
  let referenceGenes = 0;
  for (let i = 0; i < n; i += 1) {
    if (!referenceTags.has(genes[i].id)) continue;
    referenceGenes += 1;
    for (let c = 0; c < 64; c += 1) referenceCounts[c] += counts[i * 64 + c];
  }
  const caiReferenceFallback = referenceGenes === 0;
  const caiWeights = buildCaiWeights(caiReferenceFallback ? genomeCounts : referenceCounts, table);
  const { weights: taiWeights, report: taiReport } =
    buildTaiWeights(meta.tai?.tRNAGeneCopies, meta.tai?.sValues, table);
  const cpsScores = buildCodonPairScores(pairCounts, genomeCounts, table);

  const dataset = {
    meta,
    genes,
    codonPca,
    excluded: excluded ?? [],
    table,
    packed,
    offsets,
    stopCodons,
    counts,
    genomeCounts,
    lengthsNt,
    caiWeights,
    taiWeights,
    cpsScores,
    indexById: new Map(genes.map((gene, i) => [gene.id, i])),
    provenance: {
      genesWithoutTerminalStop: genesWithoutStop,
      expressionSource: meta.expressionSource ?? null,
      caiReferenceGenes: referenceGenes,
      caiReferenceFallback,
      taiReport,
      declaredGeneCount: meta.geneCount ?? null,
      loadedGeneCount: n,
      excludedCount: (excluded ?? []).length,
    },
  };

  const identity = compileScheme({}, table);
  const { fields: baseline } = computeLiveMetrics(dataset, identity);
  dataset.baseline = baseline;
  dataset.provenance.agreement = [
    agreement(genes, 'gc3', baseline.recodedGc3),
    agreement(genes, 'cai', baseline.recodedCai),
    agreement(genes, 'tai', baseline.recodedTai),
    agreement(genes, 'enc', baseline.recodedEnc),
    agreement(genes, 'cps', baseline.recodedCps),
  ];
  return dataset;
}
