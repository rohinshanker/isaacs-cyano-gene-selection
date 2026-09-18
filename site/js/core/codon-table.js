/**
 * Codon alphabet and genetic-code utilities.
 *
 * The packed `codons` string in genes.json encodes one character per codon over
 * a 64-symbol alphabet. The index-to-codon ordering is authoritative in
 * `meta.codonAlphabet`; this module reads it rather than recomputing it.
 */

/** Amino acids for the 64 codons in TCAG triplet order (NCBI translation table 1/11). */
const STANDARD_AA =
  'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';

const BASES = 'TCAG';

/** The 64 codons in standard TCAG order: TTT, TTC, TTA, TTG, TCT, ... GGG. */
export function standardCodonList() {
  const codons = [];
  for (const first of BASES) {
    for (const second of BASES) {
      for (const third of BASES) codons.push(first + second + third);
    }
  }
  return codons;
}

const STANDARD_CODONS = standardCodonList();
const STANDARD_INDEX = new Map(STANDARD_CODONS.map((codon, i) => [codon, i]));

/** Amino acid letter for a codon, `*` for stop. Throws on an unknown codon. */
export function standardAminoAcid(codon) {
  const index = STANDARD_INDEX.get(codon);
  if (index === undefined) throw new Error(`not a codon: ${codon}`);
  return STANDARD_AA[index];
}

/**
 * Decoded view of `meta.codonAlphabet`, with lookups the hot loops need.
 */
export class CodonTable {
  /**
   * @param {Array<{sym: string, codon: string, aa: string}>} alphabet 64 entries.
   */
  constructor(alphabet) {
    if (!Array.isArray(alphabet) || alphabet.length !== 64) {
      throw new Error(`codonAlphabet must have 64 entries, got ${alphabet?.length}`);
    }
    this.size = 64;
    this.symbols = new Array(64);
    this.codons = new Array(64);
    this.aas = new Array(64);
    this.symbolToIndex = new Int16Array(128).fill(-1);
    this.codonToIndex = new Map();
    this.isStop = new Uint8Array(64);
    this.isGc3 = new Uint8Array(64);

    alphabet.forEach((entry, i) => {
      const { sym, codon, aa } = entry;
      if (typeof sym !== 'string' || sym.length !== 1) {
        throw new Error(`codonAlphabet[${i}].sym must be one character`);
      }
      const code = sym.charCodeAt(0);
      if (code >= 128) throw new Error(`codonAlphabet[${i}].sym must be ASCII`);
      if (this.symbolToIndex[code] !== -1) throw new Error(`duplicate symbol ${sym}`);
      if (!/^[ACGT]{3}$/.test(codon)) throw new Error(`codonAlphabet[${i}].codon invalid: ${codon}`);
      if (this.codonToIndex.has(codon)) throw new Error(`duplicate codon ${codon}`);
      const standard = standardAminoAcid(codon);
      if (aa !== undefined && aa !== standard) {
        throw new Error(`codonAlphabet[${i}] says ${codon}=${aa}, standard code says ${standard}`);
      }
      this.symbols[i] = sym;
      this.codons[i] = codon;
      this.aas[i] = standard;
      this.symbolToIndex[code] = i;
      this.codonToIndex.set(codon, i);
      this.isStop[i] = standard === '*' ? 1 : 0;
      this.isGc3[i] = codon[2] === 'G' || codon[2] === 'C' ? 1 : 0;
    });

    /** @type {Map<string, number[]>} amino acid (or `*`) to codon indices. */
    this.family = new Map();
    for (let i = 0; i < 64; i += 1) {
      const aa = this.aas[i];
      if (!this.family.has(aa)) this.family.set(aa, []);
      this.family.get(aa).push(i);
    }
    /** Family size for each codon index; 1 means the codon cannot be recoded. */
    this.familySize = new Uint8Array(64);
    for (let i = 0; i < 64; i += 1) this.familySize[i] = this.family.get(this.aas[i]).length;
  }

  /** Codon index for a codon string, or -1. */
  indexOf(codon) {
    const index = this.codonToIndex.get(codon);
    return index === undefined ? -1 : index;
  }

  /** Synonymous alternatives to `codon`, excluding itself, in alphabet order. */
  synonymsOf(codon) {
    const index = this.indexOf(codon);
    if (index < 0) return [];
    return this.family
      .get(this.aas[index])
      .filter((other) => other !== index)
      .map((other) => this.codons[other]);
  }

  /** Decode a packed codon string into codon indices. */
  decode(packed) {
    const out = new Uint8Array(packed.length);
    for (let i = 0; i < packed.length; i += 1) {
      const index = this.symbolToIndex[packed.charCodeAt(i)];
      if (index < 0) throw new Error(`unknown codon symbol ${JSON.stringify(packed[i])} at ${i}`);
      out[i] = index;
    }
    return out;
  }

  /** Encode codon indices back into a packed string. */
  encode(indices) {
    let out = '';
    for (let i = 0; i < indices.length; i += 1) out += this.symbols[indices[i]];
    return out;
  }

  /** Protein string for codon indices, used to prove a scheme is synonymous. */
  translate(indices) {
    let out = '';
    for (let i = 0; i < indices.length; i += 1) out += this.aas[indices[i]];
    return out;
  }
}
