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
 *   --organism <id>      which organism's fixture to write (default utex2973).
 *                        `ecoli-k12-mg1655` is the second organism: its own
 *                        locus namespace, one replicon, its own genome
 *                        accession, taxid and length, and a content manifest
 *                        that lists only the files it publishes, so every
 *                        optional layer is absent by declaration. Nothing in it
 *                        names the default organism or any of its studies.
 *   --with-expression    add the contract's `expression` fields plus
 *                        `meta.expressionSource`, so the opt-in low-traffic
 *                        overlay and its provenance notice can be exercised.
 *                        Every gene then carries `expressionBasis`: most are
 *                        measured, one in seventeen has only the proxy, and one
 *                        in fifty-three has neither, so the interface's rule that
 *                        missing never looks like the median is actually tested.
 *   --with-annotations   add `annotations.json`, `go-term-names-v1.json`, and the
 *                        `meta.annotationRelease` that makes the first of them
 *                        mandatory, for an organism whose release publishes them.
 *                        Every gene carries an evidence record and about three in
 *                        five carry GO relationships, including one obsolete id,
 *                        so the detail panel, GO-name search, and export all have
 *                        something real to read.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

/** The options a fixture is built from, with every default filled in. */
function resolveOptions({
  genes = 300, seed = 20260918, expression = false, annotations = false, organism = 'utex2973',
} = {}) {
  if (!Number.isInteger(genes) || genes < 1) throw new Error('--genes must be a positive integer');
  if (!Object.hasOwn(PROFILES, organism)) throw new Error(`unknown organism ${organism}`);
  if (expression && !PROFILES[organism].expression) {
    throw new Error(`${organism} has no expression layer, so --with-expression does not apply`);
  }
  if (annotations && !PROFILES[organism].annotations) {
    throw new Error(`${organism} has no annotation layer, so --with-annotations does not apply`);
  }
  return { genes, seed, expression, annotations, organism };
}

function parseArgs(argv) {
  const args = { out: resolve(HERE, 'data') };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--out') args.out = resolve(process.cwd(), argv[(i += 1)]);
    else if (flag === '--genes') args.genes = Number(argv[(i += 1)]);
    else if (flag === '--seed') args.seed = Number(argv[(i += 1)]);
    else if (flag === '--with-expression') args.expression = true;
    else if (flag === '--with-annotations') args.annotations = true;
    else if (flag === '--organism') args.organism = argv[(i += 1)];
    else throw new Error(`unknown flag ${flag}`);
  }
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

/** Products and gene names for the second organism: nothing a phototroph alone would carry. */
const ECOLI_PRODUCTS = [
  'hypothetical protein', 'ATP synthase F1 complex subunit beta', '30S ribosomal subunit protein S12',
  'RNA polymerase subunit beta', 'DNA gyrase subunit A', 'glyceraldehyde-3-phosphate dehydrogenase A',
  'lactose permease', 'chaperonin GroEL', 'cell division protein FtsZ',
  'two-component sensor histidine kinase with a PAS domain and a GAF domain',
  'putative multidrug efflux transporter permease subunit of the resistance-nodulation-division superfamily',
  'S-adenosyl-L-methionine-dependent methyltransferase MidAlongNameWithoutAnySpacesAtAllForWrapping',
];

const ECOLI_GENE_NAMES = [
  'rpsL', 'rplA', 'atpD', 'rpoB', 'gyrA', 'gapA', 'lacY', 'groL', 'ftsZ', 'murC',
  'thrA', 'dnaK', 'recA', 'lacZ', 'trpA', 'ompF', 'phoA', 'rpoD', 'glnA', 'clpB',
];

/**
 * What differs between the organisms a fixture can be written for: the locus
 * namespace, the replicons, the genome of record, the annotation's wording,
 * and whether a content manifest is written.
 *
 * The default profile reproduces the fixture this generator has always written,
 * value for value. The second organism publishes a manifest that lists only
 * what it writes, which is how a release says its optional layers are absent.
 */
const PROFILES = {
  utex2973: {
    locus: (g) => `M744_RS${String(g * 5 + 5).padStart(5, '0')}`,
    seqids: SEQIDS,
    genome: { accession: 'GCF_000817325.1', taxid: 1350461, totalLength: 2744626 },
    products: PRODUCTS,
    geneNames: GENE_NAMES,
    excluded: ['M744_RS99990', 'M744_RS99995', 'M744_RS99999'],
    expression: true,
    annotations: false,
    manifest: false,
  },
  'ecoli-k12-mg1655': {
    locus: (g) => `b${String(g + 1).padStart(4, '0')}`,
    seqids: [{ id: 'NC_000913.3', length: 4641652, share: 1 }],
    genome: { accession: 'GCF_000005845.2', taxid: 511145, totalLength: 4641652 },
    products: ECOLI_PRODUCTS,
    geneNames: ECOLI_GENE_NAMES,
    excluded: ['b9990', 'b9995', 'b9999'],
    expression: false,
    annotations: true,
    manifest: true,
  },
};

/**
 * A small GO vocabulary for the annotated variant: ids that really exist, with
 * their real names, namespaces and aspects, so a term the page shows is a term a
 * reader can look up. One obsolete id is included on purpose, because the
 * evidence model and the search both mark an obsolete name and nothing else here
 * would reach that path.
 */
const GO_VOCABULARY = [
  { goId: 'GO:0003677', name: 'DNA binding', namespace: 'molecular_function', aspect: 'F' },
  { goId: 'GO:0003723', name: 'RNA binding', namespace: 'molecular_function', aspect: 'F' },
  { goId: 'GO:0003735', name: 'structural constituent of ribosome', namespace: 'molecular_function', aspect: 'F' },
  { goId: 'GO:0005524', name: 'ATP binding', namespace: 'molecular_function', aspect: 'F' },
  { goId: 'GO:0016491', name: 'oxidoreductase activity', namespace: 'molecular_function', aspect: 'F' },
  { goId: 'GO:0006096', name: 'glycolytic process', namespace: 'biological_process', aspect: 'P' },
  { goId: 'GO:0006412', name: 'translation', namespace: 'biological_process', aspect: 'P' },
  { goId: 'GO:0006810', name: 'transmembrane transport', namespace: 'biological_process', aspect: 'P' },
  { goId: 'GO:0055085', name: 'transmembrane transport', namespace: 'biological_process', aspect: 'P' },
  { goId: 'GO:0005737', name: 'cytoplasm', namespace: 'cellular_component', aspect: 'C' },
  { goId: 'GO:0005886', name: 'plasma membrane', namespace: 'cellular_component', aspect: 'C' },
  { goId: 'GO:0022627', name: 'cytosolic small ribosomal subunit', namespace: 'cellular_component', aspect: 'C' },
  { goId: 'GO:0006118', name: 'obsolete electron transport', namespace: 'biological_process', aspect: 'P', isObsolete: true },
];

/** The annotation methods a RefSeq prokaryotic release records. */
const ANNOTATION_METHODS = ['Protein Homology', 'GeneMarkS-2+', 'cmsearch'];

/** Non-coding neighbours an annotated release reports near a CDS. */
const NONCODING_BIOTYPES = ['tRNA', 'rRNA', 'ncRNA', 'tmRNA'];

/**
 * The annotation-evidence and GO-name layers for one organism's genes.
 *
 * Drawn from a stream of its own, seeded off the fixture's seed, so publishing
 * this layer cannot move a single byte of the files a fixture without it writes.
 * Every gene carries a record, because `annotations.json` is required to cover
 * all of them, and the names file is derived from the ids actually used, so the
 * GO coverage the loader checks holds by construction rather than by luck.
 *
 * Overlaps and neighbour distances are read back from the placed coordinates, so
 * the evidence describes the genes the fixture really wrote.
 *
 * @param {object[]} genes the placed genes.
 * @param {number} seed the fixture's seed.
 * @returns {{annotations: object, goTerms: object, coverage: object}}
 */
function annotationLayer(genes, seed) {
  const random = mulberry32((seed ^ 0x5bf03635) >>> 0);
  const annotations = {};
  const usedGoIds = new Set();
  let withGoAnnotations = 0;
  let goRelationships = 0;
  genes.forEach((gene, index) => {
    const previous = index > 0 ? genes[index - 1] : null;
    const next = index + 1 < genes.length ? genes[index + 1] : null;
    const overlapping = previous && previous.seqid === gene.seqid && gene.start <= previous.end
      ? [{ locusTag: previous.id, overlapNt: previous.end - gene.start + 1 }] : [];
    const nearby = next && next.seqid === gene.seqid && random() < 0.12
      ? [{
        locusTag: `${gene.id}-nc`,
        biotype: NONCODING_BIOTYPES[Math.floor(random() * NONCODING_BIOTYPES.length)],
        distanceNt: Math.max(1, next.start - gene.end - 1),
      }] : [];
    // Roughly the real release's GO coverage: about three genes in five carry
    // relationships, most of them one or two.
    const relationCount = random() < 0.62 ? 1 + Math.floor(random() ** 2 * 3) : 0;
    const chosen = new Set();
    while (chosen.size < relationCount) {
      chosen.add(GO_VOCABULARY[Math.floor(random() * GO_VOCABULARY.length)]);
    }
    const goAnnotations = [...chosen].map((term) => {
      usedGoIds.add(term.goId);
      return {
        goId: term.goId,
        qualifier: term.aspect === 'F' ? 'enables' : term.aspect === 'P' ? 'involved_in' : 'part_of',
        aspect: term.aspect,
        evidenceCode: 'IEA',
        reference: 'GO_REF:0000043',
        withFrom: `UniProtKB-KW:KW-${String(100 + Math.floor(random() * 900))}`,
        assignedBy: 'RefSeq',
        mappingAmbiguity: '',
        mappingMethod: 'exact RefSeq protein_id',
      };
    });
    if (goAnnotations.length > 0) withGoAnnotations += 1;
    goRelationships += goAnnotations.length;
    annotations[gene.id] = {
      repliconType: 'chromosome',
      repliconName: 'chromosome',
      annotationMethods: [ANNOTATION_METHODS[Math.floor(random() * ANNOTATION_METHODS.length)]],
      inferences: [`COORDINATES: similar to AA sequence:RefSeq:WP_${
        String(1000000 + Math.floor(random() * 8999999))}.1`],
      overlappingCds: overlapping,
      nearbyNoncodingRnas: nearby,
      goAnnotations,
    };
  });
  const goTerms = {
    schemaVersion: 1,
    source: {
      ontology: { releaseDate: '2026-05-19', url: 'https://release.geneontology.org/2026-05-19/ontology/go-basic.obo' },
      license: {
        name: 'Creative Commons Attribution 4.0 International',
        url: 'https://creativecommons.org/licenses/by/4.0/',
        attribution: 'Gene Ontology Consortium',
      },
    },
    terms: Object.fromEntries(GO_VOCABULARY
      .filter((term) => usedGoIds.has(term.goId))
      .map((term) => [term.goId, {
        name: term.name, namespace: term.namespace, isObsolete: Boolean(term.isObsolete),
      }])),
  };
  return {
    annotations,
    goTerms,
    coverage: {
      siteGenes: genes.length,
      withAnnotationEvidence: genes.length,
      withGoAnnotations,
      goRelationships,
    },
  };
}

/** `count` random ACGT bases. */
function randomBases(random, count) {
  let out = '';
  for (let i = 0; i < count; i += 1) out += 'ACGT'[Math.floor(random() * 4)];
  return out;
}

/**
 * The contract's alternate `rnaContext` form: the [-30,60) genomic window with
 * a zero-based CDS offset per base, or -1 outside the gene. A CDS shorter than
 * 60 bases runs past its stop into random downstream bases, which is exactly
 * the case the form exists for.
 */
function startWindow(upstream, cds, random) {
  const inside = cds.slice(0, 60);
  const downstream = randomBases(random, 60 - inside.length);
  return {
    sequence: upstream + inside + downstream,
    cdsOffsets: [
      ...Array(30).fill(-1),
      ...inside.split('').map((_, offset) => offset),
      ...Array(60 - inside.length).fill(-1),
    ],
  };
}

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

/**
 * Where the first gene of a run along a replicon is measured from.
 *
 * A run is a stretch of consecutive genes drawn for the same replicon; the
 * cursor restarts here each time the replicon changes, which is what has always
 * kept the multi-replicon fixture's three tracks short and independent.
 */
const RUN_ORIGIN = 480;

/** The closest a gene may start to the end of the one before it. */
const MAX_OVERLAP_NT = 15;

/**
 * Lay the drawn genes out along their replicons, inside each replicon's length.
 *
 * Coordinates follow the gaps already drawn, so any fixture whose genes fit
 * keeps the coordinates this generator has always written, byte for byte. A
 * realistic gene count does not fit: 4,287 E. coli genes draw gaps worth
 * 536 kb on top of 4.47 Mb of coding sequence, which runs 362 kb past the end
 * of a 4,641,652 bp chromosome and makes the chromosome view refuse the fixture.
 * Every positive gap on an overrunning replicon is therefore scaled by the one
 * largest factor that keeps the last gene inside it, so the layout keeps its
 * shape rather than piling its tail against the end. Drawn overlaps are left as
 * drawn. A replicon too short for the coding sequence itself cannot be laid out
 * at any spacing, and is refused rather than written out of bounds.
 *
 * Each gene's placed gap is written back to `_gap`, which is what the per-gene
 * neighbour fields read, so those describe the coordinates actually written.
 *
 * @param {object[]} genes the drawn genes, in the order they were drawn.
 * @param {{id: string, length: number}[]} seqids the profile's replicons.
 */
function placeGenes(genes, seqids) {
  const lengthOf = new Map(seqids.map((entry) => [entry.id, entry.length]));
  const gapOf = (gene) => Math.max(-MAX_OVERLAP_NT, gene._gap);
  // One pass for the largest scale each replicon can take. Within a run the
  // last gene ends at `fixed + scale * positive`, where `fixed` carries the
  // origin, the coding lengths, and the overlaps, so the bound is linear.
  const scale = new Map(seqids.map((entry) => [entry.id, 1]));
  let replicon = seqids[0].id;
  let fixed = RUN_ORIGIN - 1;
  let positive = 0;
  for (const gene of genes) {
    if (gene.seqid !== replicon) {
      replicon = gene.seqid;
      fixed = RUN_ORIGIN - 1;
      positive = 0;
    }
    const gap = gapOf(gene);
    if (gap > 0) positive += gap; else fixed += gap;
    fixed += gene.lengthNt;
    const room = lengthOf.get(replicon) - fixed;
    if (room < 0) {
      throw new Error(`${genes.length} genes do not fit on ${replicon} (${lengthOf.get(replicon)} `
        + `bp) at any spacing: ${fixed - RUN_ORIGIN + 1} bp of coding sequence by ${gene.id}`);
    }
    if (positive > 0) scale.set(replicon, Math.min(scale.get(replicon), room / positive));
  }

  // One pass to place them, at that scale. Flooring each scaled gap only ever
  // pulls a gene earlier, so the bound the scale establishes still holds.
  replicon = seqids[0].id;
  let cursor = RUN_ORIGIN;
  for (const gene of genes) {
    if (gene.seqid !== replicon) {
      replicon = gene.seqid;
      cursor = RUN_ORIGIN;
    }
    const gap = gapOf(gene);
    gene._gap = gap > 0 ? Math.floor(gap * scale.get(replicon)) : gap;
    gene.start = cursor + gene._gap;
    gene.end = gene.start + gene.lengthNt - 1;
    cursor = gene.end + 1;
  }
  return genes;
}

function main(args) {
  const profile = PROFILES[args.organism];
  const seqids = profile.seqids;
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

    const share = weightedPick(random, seqids.map((entry) => [entry, entry.share]));
    const lengthNt = lengthCodons * 3 + 3;
    // Coordinates are assigned by `placeGenes` once every length and gap is
    // drawn, because fitting a replicon is a property of the whole run.
    const gap = Math.round(-6 + random() * 260);

    if (operonRemaining === 0) {
      operonSize = 1 + Math.floor(random() * 4);
      operonRemaining = operonSize;
      operonIndex += 1;
    }
    const operonPosition = operonSize - operonRemaining + 1;
    operonRemaining -= 1;
    const inOperon = operonSize > 1;

    genes.push({
      id: profile.locus(g),
      name: random() < 0.42 ? profile.geneNames[Math.floor(random() * profile.geneNames.length)] : null,
      product: profile.products[Math.floor(random() * profile.products.length)],
      seqid: share.id,
      start: null,
      end: null,
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
  placeGenes(genes, seqids);

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
      // Rounded so the fixture's bytes are the same on every platform: the
      // unrounded mean differs in its last bit between arm64 and x64, which is
      // enough to move the digest the generator test pins.
      cps: Math.round((cpsSum / pairs) * 1e9) / 1e9,
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
      // The contract's exact start window: 30 upstream bases in transcription
      // orientation for an ordinary CDS, or the 90-base genomic window with a
      // CDS offset per base. One gene carries the second form so its decoder
      // is exercised against the fixture as well as against hand-made records.
      rnaContext: g === 41
        ? startWindow(randomBases(random, 30), nucleotides + gene.terminalStop, random)
        : { upstream: randomBases(random, 30) },
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

  // Per the contract: every codon's total, and the editable count that leaves out
  // position zero. Stops live only at the terminus, so both numbers are the tally
  // of genes ending with them.
  const codonOccurrences = {};
  codons.forEach((codon, index) => {
    codonOccurrences[codon] = { total: 0, editable: 0 };
  });
  packedIndices.forEach((indices) => {
    for (let i = 0; i < indices.length; i += 1) {
      const entry = codonOccurrences[codons[indices[i]]];
      entry.total += 1;
      if (i > 0) entry.editable += 1;
    }
  });
  for (const gene of genes) {
    codonOccurrences[gene.terminalStop].total += 1;
    codonOccurrences[gene.terminalStop].editable += 1;
  }

  const meta = {
    schemaVersion: 1,
    builtAt: new Date(Date.UTC(2026, 8, 18, 20, 0, 0)).toISOString(),
    genome: { ...profile.genome },
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
    codonOccurrences,
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

  const [first, second, third] = profile.excluded;
  const excludedFile = [
    { id: first, reason: 'length_not_multiple_of_3', lengthNt: 755 },
    { id: second, reason: 'internal_stop_codon', lengthNt: 1203 },
    { id: third, reason: 'pseudo', lengthNt: 402 },
  ];

  // The annotation layer and the release that makes it mandatory, together: a
  // dataset declaring `annotationRelease` without `annotations.json` is one the
  // loader refuses, so neither is written without the other.
  let annotationsFile = null;
  let goTermsFile = null;
  if (args.annotations) {
    const layer = annotationLayer(genes, args.seed);
    annotationsFile = layer.annotations;
    goTermsFile = layer.goTerms;
    meta.annotationRelease = {
      releaseId: `${profile.genome.accession}-RS_2026_05_13`,
      schemaVersion: 1,
      siteFile: 'annotations.json',
      coverage: layer.coverage,
      goAttribution: {
        creator: 'Gene Ontology Consortium',
        license: 'CC BY 4.0',
        source: 'https://geneontology.org/',
        notice: 'GO relationships are evidence-coded annotations, not an inferred pathway '
          + 'or functional-category assignment.',
      },
    };
  }

  return { meta, records, codonPcaFile, excludedFile, annotationsFile, goTermsFile };
}

/** The content manifest for a set of files: each one's byte size and SHA-256. */
function contentManifest(files) {
  const entries = {};
  for (const [name, text] of Object.entries(files)) {
    const bytes = Buffer.from(text, 'utf8');
    entries[name] = {
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  return { schemaVersion: 1, files: entries };
}

/**
 * Build one organism's fixture in memory.
 *
 * Tests read the result directly, so no test depends on a directory another
 * step had to write first; the command line below writes the same files to
 * disk for the rendered checks.
 *
 * @param {{genes?: number, seed?: number, expression?: boolean, annotations?: boolean,
 *   organism?: string}} [options]
 * @returns {{options: object, files: Record<string, string>}} each published
 *   file's exact text by name, with `data-manifest.json` among them for an
 *   organism whose profile publishes one.
 */
export function buildFixture(options = {}) {
  const resolved = resolveOptions(options);
  const {
    meta, records, codonPcaFile, excludedFile, annotationsFile, goTermsFile,
  } = main(resolved);
  const files = {
    'meta.json': `${JSON.stringify(meta, null, 1)}\n`,
    'genes.json': `${JSON.stringify(records)}\n`,
    'codon_pca.json': `${JSON.stringify(codonPcaFile, null, 1)}\n`,
    'excluded.json': `${JSON.stringify(excludedFile, null, 1)}\n`,
  };
  if (annotationsFile) {
    files['annotations.json'] = `${JSON.stringify(annotationsFile)}\n`;
    files['go-term-names-v1.json'] = `${JSON.stringify(goTermsFile, null, 1)}\n`;
  }
  if (PROFILES[resolved.organism].manifest) {
    files['data-manifest.json'] = `${JSON.stringify(contentManifest(files), null, 1)}\n`;
  }
  return { options: resolved, files };
}

// Run as a script: write the fixture to disk. Imported: build it on request.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { out, ...options } = parseArgs(process.argv.slice(2));
  const fixture = buildFixture(options);
  await mkdir(out, { recursive: true });
  await Promise.all(Object.entries(fixture.files)
    .map(([name, text]) => writeFile(`${out}/${name}`, text)));
  process.stdout.write(
    `wrote ${fixture.options.genes} genes to ${out}`
    + `${fixture.options.expression ? ' with expression, expressionBasis, and expressionProxy' : ''}`
    + `${fixture.options.annotations ? ' with annotation evidence and GO term names' : ''}\n`,
  );
}
