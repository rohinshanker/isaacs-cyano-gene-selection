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

import {
  ALL_SOURCES, UTEX_SOURCE, GO_IEA_SOURCE, hasSource,
} from './annotation-source.js';

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
  return normalize(text).match(/[\p{L}\p{N}_]+/gu) ?? [];
}

/** True when every word of `needle` appears somewhere in `haystack`. */
function containsAllWords(haystack, needle) {
  const available = new Set(words(haystack));
  return words(needle).every((word) => available.has(word));
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
const TIER = {
  idExact: 0, nameExact: 1, idPartial: 2, name: 3, product: 4,
  reviewedCategory: 5, goId: 6, goName: 7,
};

const FIELD_LABEL = {
  [TIER.idExact]: 'locus tag',
  [TIER.nameExact]: 'gene name',
  [TIER.idPartial]: 'locus tag',
  [TIER.name]: 'gene name',
  [TIER.product]: 'product',
};

/** GO rows remain evidence-coded suggestions; matching a name does not establish function. */
function scoreGo(gene, query, terms, source = ALL_SOURCES) {
  if (!hasSource(source, GO_IEA_SOURCE)) return null;
  let best = null;
  for (const relation of gene.annotationEvidence?.goAnnotations ?? []) {
    const id = relation.goId;
    const name = terms?.[id]?.name ?? '';
    const tier = normalize(id) === query ? TIER.goId
      : name && containsAllWords(normalize(name), query) ? TIER.goName : null;
    if (tier === null) continue;
    if (!best || tier < best.tier || (tier === best.tier && name.length > best.length)) {
      best = {
        tier,
        length: tier === TIER.goId ? id.length : name.length,
        relation,
        name,
      };
    }
  }
  return best;
}

/** Only labels assigned by the reviewed table can match this tier; a UTEX 2973 field. */
function scoreReviewedCategory(gene, query, source = ALL_SOURCES) {
  if (!hasSource(source, UTEX_SOURCE)) return null;
  const labels = gene.reviewedFunctionLabels ?? [];
  const label = labels.find((entry) => containsAllWords(entry, query));
  return label ? { tier: TIER.reviewedCategory, length: label.length, category: label } : null;
}

/**
 * Best tier for one needle against one gene, or null when it does not match.
 *
 * Locus tag identity is not any one source's annotation, so it always matches
 * regardless of the selected source. Name and product come only from the
 * UTEX 2973 release, so a PCC 7942- or GO IEA-only view must not surface a
 * gene by a name or product it does not itself carry.
 */
function scoreNeedle(gene, needle, source = ALL_SOURCES) {
  const id = normalize(gene.id);
  const { phrase } = needle;
  if (!phrase) return null;
  if (id === phrase) return TIER.idExact;
  const utexAllowed = hasSource(source, UTEX_SOURCE);
  const name = utexAllowed ? normalize(gene.name) : '';
  const product = utexAllowed ? normalize(gene.product) : '';
  if (name && name === phrase) return TIER.nameExact;
  if (id.includes(phrase)) return TIER.idPartial;
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
 * @param {{limit?: number, goTerms?: object, source?: string|string[]}} options
 *   `source` is a single source id, "all", or the enabled-source list.
 * @returns {{query: string, total: number, shown: Array<object>, hiddenCount: number,
 *   aliasesUsed: string[]}} `shown` entries carry `{index, gene, matchedOn, alias}`.
 */
export function searchGenes(genes, query, {
  limit = SEARCH_RESULT_LIMIT, goTerms = null, source = ALL_SOURCES,
} = {}) {
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
      const tier = scoreNeedle(gene, needle, source);
      if (tier === null) continue;
      const candidate = { tier, length: needle.phrase.length, alias: needle.alias };
      if (best === null
        || candidate.tier < best.tier
        || (candidate.tier === best.tier && candidate.length > best.length)) {
        best = candidate;
      }
    }
    if (best === null) best = scoreReviewedCategory(gene, normalized, source);
    if (best === null) best = scoreGo(gene, normalized, goTerms, source);
    if (best === null) return;
    if (best.alias) aliasesUsed.add(best.alias);
    const go = best.relation;
    hits.push({
      index,
      gene,
      tier: best.tier,
      matchLength: best.length,
      matchedOn: go ? (best.tier === TIER.goId ? 'GO ID' : 'GO term name')
        : best.category ? 'reviewed function category' : FIELD_LABEL[best.tier],
      alias: best.alias ?? null,
      categoryMatch: best.category ?? null,
      goMatch: go ? {
        id: go.goId,
        name: best.name || null,
        evidenceCode: go.evidenceCode,
        mappingAmbiguity: go.mappingAmbiguity || null,
        isObsolete: Boolean(goTerms?.[go.goId]?.isObsolete),
      } : null,
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
