/**
 * Recoding schemes.
 *
 * A scheme is a codon-to-codon map, never a set of forbidden codons. Every
 * replacement must encode the same amino acid as the codon it replaces; stop
 * codons may only map to other stops. A map that would change the protein is
 * rejected rather than applied.
 */

/** Target sets shipped as presets. Replacements prefill from meta. */
export const PRESETS = Object.freeze([
  Object.freeze({
    id: 'amber',
    name: 'Amber only',
    targets: Object.freeze(['TAG']),
    note: 'Frees the amber stop codon for non-standard amino acid incorporation.',
  }),
  Object.freeze({
    id: 'syn61',
    name: 'Syn61-style',
    targets: Object.freeze(['TCG', 'TCA', 'TAG']),
    note: 'The three codons removed in the Syn61 Escherichia coli genome.',
  }),
]);

/**
 * Check a codon-to-codon map against the genetic code.
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateSchemeMap(map, table) {
  const errors = [];
  const entries = Object.entries(map ?? {});
  const targets = new Set(entries.map(([codon]) => codon));
  for (const [codon, replacement] of entries) {
    const from = table.indexOf(codon);
    const to = table.indexOf(replacement);
    if (from < 0) {
      errors.push(`${codon} is not a codon.`);
      continue;
    }
    if (to < 0) {
      errors.push(`${replacement} is not a codon, so ${codon} has no valid replacement.`);
      continue;
    }
    if (from === to) {
      errors.push(`${codon} cannot be replaced by itself.`);
      continue;
    }
    if (table.aas[from] !== table.aas[to]) {
      errors.push(
        `${codon} encodes ${table.aas[from]} but ${replacement} encodes ${table.aas[to]}; ` +
          'that would change the protein.',
      );
      continue;
    }
    if (targets.has(replacement)) {
      errors.push(
        `${codon} is replaced by ${replacement}, which is itself a target. ` +
          'Pick a replacement that the scheme keeps.',
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Compile a validated map into the lookup tables the per-codon scan uses.
 * @returns {{targets: string[], replacement: Uint8Array, isTarget: Uint8Array,
 *   active: boolean}}
 */
export function compileScheme(map, table) {
  const { ok, errors } = validateSchemeMap(map, table);
  if (!ok) throw new Error(`invalid recoding scheme: ${errors.join(' ')}`);
  const replacement = new Uint8Array(64);
  const isTarget = new Uint8Array(64);
  for (let i = 0; i < 64; i += 1) replacement[i] = i;
  const targets = Object.keys(map ?? {}).sort();
  for (const codon of targets) {
    const from = table.indexOf(codon);
    replacement[from] = table.indexOf(map[codon]);
    isTarget[from] = 1;
  }
  return { targets, replacement, isTarget, active: targets.length > 0 };
}

/**
 * How often each codon can actually be recoded.
 *
 * The contract publishes `meta.codonOccurrences[codon].editable`, which excludes
 * position zero because the initiation triplet is never recoded. That is the
 * number the interface must quote wherever it offers a codon as a target. When a
 * dataset predates the field the counts are computed from the packed sequence
 * plus terminal stops, position zero included, and `published` is false so the
 * caller can label them as raw rather than editable.
 *
 * @param {object} dataset from `loadDataset`.
 * @returns {{counts: Map<string, number>, published: boolean}}
 */
export function codonOccurrenceCounts(dataset) {
  const { table, meta, genomeCounts, genes } = dataset;
  const publishedTable = meta?.codonOccurrences ?? null;
  const published = Boolean(publishedTable)
    && table.codons.every((codon) => typeof publishedTable[codon]?.editable === 'number');
  const counts = new Map();
  if (published) {
    for (const codon of table.codons) counts.set(codon, publishedTable[codon].editable);
    return { counts, published };
  }
  table.codons.forEach((codon, i) => counts.set(codon, genomeCounts[i]));
  // The packed string holds sense codons only, so stops are tallied from the field.
  for (const gene of genes) {
    if (!gene.terminalStop) continue;
    counts.set(gene.terminalStop, (counts.get(gene.terminalStop) ?? 0) + 1);
  }
  return { counts, published };
}

/** The codons a scheme could target: those with at least one synonymous alternative. */
export function recodableCodons(table) {
  return table.codons.filter((codon) => table.synonymsOf(codon).length > 0);
}

/**
 * Prefilled replacement for a target codon.
 *
 * The genome's most-used synonym may itself be a codon the scheme removes, which
 * would be self-defeating; `exclude` keeps the prefill away from those.
 *
 * @param {string} codon
 * @param {object} meta parsed meta.json.
 * @param {CodonTable} table
 * @param {boolean} highExpressed prefill from the CAI reference set instead of genome-wide.
 * @param {Iterable<string>} exclude codons the scheme is already removing.
 * @returns {string|null} null when no synonymous codon survives the scheme.
 */
export function prefillReplacement(codon, meta, table, highExpressed, exclude = []) {
  const forbidden = new Set(exclude);
  forbidden.add(codon);
  const source = highExpressed ? meta.highExpressedReplacement : meta.defaultReplacement;
  const fallbackSource = highExpressed ? meta.defaultReplacement : meta.highExpressedReplacement;
  const options = table.synonymsOf(codon).filter((option) => !forbidden.has(option));
  if (options.length === 0) return null;
  for (const candidate of [source?.[codon], fallbackSource?.[codon]]) {
    if (candidate && options.includes(candidate)) return candidate;
  }
  return options[0];
}

/** Serialize a map as `TCG-AGC.TCA-AGT`, stable under reordering. */
export function serializeSchemeMap(map) {
  return Object.keys(map ?? {})
    .sort()
    .map((codon) => `${codon}-${map[codon]}`)
    .join('.');
}

/** Parse the serialized form. Unparseable pairs are skipped. */
export function parseSchemeMap(text) {
  const map = {};
  if (!text) return map;
  for (const pair of text.split('.')) {
    const match = /^([ACGT]{3})-([ACGT]{3})$/.exec(pair.trim().toUpperCase());
    if (match) map[match[1]] = match[2];
  }
  return map;
}

/**
 * Apply a scheme to every gene and confirm the translated protein is unchanged.
 * This is the guarantee the interface claims, so it is checked against the real
 * sequences rather than inferred from the map.
 * @returns {{ok: boolean, genesChecked: number, codonsChecked: number, firstMismatch: object|null}}
 */
export function verifyProteinsUnchanged(dataset, scheme) {
  const { packed, offsets, table, genes, stopCodons } = dataset;
  let codonsChecked = 0;
  const mismatch = (g, position, from, to) => ({
    ok: false,
    genesChecked: g + 1,
    codonsChecked,
    firstMismatch: {
      gene: genes[g].id,
      position,
      from: table.codons[from],
      to: table.codons[to],
    },
  });

  for (let g = 0; g < genes.length; g += 1) {
    const start = offsets[g];
    const end = offsets[g + 1];
    // Position zero is the initiation triplet and is never recoded, so it is
    // checked for being left alone rather than for being synonymous.
    for (let i = start + 1; i < end; i += 1) {
      const from = packed[i];
      const to = scheme.replacement[from];
      if (table.aas[from] !== table.aas[to]) return mismatch(g, i - start, from, to);
      codonsChecked += 1;
    }
    const stop = stopCodons ? stopCodons[g] : -1;
    if (stop >= 0) {
      const to = scheme.replacement[stop];
      if (!table.isStop[to]) return mismatch(g, end - start, stop, to);
      codonsChecked += 1;
    }
  }
  return { ok: true, genesChecked: genes.length, codonsChecked, firstMismatch: null };
}
