/**
 * Observed properties of a deposited recoded genome.
 *
 * These counts describe the sequence on screen, not a simulated scheme and not
 * a historical edit manifest. A model is returned only when the organism
 * explicitly declares recoding metadata and the loaded assembly matches it.
 */

export const RESIDUAL_TARGET_CODONS_KEY = 'residualTargetCodons';

/**
 * Count declared target codons in every included CDS.
 *
 * The packed string is the decoded codon body, including the annotated start
 * triplet and excluding the terminal stop. A declared target terminal stop is
 * then counted once from `stopCodons`. This is intentionally different from a
 * simulated edit count, which skips the start triplet.
 *
 * @returns {Float64Array|null} null when the required sequence fields or target
 *   declarations are unavailable.
 */
export function residualTargetCodonCounts(dataset, targets) {
  if (!dataset || !Array.isArray(targets) || targets.length === 0
    || !(dataset.packed instanceof Uint8Array)
    || !(dataset.offsets instanceof Int32Array)
    || !(dataset.stopCodons instanceof Int8Array)
    || dataset.offsets.length !== dataset.genes?.length + 1
    || dataset.stopCodons.length !== dataset.genes.length) return null;

  const targetIndexes = new Set();
  for (const codon of targets) {
    const index = dataset.table?.indexOf(codon) ?? -1;
    if (index < 0 || targetIndexes.has(index)) return null;
    targetIndexes.add(index);
  }

  const values = new Float64Array(dataset.genes.length);
  for (let gene = 0; gene < values.length; gene += 1) {
    const start = dataset.offsets[gene];
    const end = dataset.offsets[gene + 1];
    if (!Number.isInteger(start) || !Number.isInteger(end)
      || start < 0 || end < start || end > dataset.packed.length) return null;
    let count = 0;
    for (let position = start; position < end; position += 1) {
      if (targetIndexes.has(dataset.packed[position])) count += 1;
    }
    if (targetIndexes.has(dataset.stopCodons[gene])) count += 1;
    values[gene] = count;
  }
  return values;
}

/** Sum a complete residual-count column. */
export function residualTargetCodonTotal(values) {
  if (!(values instanceof Float64Array)) return null;
  let total = 0;
  for (const value of values) {
    if (!Number.isInteger(value) || value < 0) return null;
    total += value;
  }
  return total;
}

/**
 * Build the panel facts and fixed metric for one explicitly recoded organism.
 * Native organisms, mismatched assemblies, and incomplete declarations all
 * return null: missing recoded data never creates an empty metric or panel.
 */
export function buildRecodedGenomeModel(organism, dataset) {
  const declaration = organism?.recoding;
  if (!declaration || dataset?.meta?.genome?.accession !== organism.genome?.accession) return null;
  if (typeof declaration.schemeName !== 'string' || typeof declaration.scope !== 'string'
    || typeof declaration.source !== 'string' || typeof declaration.replacementNote !== 'string') {
    return null;
  }
  const targets = Array.isArray(declaration.targets) ? [...declaration.targets] : [];
  const values = residualTargetCodonCounts(dataset, targets);
  const total = residualTargetCodonTotal(values);
  if (!values || total === null) return null;

  const metric = {
    key: RESIDUAL_TARGET_CODONS_KEY,
    label: 'Residual target codons',
    unit: 'codons',
    family: 'Recoded genome',
    scale: 'sequential',
    source: 'organism',
    integer: true,
    desc: `Observed ${targets.join(', ')} codons in the deposited CDS codon body, including the `
      + 'annotated start triplet, plus a terminal target stop counted once per gene. Zero means '
      + 'no declared target remains in that included gene; it is not missing data.',
    read: (index) => values[index],
  };
  return {
    schemeName: declaration.schemeName,
    targets,
    scope: declaration.scope,
    source: declaration.source,
    replacements: declaration.replacements,
    replacementNote: declaration.replacementNote,
    values,
    total,
    includedGeneCount: dataset.genes.length,
    metric,
  };
}
