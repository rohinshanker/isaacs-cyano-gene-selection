#!/usr/bin/env node
/**
 * Generate contract-conformant synthetic data for developing and testing the site.
 *
 *   node tests/fixtures/make_fixture.mjs --out tests/fixtures/data --genes 300
 *
 * The output obeys docs/validation/data-contract.md exactly. Sequences are
 * simulated, then every codon-usage metric is computed from those sequences with
 * the same modules the site uses, so the fixture is internally consistent and a
 * site bug cannot hide behind invented numbers.
 *
 * Two families of values are simulated rather than computed, because they cannot
 * be derived from sequence alone in JavaScript, and they exist here only so the
 * interface can be laid out and stress-tested:
 *   - `mfeStart` and `mfeFirst100`, which need an RNA folding engine.
 *   - `riskUmap`, which needs UMAP. A two-component PCA of the same features
 *     stands in; the real file comes from the pipeline.
 *
 * Nothing in site/js may depend on any value produced here.
 *
 * Flags:
 *   --out <dir>          output directory (default tests/fixtures/data)
 *   --genes <n>          gene count (default 300)
 *   --seed <n>           PRNG seed (default 20260918)
 *   --with-expression    add the contract's `expression` fields plus
 *                        `meta.expressionSource`, so the opt-in low-traffic
 *                        overlay and its provenance notice can be exercised.
 *                        Every gene then carries `expressionBasis`: most are
 *                        measured, one in seventeen has only the proxy, and one
 *                        in fifty-three has neither, so the interface's rule that
 *                        missing never looks like the median is actually tested.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodonTable, standardCodonList, standardAminoAcid } from '../../site/js/core/codon-table.js';
import {
  buildCaiWeights, buildTaiWeights, buildCodonPairScores,
  gc3FromCounts, encFromCounts, encExpected, caiFromCounts, taiFromCounts,
} from '../../site/js/core/codon-metrics.js';
import {
  resolveInitiatorIndex, applyInitiatorConvention, DEFAULT_TAI_S_VALUES,
  DEFAULT_CAI_ZERO_COUNT_ADJUSTMENT, DEFAULT_CPS_SMOOTHING,
} from '../../site/js/core/conventions.js';
import { pca } from '../../site/js/core/pca.js';

const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const HERE = dirname(fileURLToPath(import.meta.url));

/** Deterministic PRNG so a fixture is reproducible from its seed alone. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseArgs(argv) {
  const args = { out: resolve(HERE, 'data'), genes: 300, seed: 20260918, expression: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--out') args.out = resolve(process.cwd(), argv[(i += 1)]);
    else if (flag === '--genes') args.genes = Number(argv[(i += 1)]);
    else if (flag === '--seed') args.seed = Number(argv[(i += 1)]);
    else if (flag === '--with-expression') args.expression = true;
    else throw new Error(`unknown flag ${flag}`);
  }
  if (!Number.isInteger(args.genes) || args.genes < 1) throw new Error('--genes must be a positive integer');
  return args;
}

/** Amino acid composition roughly matching a GC-rich cyanobacterial proteome. */
const AA_FREQUENCY = {
  A: 0.098, R: 0.058, N: 0.037, D: 0.052, C: 0.010, Q: 0.043, E: 0.058, G: 0.075,
  H: 0.021, I: 0.058, L: 0.107, K: 0.035, M: 0.024, F: 0.038, P: 0.049, S: 0.058,
  T: 0.057, W: 0.014, Y: 0.028, V: 0.070,
};

/**
 * tRNA gene copy numbers by anticodon, sized like a 44-gene bacterial set.
 *
 * Two entries carry a modified wobble base, exactly as the real genome's table
 * does: `ICG` is the inosine-modified arginine tRNA that reads all four CGN
 * codons, and `LAT` is the lysidine-modified isoleucine tRNA that reads ATA
 * while methionine's own `CAT` does not. A fixture without them would not
 * exercise the codons most easily left unweighted.
 */
const TRNA_GENE_COPIES = {
  AGC: 4, TGC: 1, ICG: 2, CCG: 1, TCG: 1, GTT: 2, GCA: 1, TTG: 2, TCC: 1, GCC: 2,
  GTG: 1, GAT: 3, LAT: 1, CAT: 3, TTT: 2, CAA: 2, TAA: 1, GAA: 2, CTT: 1, TAG: 1,
  CAG: 1, GGG: 1, TGG: 1, GCT: 2, TGA: 2, CGA: 1, GGT: 1, TGT: 1, GGC: 1, GTA: 1,
  CCA: 1, GTC: 1, TAC: 2, GAC: 1, CGT: 1, CCT: 1,
};

/**
 * Selective constraints, keyed `anticodonWobbleBase:codonThirdBase` as the
 * pipeline keys them. Watson-Crick pairings need no entry; they contribute their
 * full copy number.
 */
const TAI_S_VALUES = { ...DEFAULT_TAI_S_VALUES };

/** Amino acids dos Reis excludes from the tAI geometric mean. */
const TAI_EXCLUDED_AMINO_ACIDS = ['M'];

/** How the pipeline treats a synonymous family it observed fewer than twice. */
const ENC_FAMILY_CONVENTION = 'families with fewer than two observations use the mean F of '
  + 'estimable families in the same degeneracy class; an entirely unestimable class uses '
  + 'neutral F=1/k';

const LYSIDINE_CONVENTION = 'Ile-CAT is represented as LAT and decodes ATA with s=0.89; '
  + 'Met-CAT remains a separate species decoding ATG';

const PRODUCTS = [
  'hypothetical protein', 'ATP synthase subunit beta', '30S ribosomal protein S12',
  'photosystem II reaction center protein D1', 'ribulose-bisphosphate carboxylase large subunit',
  'DNA gyrase subunit A', 'glyceraldehyde-3-phosphate dehydrogenase', 'ferredoxin-NADP reductase',
  'phycobilisome linker polypeptide', 'circadian clock protein KaiC',
  'two-component sensor histidine kinase with a PAS domain and a GAF domain',
  'putative multidrug efflux transporter permease subunit of the resistance-nodulation-division superfamily',
  'S-adenosyl-L-methionine-dependent methyltransferase MidAlongNameWithoutAnySpacesAtAllForWrapping',
];

const GENE_NAMES = [
  'rpsL', 'rplA', 'atpB', 'psbA', 'rbcL', 'gyrA', 'gapA', 'petH', 'cpcC', 'kaiC',
  'glnA', 'ndhB', 'psaA', 'clpB', 'groEL', 'rpoC1', 'nblA', 'sigA', 'ftsZ', 'murC',
];

const SEQIDS = [
  { id: 'NZ_CP006471.1', length: 2695903, share: 0.94 },
  { id: 'NZ_CP006472.1', length: 30810, share: 0.04 },
  { id: 'NZ_CP006473.1', length: 17913, share: 0.02 },
];

function weightedPick(random, entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

/** Log-normal draw clamped to a range, for gene lengths. */
function logNormal(random, median, sigma, min, max) {
  const u = Math.max(1e-9, random());
  const v = Math.max(1e-9, random());
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.min(max, Math.max(min, Math.round(median * Math.exp(sigma * z))));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const random = mulberry32(args.seed);
  const codons = standardCodonList();
  const alphabet = codons.map((codon, i) => ({
    sym: SYMBOLS[i], codon, aa: standardAminoAcid(codon),
  }));
  const table = new CodonTable(alphabet);

  // Genome-wide preference: one favoured codon per amino acid, GC3-biased.
  const preferred = new Map();
  for (const [aa, indices] of table.family) {
    if (aa === '*') continue;
    const scored = indices.map((index) => ({
      index,
      score: (table.isGc3[index] ? 1.6 : 1) * (0.6 + random()),
    }));
    scored.sort((a, b) => b.score - a.score);
    preferred.set(aa, scored[0].index);
  }

  const aaEntries = Object.entries(AA_FREQUENCY);
  const genes = [];
  const packedIndices = [];
  let cursor = 480;
  let seqidCursor = 0;
  let operonIndex = 0;
  let operonRemaining = 0;
  let operonSize = 0;

  for (let g = 0; g < args.genes; g += 1) {
    // Expression strength drives codon bias, the way it does in real genomes.
    const expressionLatent = random() ** 2.2;
    const bias = 0.14 + 0.66 * expressionLatent;
    // Per-gene GC3 affinity, which is what spreads real genomes across GC3.
    const gc3Affinity = 0.25 + 0.6 * random();
    const lengthCodons = logNormal(random, 270, 0.72, 40, 2400);

    const indices = new Uint8Array(lengthCodons);
    // Start codon: ATG dominates, GTG and TTG occur, as in bacterial annotation.
    indices[0] = table.indexOf(weightedPick(random, [['ATG', 0.82], ['GTG', 0.12], ['TTG', 0.06]]));
    for (let i = 1; i < lengthCodons; i += 1) {
      const aa = weightedPick(random, aaEntries);
      const family = table.family.get(aa);
      const favourite = preferred.get(aa);
      if (family.length === 1 || random() < bias) {
        indices[i] = favourite;
      } else {
        indices[i] = weightedPick(
          random,
          family.map((index) => [index, table.isGc3[index] ? gc3Affinity : 1 - gc3Affinity]),
        );
      }
    }
    packedIndices.push(indices);

    // Terminal stops in the real included set run TAG 1,071, TAA 895, TGA 749.
    const terminalStop = weightedPick(random, [['TAG', 1071], ['TAA', 895], ['TGA', 749]]);

    const share = weightedPick(random, SEQIDS.map((entry) => [entry, entry.share]));
    if (share.id !== SEQIDS[seqidCursor].id) {
      seqidCursor = SEQIDS.findIndex((entry) => entry.id === share.id);
      cursor = 480;
    }
    const lengthNt = lengthCodons * 3 + 3;
    const gap = Math.round(-6 + random() * 260);
    const start = cursor + Math.max(-15, gap);
    const end = start + lengthNt - 1;
    cursor = end + 1;

    if (operonRemaining === 0) {
      operonSize = 1 + Math.floor(random() * 4);
      operonRemaining = operonSize;
      operonIndex += 1;
    }
    const operonPosition = operonSize - operonRemaining + 1;
    operonRemaining -= 1;
    const inOperon = operonSize > 1;

    genes.push({
      id: `M744_RS${String(g * 5 + 5).padStart(5, '0')}`,
      name: random() < 0.42 ? GENE_NAMES[Math.floor(random() * GENE_NAMES.length)] : null,
      product: PRODUCTS[Math.floor(random() * PRODUCTS.length)],
      seqid: share.id,
      start,
      end,
      strand: random() < 0.52 ? '+' : '-',
      lengthNt,
      lengthCodons,
      operonId: inOperon ? `op_${String(operonIndex).padStart(4, '0')}` : null,
      operonPosition: inOperon ? operonPosition : null,
      operonSize: inOperon ? operonSize : null,
      terminalStop,
      _expression: expressionLatent,
      _gap: gap,
    });
  }

  // Codon-usage metrics count position zero as methionine, whatever triplet is
  // there, because every bacterial start translates as methionine. Composition
  // metrics use the literal sequence. Both views are built here so the fixture
  // carries the same conventions the site reads back out of meta.json.
  const initiatorIndex = resolveInitiatorIndex(table);
  const translatedIndices = packedIndices.map((indices) => {
    const translated = Int32Array.from(indices);
    if (translated.length > 0) translated[0] = initiatorIndex;
    return translated;
  });

  const genomeCounts = new Float64Array(64);
  const translatedGenomeCounts = new Float64Array(64);
  const translatedPairCounts = new Float64Array(4096);
  const perGeneCounts = [];
  const perGeneTranslatedCounts = [];
  packedIndices.forEach((indices, g) => {
    const counts = new Float64Array(64);
    for (let i = 0; i < indices.length; i += 1) {
      counts[indices[i]] += 1;
      genomeCounts[indices[i]] += 1;
    }
    perGeneCounts.push(counts);
    const translated = Float64Array.from(counts);
    if (indices.length > 0) applyInitiatorConvention(translated, indices[0], initiatorIndex);
    perGeneTranslatedCounts.push(translated);
    const chain = translatedIndices[g];
    for (let i = 0; i < chain.length; i += 1) {
      translatedGenomeCounts[chain[i]] += 1;
      if (i > 0) translatedPairCounts[chain[i - 1] * 64 + chain[i]] += 1;
    }
  });

  const referenceOrder = genes
    .map((gene, index) => ({ index, expression: gene._expression }))
    .sort((a, b) => b.expression - a.expression)
    .slice(0, Math.min(57, genes.length));
  const referenceCounts = new Float64Array(64);
  for (const { index } of referenceOrder) {
    for (let c = 0; c < 64; c += 1) referenceCounts[c] += perGeneTranslatedCounts[index][c];
  }

  // The excluded families are named in meta.json below, so the site derives the
  // same masks rather than assuming them.
  const maskFor = (aminoAcids) => {
    const mask = new Uint8Array(64);
    for (const aa of aminoAcids) for (const index of table.family.get(aa) ?? []) mask[index] = 1;
    return mask;
  };
  const taiExcludedMask = maskFor(TAI_EXCLUDED_AMINO_ACIDS);
  const caiExcludedMask = maskFor([...table.family]
    .filter(([aa, indices]) => aa !== '*' && indices.length === 1)
    .map(([aa]) => aa));

  const caiWeights =
    buildCaiWeights(referenceCounts, table, DEFAULT_CAI_ZERO_COUNT_ADJUSTMENT);
  const { weights: taiWeights, report: taiReport } =
    buildTaiWeights(TRNA_GENE_COPIES, TAI_S_VALUES, table, {});
  const cpsScores = buildCodonPairScores(
    translatedPairCounts, translatedGenomeCounts, table, DEFAULT_CPS_SMOOTHING,
  );

  // Relative synonymous frequency genome-wide decides which codons count as rare.
  const relativeFrequency = new Float64Array(64);
  for (const indices of table.family.values()) {
    let familyTotal = 0;
    for (const index of indices) familyTotal += translatedGenomeCounts[index];
    for (const index of indices) {
      relativeFrequency[index] =
        familyTotal > 0 ? translatedGenomeCounts[index] / familyTotal : 0;
    }
  }
  const rareCodonThreshold = 0.1;
  const isRare = Uint8Array.from(relativeFrequency, (value) => (value < rareCodonThreshold ? 1 : 0));

  const rscuOrder = codons.filter((codon) => standardAminoAcid(codon) !== '*'
    && table.family.get(standardAminoAcid(codon)).length > 1);

  const rscuMatrix = new Float64Array(genes.length * rscuOrder.length);
  genes.forEach((gene, g) => {
    const counts = perGeneTranslatedCounts[g];
    rscuOrder.forEach((codon, c) => {
      const index = table.indexOf(codon);
      const family = table.family.get(table.aas[index]);
      let familyTotal = 0;
      for (const member of family) familyTotal += counts[member];
      rscuMatrix[g * rscuOrder.length + c] =
        familyTotal > 0 ? counts[index] / (familyTotal / family.length) : 0;
    });
  });

  const codonPcaResult = pca(rscuMatrix, genes.length, rscuOrder.length, 6);

  const records = genes.map((gene, g) => {
    const indices = packedIndices[g];
    const counts = perGeneCounts[g];
    const translated = perGeneTranslatedCounts[g];
    const translatedChain = translatedIndices[g];
    let nucleotides = '';
    for (let i = 0; i < indices.length; i += 1) nucleotides += table.codons[indices[i]];

    const positionGc = (offset) => {
      let gc = 0;
      for (let i = offset; i < nucleotides.length; i += 3) {
        if (nucleotides[i] === 'G' || nucleotides[i] === 'C') gc += 1;
      }
      return gc / indices.length;
    };
    const baseFraction = (base) => {
      let n = 0;
      for (let i = 2; i < nucleotides.length; i += 3) if (nucleotides[i] === base) n += 1;
      return n / indices.length;
    };
    const windowGc = (size) => {
      if (nucleotides.length <= size) return { min: null, max: null };
      let min = 1;
      let max = 0;
      let gc = 0;
      for (let i = 0; i < nucleotides.length; i += 1) {
        if (nucleotides[i] === 'G' || nucleotides[i] === 'C') gc += 1;
        if (i >= size && (nucleotides[i - size] === 'G' || nucleotides[i - size] === 'C')) gc -= 1;
        if (i >= size - 1) {
          const value = gc / size;
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }
      return { min, max };
    };

    const gc3 = gc3FromCounts(counts, table);
    const encReport = {};
    const enc = encFromCounts(translated, table, encReport);
    const expected = encExpected(gc3);
    const local = windowGc(99);

    let rareCount = 0;
    let longestRareRun = 0;
    let currentRun = 0;
    let rampRareCount = 0;
    for (let i = 0; i < translatedChain.length; i += 1) {
      if (isRare[translatedChain[i]]) {
        rareCount += 1;
        currentRun += 1;
        longestRareRun = Math.max(longestRareRun, currentRun);
        if (i < 50) rampRareCount += 1;
      } else {
        currentRun = 0;
      }
    }

    const taiWindow = 15;
    let minLocalTai = Infinity;
    if (translatedChain.length >= taiWindow) {
      let logSum = 0;
      for (let i = 0; i < translatedChain.length; i += 1) {
        logSum += Math.log(Math.max(1e-6, taiWeights[translatedChain[i]]));
        if (i >= taiWindow) {
          logSum -= Math.log(Math.max(1e-6, taiWeights[translatedChain[i - taiWindow]]));
        }
        if (i >= taiWindow - 1) minLocalTai = Math.min(minLocalTai, Math.exp(logSum / taiWindow));
      }
    }

    let cpsSum = 0;
    let underrepresented = 0;
    for (let i = 1; i < translatedChain.length; i += 1) {
      const score = cpsScores[translatedChain[i - 1] * 64 + translatedChain[i]];
      cpsSum += score;
      if (score < 0) underrepresented += 1;
    }
    const pairs = Math.max(1, indices.length - 1);

    const gc5prime = nucleotides.slice(0, 150).split('').filter((b) => b === 'G' || b === 'C').length
      / Math.min(150, nucleotides.length);
    // Simulated folding energies: more negative where the 5' end is GC-rich.
    const mfeStart = Math.round((-3 - 26 * gc5prime - random() * 4) * 10) / 10;
    const mfeFirst100 = Math.round((-8 - 46 * gc5prime - random() * 9) * 10) / 10;

    const record = {
      id: gene.id,
      name: gene.name,
      product: gene.product,
      seqid: gene.seqid,
      start: gene.start,
      end: gene.end,
      strand: gene.strand,
      lengthNt: gene.lengthNt,
      lengthCodons: gene.lengthCodons,
      gc: nucleotides.split('').filter((b) => b === 'G' || b === 'C').length / nucleotides.length,
      gc1: positionGc(0),
      gc2: positionGc(1),
      gc3,
      a3: baseFraction('A'),
      t3: baseFraction('T'),
      g3: baseFraction('G'),
      c3: baseFraction('C'),
      enc,
      encHasSubstitutedFamilies: encReport.hasSubstitutedFamilies,
      encExpected: expected,
      deltaEnc: expected - enc,
      cai: caiFromCounts(translated, caiWeights, caiExcludedMask),
      tai: taiFromCounts(translated, taiWeights, table, taiExcludedMask),
      rareFraction: rareCount / indices.length,
      rareCount,
      longestRareRun,
      rampRareCount,
      minLocalTai: Number.isFinite(minLocalTai) ? minLocalTai : null,
      cps: cpsSum / pairs,
      underrepresentedPairFraction: underrepresented / pairs,
      // A few genes carry no folding energy, so the interface is exercised
      // against the contract's rule that null renders as an em-space, not zero.
      mfeStart: g % 37 === 5 ? null : mfeStart,
      mfeFirst100: g % 37 === 5 ? null : mfeFirst100,
      minLocalGc: local.min,
      maxLocalGc: local.max,
      gc5prime,
      neighborUpstreamNt: gene._gap,
      neighborDownstreamNt: g + 1 < genes.length ? genes[g + 1]._gap : null,
      overlapsNeighbor: gene._gap < 0,
      operonId: gene.operonId,
      operonPosition: gene.operonPosition,
      operonSize: gene.operonSize,
      terminalStop: gene.terminalStop,
      // Three genes in the real set are spliced, one of them for a programmed
      // frameshift, so the fixture carries both shapes.
      translationalException: g === 17 ? 'ribosomal_slippage' : null,
      cdsSegments: g === 17 || g === 41
        ? [[gene.start, gene.start + 71], [gene.start + 73, gene.end]]
        : null,
      rscu: Array.from(
        rscuMatrix.subarray(g * rscuOrder.length, (g + 1) * rscuOrder.length),
        (value) => Math.round(value * 1e4) / 1e4,
      ),
      codonPca: Array.from(
        codonPcaResult.scores.subarray(g * codonPcaResult.components, (g + 1) * codonPcaResult.components),
        (value) => Math.round(value * 1e4) / 1e4,
      ),
      riskUmap: [0, 0],
      codons: table.encode(indices),
    };
    if (args.expression) {
      // The real table leaves 164 of 2,715 genes unmeasured; null means unknown.
      // Per the contract, `expression` is only ever a measurement. A gene with
      // none falls back to the codon-adaptation proxy, and its basis says so.
      // A few genes have neither, so the null basis is exercised too.
      const basis = g % 53 === 11 ? null : g % 17 === 3 ? 'proxy' : 'measured';
      record.expression = basis === 'measured'
        ? Math.round(Math.exp(2.4 + 5.2 * gene._expression + random() * 0.9) * 100) / 100
        : null;
      record.expressionPercentile = null;
      record.expressionBasis = basis;
      record.expressionProxy = null;
      record.expressionSourceId = basis === 'measured' ? 'GSE205444' : null;
    }
    return record;
  });

  if (args.expression) {
    const measured = records
      .map((record, index) => ({ index, value: record.expression }))
      .filter((entry) => entry.value !== null)
      .sort((a, b) => a.value - b.value);
    measured.forEach((entry, rank) => {
      records[entry.index].expressionPercentile =
        Math.round((rank / Math.max(1, measured.length - 1)) * 1e4) / 1e4;
    });
    // The proxy is a rank in 0..1 of the mean of CAI and tAI, this genome's own
    // adaptation measures. It exists for every gene except those whose basis is
    // null, which the contract reserves for "neither exists".
    const ranked = records
      .map((record, index) => ({ index, value: (record.cai + record.tai) / 2 }))
      .sort((a, b) => a.value - b.value);
    ranked.forEach((entry, rank) => {
      const record = records[entry.index];
      record.expressionProxy = record.expressionBasis === null
        ? null
        : Math.round((rank / Math.max(1, ranked.length - 1)) * 1e4) / 1e4;
    });
  }

  // Stand-in for the pipeline's UMAP: a two-component PCA of the same
  // target-independent risk features, spread out so it reads like an embedding.
  const riskKeys = ['lengthCodons', 'gc3', 'enc', 'cai', 'tai', 'rareFraction', 'cps', 'gc5prime'];
  const riskMatrix = new Float64Array(records.length * riskKeys.length);
  records.forEach((record, r) => {
    riskKeys.forEach((key, c) => {
      const value = record[key];
      riskMatrix[r * riskKeys.length + c] = Number.isFinite(value) ? value : 0;
    });
  });
  const riskPca = pca(riskMatrix, records.length, riskKeys.length, 2);
  records.forEach((record, r) => {
    record.riskUmap = [
      Math.round((riskPca.scores[r * 2] * 1.7 + (random() - 0.5) * 0.9) * 1e3) / 1e3,
      Math.round((riskPca.scores[r * 2 + 1] * 1.7 + (random() - 0.5) * 0.9) * 1e3) / 1e3,
    ];
  });

  const mostUsedSynonym = (source) => {
    const map = {};
    for (const codon of codons) {
      const alternatives = table.synonymsOf(codon);
      if (alternatives.length === 0) continue;
      let best = alternatives[0];
      for (const candidate of alternatives) {
        if (source[table.indexOf(candidate)] > source[table.indexOf(best)]) best = candidate;
      }
      map[codon] = best;
    }
    return map;
  };

  const metrics = {
    lengthNt: { label: 'CDS length', unit: 'nt', family: 'Size', desc: 'Coding sequence length including the stop codon.', scale: 'sequential' },
    lengthCodons: { label: 'Length', unit: 'codons', family: 'Size', desc: 'Sense codons, the stop codon excluded.', scale: 'sequential' },
    gc: { label: 'GC', unit: 'fraction', family: 'Base composition', desc: 'G or C across the whole coding sequence.', scale: 'sequential' },
    gc1: { label: 'GC1', unit: 'fraction', family: 'Base composition', desc: 'G or C at first codon positions.', scale: 'sequential' },
    gc2: { label: 'GC2', unit: 'fraction', family: 'Base composition', desc: 'G or C at second codon positions.', scale: 'sequential' },
    gc3: { label: 'GC3', unit: 'fraction', family: 'Base composition', desc: 'G or C at third codon positions, where synonymous choice shows up most.', scale: 'sequential' },
    a3: { label: 'A3', unit: 'fraction', family: 'Base composition', desc: 'Adenine at third codon positions.', scale: 'sequential' },
    t3: { label: 'T3', unit: 'fraction', family: 'Base composition', desc: 'Thymine at third codon positions.', scale: 'sequential' },
    g3: { label: 'G3', unit: 'fraction', family: 'Base composition', desc: 'Guanine at third codon positions.', scale: 'sequential' },
    c3: { label: 'C3', unit: 'fraction', family: 'Base composition', desc: 'Cytosine at third codon positions.', scale: 'sequential' },
    enc: { label: 'ENC', unit: 'codons 20-61', family: 'Codon usage', desc: 'Effective number of codons. 20 is maximal bias, 61 is none.', scale: 'sequential' },
    encExpected: { label: 'ENC expected', unit: 'codons 20-61', family: 'Codon usage', desc: 'ENC predicted from GC3 alone if only mutation acted.', scale: 'sequential' },
    deltaEnc: { label: 'ENC shortfall', unit: 'codons', family: 'Codon usage', desc: 'Expected ENC minus observed. Positive means bias beyond mutation.', scale: 'diverging' },
    cai: { label: 'CAI', unit: 'index 0-1', family: 'Translation', desc: 'Codon adaptation index against highly expressed genes.', scale: 'sequential' },
    tai: { label: 'tAI', unit: 'index 0-1', family: 'Translation', desc: 'tRNA adaptation index, how well codons match tRNA supply.', scale: 'sequential' },
    rareFraction: { label: 'Rare codon fraction', unit: 'fraction', family: 'Rare codons', desc: 'Share of codons used below the rarity threshold genome-wide.', scale: 'sequential' },
    rareCount: { label: 'Rare codons', unit: 'codons', family: 'Rare codons', desc: 'Count of rare codons in the gene.', scale: 'sequential' },
    longestRareRun: { label: 'Longest rare run', unit: 'codons', family: 'Rare codons', desc: 'Longest consecutive stretch of rare codons.', scale: 'sequential' },
    rampRareCount: { label: 'Rare codons in ramp', unit: 'codons', family: 'Rare codons', desc: 'Rare codons in the first 50 codons.', scale: 'sequential' },
    minLocalTai: { label: 'Minimum local tAI', unit: 'index 0-1', family: 'Rare codons', desc: 'Weakest 15-codon window of tRNA supply.', scale: 'sequential' },
    cps: { label: 'Codon-pair score', unit: 'mean log ratio', family: 'Codon pairs', desc: 'Mean codon-pair bias. Negative means avoided pairs.', scale: 'diverging' },
    underrepresentedPairFraction: { label: 'Avoided pair fraction', unit: 'fraction', family: 'Codon pairs', desc: 'Share of adjacent codon pairs used less than expected.', scale: 'sequential' },
    mfeStart: { label: 'Start folding energy', unit: 'kcal/mol', family: 'RNA structure', desc: 'Folding energy from 30 nt before to 60 nt after the start codon.', scale: 'sequential' },
    mfeFirst100: { label: 'First 100 nt folding energy', unit: 'kcal/mol', family: 'RNA structure', desc: 'Folding energy of the first 100 coding nucleotides.', scale: 'sequential' },
    minLocalGc: { label: 'Minimum local GC', unit: 'fraction', family: 'Base composition', desc: 'Lowest GC in any 99 nt window.', scale: 'sequential' },
    maxLocalGc: { label: 'Maximum local GC', unit: 'fraction', family: 'Base composition', desc: 'Highest GC in any 99 nt window.', scale: 'sequential' },
    gc5prime: { label: "5' GC", unit: 'fraction', family: 'Base composition', desc: 'GC across the first 150 coding nucleotides.', scale: 'sequential' },
    neighborUpstreamNt: { label: 'Upstream gap', unit: 'nt', family: 'Genomic context', desc: 'Distance to the previous gene. Negative means overlap.', scale: 'diverging' },
    neighborDownstreamNt: { label: 'Downstream gap', unit: 'nt', family: 'Genomic context', desc: 'Distance to the next gene. Negative means overlap.', scale: 'diverging' },
    operonPosition: { label: 'Operon position', unit: 'index', family: 'Genomic context', desc: 'Rank of this gene within its predicted operon.', scale: 'sequential' },
    operonSize: { label: 'Operon size', unit: 'genes', family: 'Genomic context', desc: 'Genes in this predicted operon.', scale: 'sequential' },
  };
  if (args.expression) {
    metrics.expression = {
      label: 'Expression', unit: 'normalized counts', family: 'Expression',
      desc: 'Transcript abundance from the reference dataset. Measured in a different strain. '
        + 'Null when unmeasured; never filled with the proxy.',
      scale: 'sequential',
    };
    metrics.expressionPercentile = {
      label: 'Expression percentile', unit: 'fraction', family: 'Expression',
      desc: 'Rank of this gene\u2019s abundance among the genes that carry a measurement.',
      scale: 'sequential',
    };
    metrics.expressionProxy = {
      label: 'Expression proxy', unit: 'rank 0-1', family: 'Expression',
      desc: 'Rank of the mean of CAI and tAI, from this genome. A stand-in for expression where '
        + 'no measurement exists, in a different unit from any abundance.',
      scale: 'sequential',
    };
  }
  // The contract's documentation-only fields. `direction` is recorded so the
  // site's refusal to colour by it can be tested; `missingPolicy` states the rule.
  for (const definition of Object.values(metrics)) {
    definition.missingPolicy = 'null renders as unknown, never as zero or median';
    definition.direction = 'contextual';
  }

  const meta = {
    schemaVersion: 1,
    builtAt: new Date(Date.UTC(2026, 8, 18, 20, 0, 0)).toISOString(),
    genome: { accession: 'GCF_000817325.1', taxid: 1350461, totalLength: 2744626 },
    sourceChecksums: {
      'synthetic-fixture': `seed:${args.seed};genes:${args.genes}`,
    },
    geneCount: records.length,
    codonAlphabet: alphabet,
    rscuOrder,
    defaultReplacement: mostUsedSynonym(translatedGenomeCounts),
    highExpressedReplacement: mostUsedSynonym(referenceCounts),
    caiReferenceSet: {
      method: 'simulated-high-expression',
      locusTags: referenceOrder.map(({ index }) => genes[index].id),
      n: referenceOrder.length,
      zeroCountAdjustment: DEFAULT_CAI_ZERO_COUNT_ADJUSTMENT,
    },
    tai: {
      method: 'synthetic anticodon copy number',
      sValues: TAI_S_VALUES,
      tRNAGeneCopies: TRNA_GENE_COPIES,
      excludedAminoAcids: TAI_EXCLUDED_AMINO_ACIDS,
      zeroWeightSubstitution: taiReport.substitution,
      zeroWeightCodons: taiReport.zeroWeightCodons,
      lysidineConvention: LYSIDINE_CONVENTION,
    },
    encFamilyConvention: ENC_FAMILY_CONVENTION,
    rareCodonThreshold,
    metrics,
  };
  if (args.expression) {
    const withValue = records.filter((record) => record.expression !== null).length;
    meta.expressionSource = {
      accession: 'GSE205444',
      organismMeasured: 'Synechococcus elongatus PCC 7942',
      isTargetOrganism: false,
      condition: 'WT, fresh BG-11, day 1, mean of 3 replicates',
      normalization: 'DESeq2 normalized counts',
      coverage: { withValue, total: records.length },
      caveat: 'Measured in PCC 7942, not UTEX 2973, in a biofilm study. '
        + 'Use as a rough guide only.',
      provenanceDoc: 'data/expression/PROVENANCE.md',
    };
  }

  const codonPcaFile = {
    explainedVariance: Array.from(codonPcaResult.explained, (value) => Math.round(value * 1e5) / 1e5),
    loadings: rscuOrder.map((codon, c) => ({
      codon,
      aa: standardAminoAcid(codon),
      pc: Array.from({ length: codonPcaResult.components }, (_, k) =>
        Math.round(codonPcaResult.loadings[k * rscuOrder.length + c] * 1e4) / 1e4),
    })),
    nComponents: codonPcaResult.components,
  };

  const excludedFile = [
    { id: 'M744_RS99990', reason: 'length_not_multiple_of_3', lengthNt: 755 },
    { id: 'M744_RS99995', reason: 'internal_stop_codon', lengthNt: 1203 },
    { id: 'M744_RS99999', reason: 'pseudo', lengthNt: 402 },
  ];

  return { args, meta, records, codonPcaFile, excludedFile };
}

const { args, meta, records, codonPcaFile, excludedFile } = main();
await mkdir(args.out, { recursive: true });
await Promise.all([
  writeFile(`${args.out}/meta.json`, `${JSON.stringify(meta, null, 1)}\n`),
  writeFile(`${args.out}/genes.json`, `${JSON.stringify(records)}\n`),
  writeFile(`${args.out}/codon_pca.json`, `${JSON.stringify(codonPcaFile, null, 1)}\n`),
  writeFile(`${args.out}/excluded.json`, `${JSON.stringify(excludedFile, null, 1)}\n`),
]);
process.stdout.write(
  `wrote ${records.length} genes to ${args.out}` +
  `${args.expression ? ' with expression, expressionBasis, and expressionProxy' : ''}\n`,
);
