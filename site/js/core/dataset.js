/**
 * Loading and indexing of the pipeline's JSON, per docs/validation/data-contract.md.
 *
 * The pipeline is the only writer of those files; everything here is read-only.
 *
 * Loading is staged. Every file starts downloading at once, the page becomes
 * usable when the tier 1 files have been validated and indexed, and each later
 * file is validated and joined onto the same dataset when it arrives. Staging
 * changes when a check runs, never whether: every validation and join the
 * single-step loader performed still runs, on every file, with the same
 * message when it fails. `loadDataset` is that single-step loader, kept as the
 * staged one awaited to the end, so the two cannot drift.
 *
 * A file that has not arrived is `loading`, which is not `absent`: see
 * docs/validation/progressive-loading.md.
 */
import { CodonTable } from './codon-table.js';
import {
  buildCaiWeights, buildTaiWeights, buildCodonPairScores, encFromCounts,
} from './codon-metrics.js';
import {
  resolveConventions, applyInitiatorConvention, RECOMPUTATION_TOLERANCE,
} from './conventions.js';
import { compileScheme } from './scheme.js';
import { computeLiveMetrics } from './live-metrics.js';
import { declaredMeasurementSources } from './metric-registry.js';
import { validateLengthInventory } from './length-cohorts.js';
import { validateRegulatoryTss } from './regulatory-tss.js';
import { validateStrainFitness } from './strain-fitness.js';
import { validateCandidateEvidence } from './candidate-evidence.js';
import { joinFunctionCategories } from './function-categories.js';
import { validateSourceDerivedCategories } from './source-derived-categories.js';
import { validateGoIeaEssentiality } from './go-iea-essentiality.js';
import { validateTrnaPayload } from './trna-loci.js';
import { validateCodonPcaReference } from './codon-pca-reference.js';
import {
  CORE_FILE_KEYS, DATA_FILES, DATA_FILE_BY_KEY, DATA_MANIFEST_NAME, FILE_STATE, dataRequest,
  normalizeManifest, publishesFile,
} from './data-files.js';

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}

/**
 * Compare a pipeline field with the browser's recomputation of the same quantity.
 *
 * These are two computations of one number, so a difference is a convention the
 * two sides do not share, not a tolerance to be reported as agreement. The
 * verdict is carried here so no caller has to decide what counts as agreeing.
 */
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
  return {
    key,
    compared: n,
    meanAbsDifference: n > 0 ? sum / n : NaN,
    worst,
    worstGene,
    tolerance: RECOMPUTATION_TOLERANCE,
    agrees: n > 0 && worst <= RECOMPUTATION_TOLERANCE,
  };
}

/**
 * Index the tier 1 files into a dataset the map can be drawn from.
 *
 * Everything a recoding scheme is scored against is here: the packed codons,
 * the terminal stops, the weight tables, and the baseline the pipeline's own
 * metrics are checked against. The evidence files are joined later by
 * `DATA_APPLIERS`; until then their fields are null and their entry in `files`
 * says `loading`, which is how a consumer tells not-yet-here from not-there.
 *
 * @param {object} meta parsed meta.json.
 * @param {object[]} genes parsed genes.json.
 * @param {object|null} functionCategoryData parsed function-categories-v1.json.
 */
export function buildCoreDataset(meta, genes, functionCategoryData) {
  requireArray(genes, 'genes.json');
  if (genes.length === 0) throw new Error('genes.json is empty');
  const functionCategories = functionCategoryData
    ? joinFunctionCategories(functionCategoryData, genes, meta.annotationRelease?.releaseId)
    : null;
  const table = new CodonTable(meta.codonAlphabet);
  const conventions = resolveConventions(meta, table);
  const { initiatorIndex } = conventions;

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
  // Codon-usage metrics count position zero as methionine, so the genome-wide
  // tables the codon-pair scores are built from use that view; `genomeCounts`
  // stays literal because it is what the interface shows as observed usage.
  const translatedGenomeCounts = new Float64Array(64);
  const translatedPairCounts = new Float64Array(4096);
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
    let previousTranslated = -1;
    for (let j = 0; j < decoded.length; j += 1) {
      const codon = decoded[j];
      counts[countBase + codon] += 1;
      genomeCounts[codon] += 1;
      const translatedCodon = j === 0 ? initiatorIndex : codon;
      translatedGenomeCounts[translatedCodon] += 1;
      if (previousTranslated >= 0) {
        translatedPairCounts[previousTranslated * 64 + translatedCodon] += 1;
      }
      previousTranslated = translatedCodon;
    }
  }

  // The reference set feeds the CAI weights, so it is counted under the same
  // convention as the genes those weights will score.
  const referenceTags = new Set(meta.caiReferenceSet?.locusTags ?? []);
  const referenceCounts = new Float64Array(64);
  const scratch = new Float64Array(64);
  let referenceGenes = 0;
  let encFlagMismatches = 0;
  const encReport = {};
  for (let i = 0; i < n; i += 1) {
    for (let c = 0; c < 64; c += 1) scratch[c] = counts[i * 64 + c];
    applyInitiatorConvention(scratch, packed[offsets[i]], initiatorIndex);
    if (referenceTags.has(genes[i].id)) {
      referenceGenes += 1;
      for (let c = 0; c < 64; c += 1) referenceCounts[c] += scratch[c];
    }
    // The pipeline publishes whether a gene's Nc leaned on a class average.
    // Recomputing it is a free check that both sides read the same families.
    if (typeof genes[i].encHasSubstitutedFamilies === 'boolean') {
      encFromCounts(scratch, table, encReport);
      if (encReport.hasSubstitutedFamilies !== genes[i].encHasSubstitutedFamilies) {
        encFlagMismatches += 1;
      }
    }
  }
  const caiReferenceFallback = referenceGenes === 0;
  const caiWeights = buildCaiWeights(
    caiReferenceFallback ? translatedGenomeCounts : referenceCounts,
    table,
    conventions.cai.zeroCountAdjustment,
  );
  const { weights: taiWeights, report: taiReport } = buildTaiWeights(
    meta.tai?.tRNAGeneCopies,
    conventions.tai.sValues,
    table,
    {
      publishedSubstitution: conventions.tai.publishedSubstitution,
      publishedZeroWeightCodons: conventions.tai.publishedZeroWeightCodons,
    },
  );
  const cpsScores = buildCodonPairScores(
    translatedPairCounts, translatedGenomeCounts, table, conventions.cps.smoothing,
  );

  const dataset = {
    meta,
    genes,
    codonPca: null,
    codonPcaReference: null,
    excluded: [],
    lengthCohorts: null,
    regulatoryTss: null,
    trnaLoci: null,
    strainFitness: null,
    candidateEvidence: null,
    goIeaEssentiality: null,
    goTerms: null,
    functionCategories,
    sourceDerivedCategories: null,
    table,
    conventions,
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
    // Per-file load state, written by `loadDatasetStaged`. A dataset built
    // without the loader has none, and reads as fully settled.
    files: {},
    provenance: {
      genesWithoutTerminalStop: genesWithoutStop,
      expressionSource: meta.expressionSource ?? null,
      expressionSources: declaredMeasurementSources(meta),
      caiReferenceGenes: referenceGenes,
      caiReferenceFallback,
      taiReport,
      conventionReport: conventions.report,
      encFlagMismatches,
      declaredGeneCount: meta.geneCount ?? null,
      loadedGeneCount: n,
      excludedCount: 0,
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

/**
 * One validator-and-join per later file.
 *
 * Each takes the dataset and the file's parsed content, or null when this
 * deployment does not publish the file, and either writes the validated data
 * onto the dataset or throws the message the single-step loader threw. A file
 * whose validation reads another file's joined data declares that in
 * `DATA_FILES[...].needs`, and the loader applies it only after those settle.
 */
export const DATA_APPLIERS = Object.freeze({
  annotations(dataset, annotations) {
    const { meta, genes } = dataset;
    if (meta.annotationRelease && (!annotations || typeof annotations !== 'object')) {
      throw new Error('annotations.json is required by meta.annotationRelease');
    }
    if (!annotations) return;
    for (const gene of genes) {
      const evidence = annotations[gene.id];
      if (!evidence || typeof evidence !== 'object') {
        throw new Error(`annotations.json has no evidence for ${gene.id}`);
      }
    }
    // Joined only once every gene is known to have a record, so a file that
    // fails half way leaves no gene carrying evidence its neighbours lack.
    for (const gene of genes) gene.annotationEvidence = annotations[gene.id];
  },

  candidateEvidence(dataset, candidateEvidence) {
    if (candidateEvidence) {
      validateCandidateEvidence(
        candidateEvidence, dataset.genes, dataset.meta.annotationRelease?.releaseId,
      );
    }
    dataset.candidateEvidence = candidateEvidence;
  },

  // Derived categories are checked against the reviewed table, the PCC joins,
  // and each gene's GO terms, and every assignment is re-derived from its
  // probability, so a stale or hand-edited category cannot load.
  sourceDerivedCategories(dataset, data) {
    dataset.sourceDerivedCategories = data
      ? validateSourceDerivedCategories(
        data, dataset.genes, dataset.functionCategories, dataset.candidateEvidence,
        dataset.meta.annotationRelease?.releaseId,
      )
      : null;
  },

  lengthCohorts(dataset, lengthCohorts) {
    if (lengthCohorts) {
      validateLengthInventory(
        lengthCohorts, dataset.genes, dataset.meta.annotationRelease?.releaseId,
      );
    }
    dataset.lengthCohorts = lengthCohorts;
  },

  codonPca(dataset, codonPca) {
    dataset.codonPca = codonPca;
  },

  codonPcaReference(dataset, reference) {
    dataset.codonPcaReference = reference
      ? validateCodonPcaReference(reference, dataset, dataset.organism)
      : null;
  },

  excluded(dataset, excluded) {
    dataset.excluded = excluded ?? [];
    dataset.provenance.excludedCount = dataset.excluded.length;
  },

  tssEvidence(dataset, tssEvidence) {
    const { meta, genes } = dataset;
    if (meta.tssEvidenceSource && (
      !tssEvidence || typeof tssEvidence !== 'object' || Array.isArray(tssEvidence)
    )) {
      throw new Error('tss_evidence.json is required by meta.tssEvidenceSource');
    }
    if (!tssEvidence) return;
    for (const gene of genes) {
      if (!Array.isArray(tssEvidence[gene.id] ?? [])) {
        throw new Error(`tss_evidence.json has invalid rows for ${gene.id}`);
      }
    }
    for (const gene of genes) gene.tssEvidence = tssEvidence[gene.id] ?? [];
  },

  /**
   * Long native upstream sequence, kept outside genes.json so map boot and its
   * per-gene size budget do not pay for a close-up-only control.
   */
  sequenceContext(dataset, payload) {
    const { genes, organism } = dataset;
    if (!payload) {
      dataset.sequenceContext = null;
      return;
    }
    if (typeof payload !== 'object' || Array.isArray(payload) || payload.schemaVersion !== 1) {
      throw new Error('sequence_context.json has an unknown schemaVersion');
    }
    const max = payload.maxUpstreamNt;
    if (!Number.isInteger(max) || max <= 30
      || (organism?.sequenceContext && max !== organism.sequenceContext.maxUpstreamNt)) {
      throw new Error('sequence_context.json has an invalid upstream extent');
    }
    if (payload.origin !== 'computed' || typeof payload.producer !== 'string'
      || payload.producer.length === 0) {
      throw new Error('sequence_context.json must name its computed origin and producer');
    }
    const ids = payload.geneIds;
    const upstream = payload.upstream;
    if (!Array.isArray(ids) || ids.length !== genes.length
      || ids.some((id, index) => id !== genes[index].id)) {
      throw new Error('sequence_context.json was built from a different gene file');
    }
    if (!Array.isArray(upstream) || upstream.length !== genes.length
      || upstream.some((sequence) => typeof sequence !== 'string'
        || sequence.length !== max || !/^[ACGT]+$/.test(sequence))) {
      throw new Error('sequence_context.json has an invalid upstream sequence column');
    }
    for (let index = 0; index < genes.length; index += 1) {
      const context = genes[index].rnaContext;
      const core = typeof context?.upstream === 'string'
        ? context.upstream : typeof context?.sequence === 'string' ? context.sequence.slice(0, 30) : null;
      if (core === null || upstream[index].slice(-30) !== core) {
        throw new Error(`sequence_context.json disagrees with genes.json for ${genes[index].id}`);
      }
    }
    for (let index = 0; index < genes.length; index += 1) {
      genes[index].extendedUpstream = upstream[index];
    }
    dataset.sequenceContext = {
      maxUpstreamNt: max, origin: payload.origin, producer: payload.producer,
    };
  },

  /**
   * Expression layers published apart from the gene file, joined by locus tag.
   *
   * The payload repeats the gene order, so a file built from another gene file
   * is refused rather than joined one row off. Each value lands on its gene
   * under the metric key the registry already reads; a null stays absent, so
   * an unmeasured gene is unknown, never zero.
   */
  expressionLayers(dataset, payload) {
    const { meta, genes } = dataset;
    const declared = layerPayloadSources(meta);
    if (declared.length === 0) {
      if (payload) throw new Error('expression_layers.json is published but no source declares it');
      return;
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('expression_layers.json is required by meta.expressionSources');
    }
    if (payload.schemaVersion !== 1) {
      throw new Error('expression_layers.json has an unknown schemaVersion');
    }
    const ids = payload.geneIds;
    if (!Array.isArray(ids) || ids.length !== genes.length
      || ids.some((id, index) => id !== genes[index].id)) {
      throw new Error('expression_layers.json was built from a different gene file');
    }
    const layers = payload.layers;
    if (!layers || typeof layers !== 'object' || Array.isArray(layers)) {
      throw new Error('expression_layers.json has no layers object');
    }
    for (const source of declared) {
      const column = layers[source.metricKey];
      if (!Array.isArray(column) || column.length !== genes.length) {
        throw new Error(`expression_layers.json has no complete layer for ${source.metricKey}`);
      }
      // A source that declares its measured quantity ships the bounds that
      // quantity admits, resolved once by the pipeline from the quantity
      // contract: whole counts for a read count, [0, 1] for a p-value, either
      // sign for a log ratio. A source that declares none keeps the older
      // rule, where only the sign is constrained.
      const bounds = source.quantityBounds ?? null;
      const mayBeNegative = bounds
        ? !bounds.nonnegative
        // Two reasons a value may be negative, and the source says which. A
        // fitness score is signed and centres on zero; a log-scaled abundance
        // is one-sided and a negative simply means below one unit. Neither
        // licenses the other's ramp, but both are real values.
        : source.signed === true || source.logScale === true;
      for (let index = 0; index < column.length; index += 1) {
        const value = column[index];
        if (value === null) continue;
        if (typeof value !== 'number' || !Number.isFinite(value) || (value < 0 && !mayBeNegative)
          || (bounds?.integral && !Number.isInteger(value))
          || (bounds?.unitInterval && (value < 0 || value > 1))) {
          throw new Error(`expression_layers.json has an invalid value for ${source.metricKey}`);
        }
        genes[index][source.metricKey] = value;
      }
    }
  },

  goIeaEssentiality(dataset, goIeaEssentiality) {
    if (goIeaEssentiality) {
      validateGoIeaEssentiality(
        goIeaEssentiality, dataset.genes, dataset.candidateEvidence,
        dataset.meta.annotationRelease?.releaseId,
      );
    }
    dataset.goIeaEssentiality = goIeaEssentiality ?? null;
  },

  goTerms(dataset, goTerms) {
    if (goTerms && (goTerms.schemaVersion !== 1 || !goTerms.terms
      || typeof goTerms.terms !== 'object' || Array.isArray(goTerms.terms))) {
      throw new Error('go-term-names-v1.json has an invalid lookup schema');
    }
    if (goTerms) {
      for (const gene of dataset.genes) {
        for (const relation of gene.annotationEvidence?.goAnnotations ?? []) {
          if (!goTerms.terms[relation.goId]?.name) {
            throw new Error(`go-term-names-v1.json has no name for ${relation.goId}`);
          }
        }
      }
    }
    dataset.goTerms = goTerms;
  },

  regulatoryTss(dataset, regulatoryTss) {
    if (regulatoryTss) validateRegulatoryTss(regulatoryTss, dataset.genes);
    dataset.regulatoryTss = regulatoryTss;
  },

  trnaLoci(dataset, trnaLoci) {
    if (trnaLoci) {
      validateTrnaPayload(trnaLoci, {
        organismId: dataset.organism?.id ?? null,
        assembly: dataset.meta.genome?.accession ?? null,
      });
    }
    dataset.trnaLoci = trnaLoci;
  },

  // Whole-strain measurements. The file declares the organism and assembly it
  // belongs to and is checked against this dataset's, because the layer is
  // organism-neutral and so nothing else would catch a file published into the
  // wrong data directory. It joins nothing onto a gene.
  strainFitness(dataset, strainFitness) {
    dataset.strainFitness = strainFitness ? validateStrainFitness(strainFitness, dataset) : null;
  },
});

/**
 * Read a response body, reporting the bytes as they arrive.
 *
 * The stream yields decoded bytes whatever compression the host applied, so
 * the count is comparable with the manifest's sizes. A response with no
 * readable body, which is what a test double returns, is parsed whole and
 * carries no bytes to verify.
 *
 * @returns {Promise<{data: any}|{raw: Uint8Array}>}
 */
async function readBody(response, onBytes) {
  const reader = response.body?.getReader?.();
  if (!reader) return { data: await response.json() };
  const chunks = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    bytes += value.byteLength;
    onBytes(bytes);
  }
  const raw = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    raw.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { raw };
}

/**
 * Whether the bytes received are the file the manifest entry names.
 *
 * Size first, because it is free. Then the digest, because two releases of a
 * file can be the same length, and a copy that is the right size and the wrong
 * content is exactly the stale copy a content-addressed cache must never show.
 * Where the platform has no `crypto.subtle`, which is a page served over plain
 * HTTP from a host other than localhost, the size is all there is to check.
 */
async function matchesManifest(raw, entry) {
  if (raw.byteLength !== entry.bytes) return false;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return true;
  const digest = new Uint8Array(await subtle.digest('SHA-256', raw));
  let hex = '';
  for (const byte of digest) hex += byte.toString(16).padStart(2, '0');
  return hex === entry.sha256;
}

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * How many bytes of the earlier tiers may still be outstanding when a tier's
 * requests go out.
 *
 * Asking for every file at once shares the connection between them, so the gene
 * file, which is the largest and the one the map waits for, finishes last: on a
 * throttled link the map became usable at the same moment as everything else.
 * Each tier is therefore released only when the tiers before it are all but in.
 *
 * The lead exists for one reason, to cover the round trip a new request needs
 * before its first byte, so the connection is never idle between tiers and the
 * total time stays what it was. It is a byte count rather than a fraction
 * because the cost of releasing early is paid on what remains: at 85% the gene
 * file's last 780 kB shared the link with five files and took 4.6 s on the
 * throttled profile. 128 kB is under a fifth of a second of that link.
 */
export const TIER_LEAD_BYTES = 128 * 1024;

/**
 * The order the single-step loader met its checks in, so that `loadDataset`
 * reports the same failure when more than one file is wrong.
 *
 * A file added after that loader existed goes last: it has no historical place
 * in the order, and leaving it out would let `loadDataset` return a dataset
 * whose layer failed without reporting it.
 */
const LEGACY_FAILURE_ORDER = Object.freeze([
  'lengthCohorts', 'regulatoryTss', 'candidateEvidence', 'goIeaEssentiality', 'annotations',
  'goTerms', 'sourceDerivedCategories', 'tssEvidence', 'expressionLayers', 'codonPca',
  'codonPcaReference', 'excluded', 'strainFitness', 'trnaLoci', 'sequenceContext',
]);

/**
 * Refuse a data directory that holds another organism's assembly.
 *
 * The address names the organism, and every label on the page follows the
 * address. Data from a different assembly drawn under those labels would be
 * one organism's genes presented as another's, so it is a failed load.
 */
function requireGenomeOfRecord(meta, organism) {
  const accession = meta?.genome?.accession;
  if (accession !== organism.genome.accession) {
    throw new Error(`this data directory holds assembly ${accession ?? 'none'}, not `
      + `${organism.genome.accession}, the genome of record for ${organism.label}`);
  }
}

/**
 * The expression sources whose values arrive in `expression_layers.json`
 * rather than in the gene file. A source that names no payload is in the gene
 * file, which is where the two original measurements have always been.
 */
export function layerPayloadSources(meta) {
  return (meta?.expressionSources ?? [])
    .filter((source) => source?.payload === 'expression_layers.json');
}

/**
 * Start loading every file, and report each as it lands.
 *
 * Nothing here waits for anything it does not need: all requests go out as
 * soon as the manifest is read, `core` resolves when the tier 1 files are
 * indexed, and every later file is validated and joined onto that same dataset
 * on arrival. No promise on the returned object rejects except `core`.
 *
 * @param {{baseUrl: URL|string, fetchImpl?: typeof fetch,
 *   onProgress?: (snapshot: object) => void,
 *   onFile?: (key: string, record: object) => void,
 *   lenientOptional?: boolean, now?: () => number, organism?: object|null}} options
 *   `lenientOptional` treats an optional file that could not be fetched as
 *   absent, which is what the single-step loader did; the page leaves it off so
 *   a failed request stays distinguishable from a file that is not published.
 *   `organism` is the registry record the page is showing. With it the loader
 *   refuses a data directory that holds another organism's assembly, never
 *   requests a study-bound layer the record does not declare, and stamps the
 *   dataset with the record. Without it nothing is checked or stamped, which
 *   is how tools and tests load a directory on its own terms.
 * @returns {{manifest: Promise<object|null>, core: Promise<object>,
 *   settled: Promise<object|null>, files: object,
 *   when: (keys: string[]) => Promise<void>, retry: (key: string) => boolean,
 *   snapshot: () => object}}
 */
export function loadDatasetStaged({
  baseUrl, fetchImpl = fetch, onProgress = null, onFile = null, lenientOptional = false,
  now = defaultNow, organism = null,
} = {}) {
  /** Whether this organism publishes a file at all, whatever its directory holds. */
  const published = (file) => publishesFile(organism, file);
  const base = new URL(String(baseUrl), typeof document === 'undefined' ? 'file:///' : document.baseURI);
  const startedAt = now();
  const files = {};
  for (const file of DATA_FILES) {
    files[file.key] = {
      state: FILE_STATE.LOADING, error: null, blockedBy: null, receivedBytes: 0, bytes: null,
      startedAt: null, endedAt: null,
    };
  }
  let manifestValue = null;
  let manifestSettled = false;
  let dataset = null;

  // One gate per later tier, opened by `releaseTiers` below.
  const fetched = new Set();
  const gates = {};
  for (const file of DATA_FILES) {
    if (file.tier > 1 && !gates[file.tier]) {
      let open;
      const promise = new Promise((resolve) => { open = resolve; });
      gates[file.tier] = { promise, open, opened: false };
    }
  }
  const openGate = (tier) => {
    gates[tier].opened = true;
    gates[tier].open();
  };
  /**
   * Open every tier whose earlier tiers have arrived, or nearly. Tiers open in
   * order, so a later one never starts ahead of the one before it.
   */
  const releaseTiers = () => {
    for (const tier of Object.keys(gates).map(Number).sort((a, b) => a - b)) {
      if (gates[tier].opened) continue;
      const earlier = DATA_FILES.filter((file) => file.tier < tier);
      let received = 0;
      let total = 0;
      for (const file of earlier) {
        const size = files[file.key].bytes ?? 0;
        total += size;
        received += fetched.has(file.key) ? size : Math.min(files[file.key].receivedBytes, size);
      }
      const arrived = earlier.every((file) => fetched.has(file.key));
      if (!arrived && total - received > TIER_LEAD_BYTES) return;
      openGate(tier);
    }
  };

  /** Bytes and files so far, for the loading bar. */
  const snapshot = () => {
    let receivedBytes = 0;
    let totalBytes = 0;
    let actualReceivedBytes = 0;
    let publishedBytes = 0;
    let settledFiles = 0;
    let registeredFiles = 0;
    let completedPreparation = 0;
    const tiers = {};
    const perFile = {};
    for (const file of DATA_FILES) {
      const record = files[file.key];
      const settled = record.state !== FILE_STATE.LOADING;
      const manifestEntry = manifestValue?.files.get(file.name) ?? null;
      const included = published(file) && (!manifestValue || manifestEntry !== null
        || record.state === FILE_STATE.FAILED);
      const tier = (tiers[file.tier] ??= { settled: 0, total: 0 });
      tier.total += 1;
      if (settled) {
        tier.settled += 1;
        settledFiles += 1;
      }
      const size = record.bytes ?? 0;
      totalBytes += size;
      // A settled file counts whole, whatever became of it: a file that is not
      // published, or that failed, must not hold the bar short of full.
      const received = settled ? size : Math.min(record.receivedBytes, size || Infinity);
      receivedBytes += received;
      const actual = included ? Math.min(record.receivedBytes, size || Infinity) : 0;
      if (included) {
        registeredFiles += 1;
        if (settled) completedPreparation += 1;
        actualReceivedBytes += actual;
        publishedBytes += size;
      }
      perFile[file.key] = {
        receivedBytes: received,
        actualReceivedBytes: actual,
        bytes: size,
        settled,
        state: record.state,
        included,
        label: file.name,
      };
    }
    const pending = DATA_FILES.find((file) => files[file.key].state === FILE_STATE.LOADING);
    return {
      receivedBytes,
      totalBytes,
      // Truthful transfer counters never turn settlement into bytes. These are
      // separate from the legacy presentation counters above on purpose.
      actualReceivedBytes,
      publishedBytes,
      worksetKnown: manifestSettled,
      registeredFiles,
      allTransfersComplete: manifestSettled && Object.values(perFile)
        .filter((record) => record.included)
        .every((record) => (record.bytes > 0
          ? record.actualReceivedBytes >= record.bytes : record.settled)),
      preparation: {
        registered: registeredFiles,
        completed: completedPreparation,
        currentLabel: Object.values(perFile).find((record) => record.included && !record.settled)?.label ?? null,
      },
      // Sizes are exact only when the manifest supplied them up front.
      exact: manifestValue !== null,
      settledFiles,
      totalFiles: DATA_FILES.length,
      // Per file, so a reader can report progress over the files it waits for
      // rather than over everything.
      files: perFile,
      tiers,
      currentTier: pending ? pending.tier : null,
      elapsedMs: now() - startedAt,
    };
  };
  const report = () => onProgress?.(snapshot());

  const settle = (key, state, error = null, blockedBy = null) => {
    const record = files[key];
    record.state = state;
    record.error = error;
    record.blockedBy = blockedBy;
    record.endedAt = now();
    if (record.bytes === null) record.bytes = record.receivedBytes;
    onFile?.(key, record);
    report();
  };

  const manifest = (async () => {
    try {
      const response = await fetchImpl(new URL(DATA_MANIFEST_NAME, base).href,
        { cache: 'no-cache', priority: 'high' });
      if (!response.ok) return null;
      manifestValue = normalizeManifest(await response.json());
    } catch {
      manifestValue = null;
    }
    manifestSettled = true;
    if (manifestValue) {
      for (const file of DATA_FILES) {
        files[file.key].bytes = published(file)
          ? manifestValue.files.get(file.name)?.bytes ?? 0 : 0;
      }
      report();
    } else {
      // No sizes to pace by, so every file is asked for at once, as before.
      for (const tier of Object.keys(gates)) openGate(tier);
    }
    return manifestValue;
  })();

  /**
   * Fetch and parse one file. Resolves to `{data}`, `{absent: true}`, or
   * `{error, kind}` and never rejects.
   */
  const fetchFile = async (file, { fresh = false } = {}) => {
    // A study-bound layer this organism does not declare is not its evidence,
    // so it is absent without a request, even if a file of that name is there.
    // Decided before any wait, so the bar never names a tier as in flight for it.
    if (!published(file)) return { absent: true };
    const known = await manifest;
    // A retry is one file asked for on its own; it has no tier to wait behind.
    if (file.tier > 1 && !fresh) await gates[file.tier].promise;
    const entry = known?.files.get(file.name) ?? null;
    const record = files[file.key];
    record.startedAt = now();
    // The manifest lists everything this deployment publishes, so an optional
    // file it does not list is absent and needs no request to find that out.
    if (known && !entry && !file.required) return { absent: true };
    const request = dataRequest(base, file.name, entry, file.tier);
    const attempt = async (url, init) => {
      let response;
      try {
        response = await fetchImpl(url, init);
      } catch (cause) {
        return {
          error: new Error(`could not read ${request.plainUrl}: ${cause.message}`, { cause }),
          kind: 'fetch',
        };
      }
      if (!response.ok) {
        // Not found means not published only when no manifest says otherwise.
        // A file the manifest lists exists, so a 404 for it is a deployment
        // fault to report and retry, never evidence that is absent.
        if (!file.required && !entry && response.status === 404) return { absent: true };
        return {
          error: new Error(`could not read ${request.plainUrl}: HTTP ${response.status}`),
          kind: 'fetch',
        };
      }
      try {
        return await readBody(response, (bytes) => {
          record.receivedBytes = bytes;
          releaseTiers();
          report();
        });
      } catch (error) {
        return { error, kind: 'parse' };
      }
    };
    // `reload` asks the server and replaces whatever the cache held under this
    // address, so a stale copy is evicted rather than left to be found again.
    const reload = { ...request.init, cache: 'reload' };
    let result = await attempt(request.url, fresh ? reload : request.init);
    // A copy that is not the file the key names is a cached copy from another
    // release, or a server that has the new manifest and not yet the new file.
    // It is asked for once more, from the server. If that is still not the
    // file the manifest names, nothing is shown: bytes that cannot be tied to
    // the published release are not data, and the file fails with a retry.
    if (entry && result.raw && !(await matchesManifest(result.raw, entry))) {
      if (!fresh) result = await attempt(request.url, reload);
      if (result.raw && !(await matchesManifest(result.raw, entry))) {
        return {
          error: new Error(`${request.plainUrl} does not match the published data manifest; `
            + 'the site may be mid-update'),
          kind: 'integrity',
        };
      }
    }
    if (!result.raw) return result;
    record.receivedBytes = result.raw.byteLength;
    try {
      return { data: JSON.parse(new TextDecoder().decode(result.raw)) };
    } catch (error) {
      return { error, kind: 'parse' };
    }
  };

  /** A file's request has finished, whatever it returned: the next tier may be due. */
  const requested = (file, options) => fetchFile(file, options).finally(() => {
    fetched.add(file.key);
    releaseTiers();
  });
  const raw = {};
  for (const file of DATA_FILES) raw[file.key] = requested(file);

  const core = (async () => {
    const results = {};
    await Promise.all(CORE_FILE_KEYS.map(async (key) => {
      results[key] = await raw[key];
    }));
    const failCore = (error) => {
      for (const key of CORE_FILE_KEYS) {
        if (files[key].state === FILE_STATE.LOADING) settle(key, FILE_STATE.FAILED, error);
      }
      throw error;
    };
    for (const key of CORE_FILE_KEYS) {
      const result = results[key];
      const file = DATA_FILE_BY_KEY[key];
      if (!result.error) continue;
      if (lenientOptional && !file.required && result.kind === 'fetch') {
        results[key] = { absent: true };
        continue;
      }
      settle(key, FILE_STATE.FAILED, result.error);
      failCore(result.error);
    }
    try {
      if (organism) requireGenomeOfRecord(results.meta.data, organism);
      dataset = buildCoreDataset(
        results.meta.data, results.genes.data,
        results.functionCategories.absent ? null : results.functionCategories.data,
      );
    } catch (error) {
      failCore(error);
    }
    dataset.files = files;
    if (organism) dataset.organism = organism;
    for (const key of CORE_FILE_KEYS) {
      settle(key, results[key].absent ? FILE_STATE.ABSENT : FILE_STATE.READY);
    }
    return dataset;
  })();
  // `core` is the one promise callers are expected to catch; the bookkeeping
  // below must not turn its rejection into an unhandled one of its own.
  const coreSettled = core.then(() => true, () => false);

  const applied = {};
  const applyFile = (file) => (async () => {
    const coreOk = await coreSettled;
    await Promise.all(file.needs.map((key) => applied[key]));
    let result = await raw[file.key];
    // A file this one reads may have been retried while this one was still
    // downloading. Applying now would validate against data that is on its way,
    // and fail for a reason no retry of this file could fix.
    while (file.needs.some((key) => files[key].state === FILE_STATE.LOADING)) {
      await Promise.all(file.needs.map((key) => applied[key]));
    }
    if (!coreOk) {
      settle(file.key, FILE_STATE.FAILED,
        new Error(`${file.name} was not read because the gene data could not be loaded`),
        CORE_FILE_KEYS[1]);
      return;
    }
    const blocker = file.needs.find((key) => files[key].state === FILE_STATE.FAILED);
    if (blocker) {
      settle(file.key, FILE_STATE.FAILED,
        new Error(`${file.name} is waiting on ${DATA_FILE_BY_KEY[blocker].name}, `
          + 'which could not be loaded'), blocker);
      return;
    }
    if (result.error && lenientOptional && result.kind === 'fetch') result = { absent: true };
    if (result.error) {
      settle(file.key, FILE_STATE.FAILED, result.error);
      return;
    }
    try {
      DATA_APPLIERS[file.key](dataset, result.absent ? null : result.data);
    } catch (error) {
      settle(file.key, FILE_STATE.FAILED, error);
      return;
    }
    settle(file.key, result.absent ? FILE_STATE.ABSENT : FILE_STATE.READY);
  })();
  const later = DATA_FILES.filter((file) => !CORE_FILE_KEYS.includes(file.key));
  for (const file of later) applied[file.key] = applyFile(file);

  const promiseFor = (key) => (CORE_FILE_KEYS.includes(key) ? coreSettled : applied[key]);

  /**
   * Ask again for one later file that failed, and re-run the files that were
   * waiting on it. Returns false when there is nothing to retry: an unknown
   * key, a tier 1 file (the page reloads the whole dataset for those), or a
   * file that did not fail.
   */
  const retry = (key) => {
    const file = DATA_FILE_BY_KEY[key];
    if (!file || CORE_FILE_KEYS.includes(key) || files[key].state !== FILE_STATE.FAILED) return false;
    const reset = (target) => {
      Object.assign(files[target.key], {
        state: FILE_STATE.LOADING, error: null, blockedBy: null, endedAt: null,
      });
    };
    const waiting = later.filter((other) => files[other.key].blockedBy === key);
    reset(file);
    files[key].receivedBytes = 0;
    raw[key] = requested(file, { fresh: true });
    applied[key] = applyFile(file);
    for (const other of waiting) {
      reset(other);
      applied[other.key] = applyFile(other);
    }
    report();
    return true;
  };

  return {
    manifest,
    core,
    files,
    snapshot,
    retry,
    when: (keys) => Promise.all(keys.map(promiseFor)).then(() => undefined),
    get settled() {
      return Promise.all([coreSettled, ...later.map((file) => applied[file.key])])
        .then(() => dataset);
    },
  };
}

/**
 * Load and index the whole dataset in one step.
 *
 * The staged loader awaited to the end, with a failure in any file thrown as
 * the single-step loader threw it. Tools and tests that want every file
 * validated before they read anything use this.
 *
 * @param {{baseUrl: URL|string, fetchImpl?: typeof fetch, organism?: object|null}} options
 */
export async function loadDataset({ baseUrl, fetchImpl = fetch, organism = null }) {
  const staged = loadDatasetStaged({ baseUrl, fetchImpl, organism, lenientOptional: true });
  const dataset = await staged.core;
  await staged.settled;
  const failed = (key) => dataset.files[key].state === FILE_STATE.FAILED;
  // A file blocked by another names a consequence; the cause is thrown first.
  const first = LEGACY_FAILURE_ORDER.find((key) => failed(key) && !dataset.files[key].blockedBy)
    ?? LEGACY_FAILURE_ORDER.find(failed);
  if (first) throw dataset.files[first].error;
  return dataset;
}
