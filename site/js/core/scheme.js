/**
 * Recoding schemes.
 *
 * A scheme maps each target codon to what replaces it, never to a bare set of
 * forbidden codons. Every replacement must encode the same amino acid as the
 * codon it replaces; stop codons may only map to other stops. A map that would
 * change the protein is rejected rather than applied.
 *
 * A target's replacement is either a single codon or a **distribution** over
 * several synonymous codons with explicit integer percentage shares. The
 * distribution exists because published designs use one: the 57-codon
 * Escherichia coli design replaces one serine codon with four different
 * synonyms at different loci, so a one-to-one map cannot express it.
 *
 * A distribution is resolved per occurrence, not per gene and not at random. The
 * shares are apportioned over a fixed rotation of `ROTATION_SIZE` slots, spread
 * evenly rather than in blocks, and each gene walks that rotation from slot zero.
 * So the same scheme always yields the same recoded sequence for the same gene,
 * a gene's recoding never depends on another gene, and the same URL always draws
 * the same map. Every destination is synonymous with its target, so the protein
 * guarantee is unchanged whether a target has one replacement or several.
 */

/**
 * Slots in the apportionment rotation. 100 makes an integer percentage share
 * exact, and the whole table is 6,400 bytes.
 */
export const ROTATION_SIZE = 100;

/** Published presets declare replacements; target-only presets prefill from meta. */
export const PRESETS = Object.freeze([
  Object.freeze({
    id: 'amber',
    name: 'Amber only',
    targets: Object.freeze(['TAG']),
    note: 'Frees the amber stop codon for non-standard amino acid incorporation.',
  }),
  Object.freeze({
    id: 'syn61',
    name: 'Syn61 original design',
    targets: Object.freeze(['TCG', 'TCA', 'TAG']),
    map: Object.freeze({ TCG: 'AGC', TCA: 'AGT', TAG: 'TAA' }),
    note: 'Original Syn61 prescription (Chin lab, Addgene #174513); applying it simulates replacements and does not reconstruct evolved Syn61 genomes.',
  }),
  Object.freeze({
    id: 'ec-syn57',
    name: 'Ec_Syn57 aggregate',
    targets: Object.freeze(['AGC', 'AGT', 'TTA', 'TTG', 'AGA', 'AGG', 'TAG']),
    // Changed codons in 3,490 equal-length, identical-protein design/MG1655 pairs.
    // Largest-remainder rounding to 100%, ties by codon; exact counts are in
    // data/recoded/ec_syn57_{substitutions,terminal_substitutions}.tsv.
    map: Object.freeze(Object.fromEntries(Object.entries({
      AGC: [['TCA', 54], ['TCT', 22], ['TCC', 12], ['TCG', 12]],
      AGT: [['TCA', 55], ['TCT', 22], ['TCC', 12], ['TCG', 11]],
      TTA: [['CTT', 48], ['CTA', 44], ['CTC', 7], ['CTG', 1]],
      TTG: [['CTT', 48], ['CTA', 44], ['CTC', 7], ['CTG', 1]],
      AGA: [['CGT', 62], ['CGA', 31], ['CGG', 6], ['CGC', 1]],
      AGG: [['CGT', 57], ['CGA', 33], ['CGG', 9], ['CGC', 1]],
      TAG: [['TAA', 52], ['TGA', 48]],
    }).map(([codon, values]) => [codon,
      Object.freeze(values.map(([destination, share]) => Object.freeze({ codon: destination, share }))),
    ]))),
    note: 'Observed Ec_Syn57 replacement shares in 3,490 matched design/MG1655 CDSs, rounded to whole percentages. This simulation does not reconstruct any published genome. Its serine destinations conflict with Syn61 targets.',
  }),
]);

/**
 * Normalize a map entry's value into destination shares.
 *
 * A single codon becomes one destination at the full share, so every caller
 * reads one shape and the single-replacement case needs no special path.
 *
 * @param {string|Array<[string, number]>|Array<{codon: string, share: number}>} value
 * @returns {Array<{codon: string, share: number}>}
 */
export function destinationsOf(value) {
  if (typeof value === 'string') return [{ codon: value, share: ROTATION_SIZE }];
  if (!Array.isArray(value)) return [];
  return value.map((entry) => (Array.isArray(entry)
    ? { codon: entry[0], share: entry[1] }
    : { codon: entry?.codon, share: entry?.share }));
}

/** True when this target's replacement is a distribution rather than one codon. */
export function isDistribution(value) {
  return destinationsOf(value).length > 1;
}

/**
 * Check a scheme map against the genetic code.
 *
 * Each destination of a distribution is held to exactly the rules a single
 * replacement is held to, and the shares must be whole percentages summing to
 * `ROTATION_SIZE`, so the apportionment is exact rather than rounded.
 *
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateSchemeMap(map, table) {
  const errors = [];
  const entries = Object.entries(map ?? {});
  const targets = new Set(entries.map(([codon]) => codon));
  for (const [codon, value] of entries) {
    const from = table.indexOf(codon);
    if (from < 0) {
      errors.push(`${codon} is not a codon.`);
      continue;
    }
    const destinations = destinationsOf(value);
    if (destinations.length === 0) {
      errors.push(`${codon} has no replacement.`);
      continue;
    }
    const seen = new Set();
    let shareTotal = 0;
    let shareBad = false;
    for (const { codon: replacement, share } of destinations) {
      const to = table.indexOf(replacement);
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
        continue;
      }
      if (seen.has(replacement)) {
        errors.push(`${codon} lists ${replacement} more than once.`);
        continue;
      }
      seen.add(replacement);
      if (!Number.isInteger(share) || share <= 0) {
        errors.push(
          `${codon} gives ${replacement} a share of ${share}; `
            + 'a share is a whole number of percent above zero.',
        );
        shareBad = true;
        continue;
      }
      shareTotal += share;
    }
    if (!shareBad && seen.size > 0 && shareTotal !== ROTATION_SIZE) {
      errors.push(
        `${codon}'s shares add up to ${shareTotal}%, not ${ROTATION_SIZE}%.`,
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Set one destination's share and absorb the difference into the others.
 *
 * Shares are a constrained set: they must be whole percents of at least one and
 * must total `ROTATION_SIZE`. An editor that let a single field break that would
 * show the user an error for a state they were passing through on the way to a
 * valid one. So an edit is rebalanced instead of rejected, and every return from
 * here already satisfies `validateSchemeMap`.
 *
 * The requested share is clamped to leave every other destination at least one
 * percent. The remainder is spread over the others in proportion to what they
 * already held, by largest remainder so the total is exact.
 *
 * @param {Array<{codon: string, share: number}>} destinations
 * @param {number} position which destination is being set.
 * @param {number} requested the share the user asked for, in percent.
 * @returns {Array<{codon: string, share: number}>}
 */
export function rebalanceShares(destinations, position, requested) {
  const others = destinations.filter((_, i) => i !== position);
  if (others.length === 0) return [{ ...destinations[0], share: ROTATION_SIZE }];
  const max = ROTATION_SIZE - others.length;
  const wanted = Number.isFinite(requested) ? Math.round(requested) : 1;
  const share = Math.min(Math.max(wanted, 1), max);
  const pool = ROTATION_SIZE - share;
  const held = others.reduce((sum, entry) => sum + entry.share, 0);
  // Every other destination keeps its floor of one, and the slack above those
  // floors is what gets shared out in proportion.
  const slack = pool - others.length;
  const exact = others.map((entry) => (held > 0 ? (entry.share / held) * slack : slack / others.length));
  const floors = exact.map((value) => Math.floor(value));
  let left = slack - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, i) => ({ i, remainder: value - floors[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  const rebalanced = others.map((entry, i) => ({ ...entry, share: 1 + floors[i] }));
  const out = [];
  let taken = 0;
  for (let i = 0; i < destinations.length; i += 1) {
    if (i === position) out.push({ ...destinations[i], share });
    else {
      out.push(rebalanced[taken]);
      taken += 1;
    }
  }
  return out;
}

/**
 * Apportion shares over `ROTATION_SIZE` slots, spread rather than blocked.
 *
 * Largest remainder by slot: at each slot the destination furthest behind its
 * entitlement takes it, ties going to the earlier destination. A 40/35/25 split
 * therefore interleaves instead of giving the first 40 occurrences to one codon,
 * which matters because a gene may hold only a handful of a target's occurrences
 * and a blocked rotation would hand them all to one destination.
 *
 * @param {Array<{codon: string, share: number}>} destinations
 * @returns {string[]} one destination codon per slot, length `ROTATION_SIZE`
 */
export function apportion(destinations) {
  const allocated = destinations.map(() => 0);
  const slots = [];
  for (let slot = 0; slot < ROTATION_SIZE; slot += 1) {
    let best = 0;
    let bestDeficit = -Infinity;
    for (let d = 0; d < destinations.length; d += 1) {
      const entitled = (destinations[d].share * (slot + 1)) / ROTATION_SIZE;
      const deficit = entitled - allocated[d];
      if (deficit > bestDeficit + 1e-9) {
        bestDeficit = deficit;
        best = d;
      }
    }
    allocated[best] += 1;
    slots.push(destinations[best].codon);
  }
  return slots;
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
  const rotation = new Uint8Array(64 * ROTATION_SIZE);
  for (let i = 0; i < 64; i += 1) {
    replacement[i] = i;
    rotation.fill(i, i * ROTATION_SIZE, (i + 1) * ROTATION_SIZE);
  }
  const targets = Object.keys(map ?? {}).sort();
  const distributed = [];
  for (const codon of targets) {
    const from = table.indexOf(codon);
    const destinations = destinationsOf(map[codon]);
    const slots = apportion(destinations);
    for (let s = 0; s < ROTATION_SIZE; s += 1) {
      rotation[from * ROTATION_SIZE + s] = table.indexOf(slots[s]);
    }
    const dominant = destinations.reduce(
      (best, entry) => (entry.share > best.share ? entry : best),
      destinations[0],
    );
    replacement[from] = table.indexOf(dominant.codon);
    isTarget[from] = 1;
    if (destinations.length > 1) distributed.push(codon);
  }
  return {
    targets,
    replacement,
    isTarget,
    rotation,
    rotationSize: ROTATION_SIZE,
    distributed,
    active: targets.length > 0,
  };
}

/**
 * The destination for one occurrence of a codon.
 *
 * `ordinal` is how many of this codon have already been seen in the current
 * gene, so a caller keeps a per-codon counter and resets it at each gene. That
 * reset is what makes a gene's recoded sequence independent of gene order.
 *
 * @param {{rotation: Uint8Array}} scheme from {@link compileScheme}.
 * @param {number} codonIndex index into the codon table.
 * @param {number} ordinal zero-based occurrence of this codon within the gene.
 * @returns {number} index into the codon table.
 */
export function replacementAt(scheme, codonIndex, ordinal) {
  return scheme.rotation[codonIndex * ROTATION_SIZE + (ordinal % ROTATION_SIZE)];
}

/** A fresh per-gene occurrence counter for {@link replacementAt}. */
export function occurrenceCounter() {
  return new Uint32Array(64);
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

/**
 * Serialize a map as `TCG-AGC.TCA-AGT`, stable under reordering.
 *
 * A distribution serializes as `TCA-TCT:40/TCC:35/TCG:25`: destinations ordered
 * by descending share, ties by codon, so the same distribution always produces
 * the same text. A single replacement keeps the original two-codon form exactly,
 * so every link written before distributions existed still means what it meant.
 */
export function serializeSchemeMap(map) {
  return Object.keys(map ?? {})
    .sort()
    .map((codon) => {
      const destinations = destinationsOf(map[codon]);
      if (destinations.length === 1) return `${codon}-${destinations[0].codon}`;
      const ordered = [...destinations].sort(
        (a, b) => b.share - a.share || a.codon.localeCompare(b.codon),
      );
      const text = ordered.map((d) => `${d.codon}:${d.share}`).join('/');
      return `${codon}-${text}`;
    })
    .join('.');
}

/**
 * Parse the serialized form. Unparseable entries are skipped.
 *
 * A single replacement parses to a codon string and a distribution to an array
 * of `{codon, share}`, which is what `destinationsOf` expects. Shares are not
 * repaired here: a distribution whose shares do not sum correctly is returned as
 * written and rejected by `validateSchemeMap`, so a bad link reports an error
 * rather than silently drawing a different scheme.
 */
export function parseSchemeMap(text) {
  const map = {};
  if (!text) return map;
  for (const entry of text.split('.')) {
    const trimmed = entry.trim().toUpperCase();
    const single = /^([ACGT]{3})-([ACGT]{3})$/.exec(trimmed);
    if (single) {
      map[single[1]] = single[2];
      continue;
    }
    const spread = /^([ACGT]{3})-((?:[ACGT]{3}:\d{1,3})(?:\/[ACGT]{3}:\d{1,3})+)$/
      .exec(trimmed);
    if (!spread) continue;
    map[spread[1]] = spread[2].split('/').map((part) => {
      const [codon, share] = part.split(':');
      return { codon, share: Number(share) };
    });
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

  // The counter walks the same rotation the app applies, so a distribution is
  // verified at every destination it actually uses rather than only at its
  // dominant one. It resets per gene for the same reason the app resets it.
  const counter = occurrenceCounter();
  for (let g = 0; g < genes.length; g += 1) {
    const start = offsets[g];
    const end = offsets[g + 1];
    counter.fill(0);
    // Position zero is the initiation triplet and is never recoded, so it is
    // checked for being left alone rather than for being synonymous.
    for (let i = start + 1; i < end; i += 1) {
      const from = packed[i];
      const to = replacementAt(scheme, from, counter[from]);
      counter[from] += 1;
      if (table.aas[from] !== table.aas[to]) return mismatch(g, i - start, from, to);
      codonsChecked += 1;
    }
    const stop = stopCodons ? stopCodons[g] : -1;
    if (stop >= 0) {
      const to = replacementAt(scheme, stop, counter[stop]);
      counter[stop] += 1;
      if (!table.isStop[to]) return mismatch(g, end - start, stop, to);
      codonsChecked += 1;
    }
  }
  return { ok: true, genesChecked: genes.length, codonsChecked, firstMismatch: null };
}
