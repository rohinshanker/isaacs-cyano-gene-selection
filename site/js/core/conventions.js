/**
 * Metric conventions, resolved from `meta.json` rather than hardcoded here.
 *
 * The pipeline owns every numerical convention: which amino acids a geometric
 * mean excludes, what a zero tAI weight becomes, how an unestimable synonymous
 * family is treated. The browser recomputes the same metrics so a recoded value
 * is comparable to wild type, and those two numbers describe one quantity. They
 * must therefore agree, which means the conventions have to come from the data
 * and not from a constant in this file. A convention the pipeline changes should
 * need no edit here.
 *
 * Where `meta.json` does not yet publish a convention, the fallback used is
 * recorded in `report.fallbacks` so the interface can say which numbers rest on
 * an assumption instead of on published data.
 */

/**
 * Selective-constraint values for codon-anticodon wobble pairings, keyed
 * `anticodonWobbleBase:codonThirdBase` exactly as `meta.tai.sValues` keys them.
 * A pairing contributes `copies * (1 - s)`. Values are those fitted by dos Reis
 * et al. (2004); `I` is inosine and `L` is lysidine, which is why the keys are
 * not simply DNA bases. Watson-Crick pairings need no entry: they contribute
 * their full gene copy number.
 */
export const DEFAULT_TAI_S_VALUES = Object.freeze({
  'I:T': 0, 'I:C': 0.28, 'I:A': 0.9999, 'G:T': 0.41, 'T:G': 0.68, 'L:A': 0.89,
});

/** Additive smoothing for codon-pair log odds when `meta` does not publish one. */
export const DEFAULT_CPS_SMOOTHING = 0.5;

/** Half-count adjustment for absent reference codons when `meta` omits it. */
export const DEFAULT_CAI_ZERO_COUNT_ADJUSTMENT = 0.5;

/**
 * Largest difference tolerated between a pipeline value and the browser's
 * recomputation of the same quantity. `genes.json` publishes six decimals, so
 * rounding alone can reach 5e-7; anything above this is a convention that the
 * two sides do not share, not a floating-point artefact.
 */
export const RECOMPUTATION_TOLERANCE = 1e-6;

/**
 * Codon index that position zero is counted as, whatever triplet is there.
 *
 * Bacterial genes initiate at ATG, GTG, TTG and occasionally others, and all of
 * them put methionine at position zero. A codon-usage metric must therefore not
 * charge a literal GTG start to the valine family. Resolved from the genetic
 * code rather than written as `'ATG'` so the rule reads as what it means.
 */
export function resolveInitiatorIndex(table) {
  const methionine = table.family.get('M');
  if (!methionine || methionine.length !== 1) {
    throw new Error('the genetic code must have exactly one methionine codon to place the initiator');
  }
  return methionine[0];
}

/**
 * Move one count from the literal initiation triplet to the initiator codon.
 *
 * `counts` must already include the gene's position-zero codon. Safe to call
 * when the start already is the initiator; it then does nothing.
 */
export function applyInitiatorConvention(counts, startCodonIndex, initiatorIndex) {
  if (startCodonIndex === initiatorIndex) return;
  counts[startCodonIndex] -= 1;
  counts[initiatorIndex] += 1;
}

/** Amino acids with a single codon, which no synonymous substitution can reach. */
function nonDegenerateAminoAcids(table) {
  const result = [];
  for (const [aa, indices] of table.family) {
    if (aa !== '*' && indices.length === 1) result.push(aa);
  }
  return result;
}

/**
 * Codon mask for a list of amino-acid letters.
 * @returns {{mask: Uint8Array, unknown: string[]}} `unknown` names letters the
 *   genetic code does not have, which would otherwise be excluded silently.
 */
function maskForAminoAcids(table, aminoAcids) {
  const mask = new Uint8Array(64);
  const unknown = [];
  for (const aa of aminoAcids) {
    const family = table.family.get(aa);
    if (!family) {
      unknown.push(aa);
      continue;
    }
    for (const index of family) mask[index] = 1;
  }
  return { mask, unknown };
}

function stringList(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
}

/**
 * Resolve every metric convention the browser needs.
 *
 * @param {object} meta parsed `meta.json`.
 * @param {import('./codon-table.js').CodonTable} table
 * @returns {object} the resolved conventions plus a `report` describing where
 *   each one came from.
 */
export function resolveConventions(meta, table) {
  const fallbacks = [];
  const fromMeta = [];
  const note = (published, label, detail) => {
    (published ? fromMeta : fallbacks).push({ label, detail });
    return published;
  };

  const taiExcludedNames = stringList(meta?.tai?.excludedAminoAcids);
  note(taiExcludedNames !== null, 'tAI excluded amino acids',
    taiExcludedNames
      ? `meta.tai.excludedAminoAcids = ${JSON.stringify(taiExcludedNames)}`
      : 'meta.tai.excludedAminoAcids is absent, so methionine is excluded per dos Reis');
  const taiExcluded = maskForAminoAcids(table, taiExcludedNames ?? ['M']);

  // CAI is defined over degenerate families only: a codon with no synonym carries
  // no adaptation signal. The pipeline names methionine and tryptophan; deriving
  // the same set from the genetic code keeps that true if the code ever changes.
  const caiExcludedNames = stringList(meta?.cai?.excludedAminoAcids);
  note(caiExcludedNames !== null, 'CAI excluded amino acids',
    caiExcludedNames
      ? `meta.cai.excludedAminoAcids = ${JSON.stringify(caiExcludedNames)}`
      : 'meta.cai.excludedAminoAcids is absent, so the non-degenerate amino acids '
        + `(${nonDegenerateAminoAcids(table).join(', ')}) are excluded`);
  const caiExcluded = maskForAminoAcids(table, caiExcludedNames ?? nonDegenerateAminoAcids(table));

  const publishedAdjustment = meta?.caiReferenceSet?.zeroCountAdjustment;
  const caiZeroCountAdjustment = note(Number.isFinite(publishedAdjustment),
    'CAI zero-count adjustment',
    Number.isFinite(publishedAdjustment)
      ? `meta.caiReferenceSet.zeroCountAdjustment = ${publishedAdjustment}`
      : `not published, so the Sharp and Li ${DEFAULT_CAI_ZERO_COUNT_ADJUSTMENT} half count is used`)
    ? publishedAdjustment
    : DEFAULT_CAI_ZERO_COUNT_ADJUSTMENT;

  const publishedSmoothing = meta?.cps?.smoothing;
  const cpsSmoothing = note(Number.isFinite(publishedSmoothing), 'Codon-pair smoothing',
    Number.isFinite(publishedSmoothing)
      ? `meta.cps.smoothing = ${publishedSmoothing}`
      : `not published, so both counts take the additive ${DEFAULT_CPS_SMOOTHING} the pipeline uses`)
    ? publishedSmoothing
    : DEFAULT_CPS_SMOOTHING;

  const sValues = { ...DEFAULT_TAI_S_VALUES };
  const sSupplied = [];
  for (const [key, value] of Object.entries(meta?.tai?.sValues ?? {})) {
    if (!Number.isFinite(value)) continue;
    sValues[key] = value;
    sSupplied.push(key);
  }
  const sDefaulted = Object.keys(DEFAULT_TAI_S_VALUES).filter((key) => !sSupplied.includes(key));
  note(sSupplied.length > 0, 'tAI selective constraints',
    sSupplied.length > 0
      ? `meta.tai.sValues supplies ${sSupplied.length} pairing${sSupplied.length === 1 ? '' : 's'}`
        + ` (${sSupplied.join(', ')})`
      : 'meta.tai.sValues is absent, so the dos Reis fitted values are used throughout');

  const publishedSubstitution = meta?.tai?.zeroWeightSubstitution;
  note(Number.isFinite(publishedSubstitution), 'tAI zero-weight substitution',
    Number.isFinite(publishedSubstitution)
      ? `meta.tai.zeroWeightSubstitution = ${publishedSubstitution}`
      : 'not published, so it is recomputed as the geometric mean of the non-zero weights');

  const publishedZeroWeightCodons = stringList(meta?.tai?.zeroWeightCodons);

  // The initiator convention is not a published flag. It follows from the
  // contract's own start-codon rule, so it is recorded as an assumption.
  fallbacks.push({
    label: 'Initiation codon in codon-usage metrics',
    detail: 'Position zero is counted as methionine for CAI, tAI, ENC and codon-pair '
      + 'score, because every bacterial start translates as methionine. GC3 uses the '
      + 'literal triplet. No meta.json field states this, so it follows the contract '
      + 'section on start codons.',
  });

  return {
    initiatorIndex: resolveInitiatorIndex(table),
    tai: {
      excludedMask: taiExcluded.mask,
      excludedAminoAcids: taiExcludedNames ?? ['M'],
      sValues,
      publishedSubstitution: Number.isFinite(publishedSubstitution) ? publishedSubstitution : null,
      publishedZeroWeightCodons,
      lysidineConvention: typeof meta?.tai?.lysidineConvention === 'string'
        ? meta.tai.lysidineConvention : null,
    },
    cai: {
      excludedMask: caiExcluded.mask,
      excludedAminoAcids: caiExcludedNames ?? nonDegenerateAminoAcids(table),
      zeroCountAdjustment: caiZeroCountAdjustment,
    },
    cps: { smoothing: cpsSmoothing },
    enc: {
      familyConvention: typeof meta?.encFamilyConvention === 'string'
        ? meta.encFamilyConvention : null,
    },
    report: {
      fromMeta,
      fallbacks,
      sSupplied,
      sDefaulted,
      unknownExcludedAminoAcids: [...taiExcluded.unknown, ...caiExcluded.unknown],
    },
  };
}
