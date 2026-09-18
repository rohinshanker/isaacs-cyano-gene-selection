/**
 * Finding a gene by what it is, not only by its identifier.
 *
 * A biologist looking for rubisco types "rubisco". The NCBI annotation for this
 * genome spells the enzyme out as "ribulose bisphosphate carboxylase", so a plain
 * substring search over the product text returns the RuBisCO chaperone, a
 * RuBisCO-like domain protein, and a RuBisCO accumulation factor, while both
 * subunits of the enzyme itself stay hidden. That is worse than finding nothing,
 * because it looks like it worked.
 *
 * The fix here is a curated alias table, not fuzzy matching. It is deliberately
 * small and readable so the lab can extend it. A real solution is a semantic
 * judgment over product text, which is recorded as future work and is not
 * something to approximate with a scoring heuristic.
 */

/**
 * Nicknames a lab types, mapped to the phrasing the annotation actually uses.
 *
 * Extend this freely: a key is what someone types, the values are phrases to look
 * for in the gene's name or product. Matching is case-insensitive, and a value
 * matches when every word in it appears in the gene's text, so word order and
 * punctuation in the annotation do not matter.
 */
export const GENE_ALIASES = Object.freeze({
  rubisco: ['ribulose bisphosphate carboxylase'],
  'photosystem i': ['photosystem I', 'photosystem I P700'],
  'photosystem ii': ['photosystem II'],
  psi: ['photosystem I'],
  psii: ['photosystem II'],
  phycobilisome: ['phycobilisome', 'phycocyanin', 'allophycocyanin'],
  carboxysome: ['carboxysome', 'carbon dioxide concentrating mechanism'],
  'atp synthase': ['ATP synthase'],
  atpase: ['ATP synthase'],
  nitrogenase: ['nitrogenase'],
  ribosome: ['ribosomal protein'],
});

/** How many results the interface shows before it starts counting the rest. */
export const SEARCH_RESULT_LIMIT = 12;

/** Lowercase and collapse whitespace so annotation punctuation cannot block a match. */
function normalize(text) {
  return String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function words(text) {
  return normalize(text).split(' ').filter(Boolean);
}

/** True when every word of `needle` appears somewhere in `haystack`. */
function containsAllWords(haystack, needle) {
  return words(needle).every((word) => haystack.includes(word));
}

/**
 * The phrases to look for, given what the user typed.
 *
 * The query itself always counts. An alias fires when the whole query or one of
 * its words is a key, and contributes the annotation's own phrasing alongside.
 */
function buildNeedles(query) {
  const normalized = normalize(query);
  const needles = [{ phrase: normalized, alias: null }];
  const keys = new Set([normalized, ...words(normalized)]);
  for (const key of keys) {
    for (const phrase of GENE_ALIASES[key] ?? []) {
      needles.push({ phrase: normalize(phrase), alias: key });
    }
  }
  return needles;
}

/**
 * Rank tiers. Lower sorts first: an exact identifier beats a name, which beats a
 * mention buried in product text.
 */
const TIER = { idExact: 0, nameExact: 1, idPartial: 2, name: 3, product: 4 };

const FIELD_LABEL = {
  [TIER.idExact]: 'locus tag',
  [TIER.nameExact]: 'gene name',
  [TIER.idPartial]: 'locus tag',
  [TIER.name]: 'gene name',
  [TIER.product]: 'product',
};

/** Best tier for one needle against one gene, or null when it does not match. */
function scoreNeedle(gene, needle) {
  const id = normalize(gene.id);
  const name = normalize(gene.name);
  const product = normalize(gene.product);
  const { phrase } = needle;
  if (!phrase) return null;
  if (id === phrase) return TIER.idExact;
  if (name && name === phrase) return TIER.nameExact;
  if (containsAllWords(id, phrase)) return TIER.idPartial;
  if (name && containsAllWords(name, phrase)) return TIER.name;
  if (product && containsAllWords(product, phrase)) return TIER.product;
  return null;
}

/**
 * Search every gene for what the user typed.
 *
 * Within a tier, the longest matching phrase wins. That is what puts the enzyme
 * above its chaperone: "rubisco" matches the chaperone's product text directly,
 * but the alias phrase "ribulose bisphosphate carboxylase" is far more specific,
 * so the genes carrying it rank higher. Ties fall back to locus tag so the order
 * is stable.
 *
 * @param {Array<object>} genes
 * @param {string} query
 * @param {{limit?: number}} options
 * @returns {{query: string, total: number, shown: Array<object>, hiddenCount: number,
 *   aliasesUsed: string[]}} `shown` entries carry `{index, gene, matchedOn, alias}`.
 */
export function searchGenes(genes, query, { limit = SEARCH_RESULT_LIMIT } = {}) {
  const normalized = normalize(query);
  if (!normalized) {
    return { query: normalized, total: 0, shown: [], hiddenCount: 0, aliasesUsed: [] };
  }
  const needles = buildNeedles(normalized);
  const aliasesUsed = new Set();
  const hits = [];

  genes.forEach((gene, index) => {
    let best = null;
    for (const needle of needles) {
      const tier = scoreNeedle(gene, needle);
      if (tier === null) continue;
      const candidate = { tier, length: needle.phrase.length, alias: needle.alias };
      if (best === null
        || candidate.tier < best.tier
        || (candidate.tier === best.tier && candidate.length > best.length)) {
        best = candidate;
      }
    }
    if (best === null) return;
    if (best.alias) aliasesUsed.add(best.alias);
    hits.push({
      index,
      gene,
      tier: best.tier,
      matchLength: best.length,
      matchedOn: FIELD_LABEL[best.tier],
      alias: best.alias,
    });
  });

  hits.sort((a, b) => a.tier - b.tier
    || b.matchLength - a.matchLength
    || String(a.gene.id).localeCompare(String(b.gene.id)));

  return {
    query: normalized,
    total: hits.length,
    shown: hits.slice(0, limit),
    hiddenCount: Math.max(0, hits.length - limit),
    aliasesUsed: [...aliasesUsed],
  };
}
