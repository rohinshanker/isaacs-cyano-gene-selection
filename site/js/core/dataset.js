/**
 * Loading and indexing of the pipeline's JSON, per docs/validation/data-contract.md.
 *
 * The pipeline is the only writer of those files; everything here is read-only
 * and happens once at start-up.
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
import { validateLengthInventory } from './length-cohorts.js';
import { validateRegulatoryTss } from './regulatory-tss.js';
import { validateCandidateEvidence } from './candidate-evidence.js';
import { joinFunctionCategories } from './function-categories.js';
import { validateGoIeaEssentiality } from './go-iea-essentiality.js';

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
 * Load and index the whole dataset.
 * @param {{baseUrl: URL|string, fetchImpl?: typeof fetch}} options
 */
export async function loadDataset({ baseUrl, fetchImpl = fetch }) {
  const base = new URL(String(baseUrl), typeof document === 'undefined' ? 'file:///' : document.baseURI);
  const url = (name) => new URL(name, base).href;

  const [meta, genes, codonPca, excluded, annotations, tssEvidence, lengthCohorts,
    regulatoryTss, candidateEvidence, goTerms, functionCategoryData,
    goIeaEssentiality] = await Promise.all([
    fetchJson(fetchImpl, url('meta.json')),
    fetchJson(fetchImpl, url('genes.json')),
    fetchJson(fetchImpl, url('codon_pca.json'), { optional: true }),
    fetchJson(fetchImpl, url('excluded.json'), { optional: true }),
    fetchJson(fetchImpl, url('annotations.json'), { optional: true }),
    fetchJson(fetchImpl, url('tss_evidence.json'), { optional: true }),
    fetchJson(fetchImpl, url('length_cohorts.json'), { optional: true }),
    fetchJson(fetchImpl, url('regulatory_tss.json'), { optional: true }),
    fetchJson(fetchImpl, url('candidate_evidence.json'), { optional: true }),
    fetchJson(fetchImpl, url('go-term-names-v1.json'), { optional: true }),
    fetchJson(fetchImpl, url('function-categories-v1.json'), { optional: true }),
    fetchJson(fetchImpl, url('go-iea-essentiality-v1.json'), { optional: true }),
  ]);

  requireArray(genes, 'genes.json');
  if (genes.length === 0) throw new Error('genes.json is empty');
  if (lengthCohorts) {
    validateLengthInventory(lengthCohorts, genes, meta.annotationRelease?.releaseId);
  }
  if (regulatoryTss) validateRegulatoryTss(regulatoryTss, genes);
  if (candidateEvidence) {
    validateCandidateEvidence(candidateEvidence, genes, meta.annotationRelease?.releaseId);
  }
  if (goIeaEssentiality) {
    validateGoIeaEssentiality(
      goIeaEssentiality, genes, candidateEvidence, meta.annotationRelease?.releaseId,
    );
  }
  if (goTerms && (goTerms.schemaVersion !== 1 || !goTerms.terms
    || typeof goTerms.terms !== 'object' || Array.isArray(goTerms.terms))) {
    throw new Error('go-term-names-v1.json has an invalid lookup schema');
  }
  if (meta.annotationRelease && (!annotations || typeof annotations !== 'object')) {
    throw new Error('annotations.json is required by meta.annotationRelease');
  }
  if (meta.tssEvidenceSource && (
    !tssEvidence || typeof tssEvidence !== 'object' || Array.isArray(tssEvidence)
  )) {
    throw new Error('tss_evidence.json is required by meta.tssEvidenceSource');
  }
  if (annotations) {
    for (const gene of genes) {
      const evidence = annotations[gene.id];
      if (!evidence || typeof evidence !== 'object') {
        throw new Error(`annotations.json has no evidence for ${gene.id}`);
      }
      gene.annotationEvidence = evidence;
    }
  }
  if (goTerms && annotations) {
    for (const gene of genes) {
      for (const relation of gene.annotationEvidence.goAnnotations ?? []) {
        if (!goTerms.terms[relation.goId]?.name) {
          throw new Error(`go-term-names-v1.json has no name for ${relation.goId}`);
        }
      }
    }
  }
  const functionCategories = functionCategoryData
    ? joinFunctionCategories(functionCategoryData, genes, meta.annotationRelease?.releaseId)
    : null;
  if (tssEvidence) {
    for (const gene of genes) {
      const rows = tssEvidence[gene.id] ?? [];
      if (!Array.isArray(rows)) {
        throw new Error(`tss_evidence.json has invalid rows for ${gene.id}`);
      }
      gene.tssEvidence = rows;
    }
  }
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
    codonPca,
    excluded: excluded ?? [],
    lengthCohorts,
    regulatoryTss,
    candidateEvidence,
    goIeaEssentiality: goIeaEssentiality ?? null,
    goTerms,
    functionCategories,
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
    provenance: {
      genesWithoutTerminalStop: genesWithoutStop,
      expressionSource: meta.expressionSource ?? null,
      caiReferenceGenes: referenceGenes,
      caiReferenceFallback,
      taiReport,
      conventionReport: conventions.report,
      encFlagMismatches,
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
