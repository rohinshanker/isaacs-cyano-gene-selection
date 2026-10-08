/** Public DH10B reference assembly; not asserted equal to the Nyerges 2026 stock. */
export const ECOLI_DH10B_PUBLIC_REFERENCE = {
  id: 'ecoli-dh10b-public-reference',
  label: 'DH10B public reference',
  species: 'Escherichia coli',
  strain: 'K-12 DH10B public reference',
  shortName: 'DH10B public reference',
  title: 'E. coli DH10B public-reference recoding-diversity map',
  description: 'Interactive gene-level map of the public Escherichia coli DH10B '
    + 'CP000948.1 reference genome; not an asserted 2026 experimental-stock genome.',
  dataDirectory: 'data/organisms/ecoli-dh10b-public-reference/',
  storageNamespace: 'recoding-map.ecoli-dh10b-public-reference',
  exportTag: 'ecoli-dh10b-public-reference',
  handoffStrain: 'Escherichia-coli-DH10B-public-reference',
  genome: {
    accession: 'GCF_000019425.1',
    replicons: [
      { accession: 'NC_010473.1', lengthBp: 4686137, role: 'chromosome', label: 'Chromosome (CP000948.1)', primary: true },
    ],
  },
  genomeCitation: {
    id: 'ncbi-ecoli-dh10b-public-reference',
    label: 'NCBI DH10B public reference CP000948.1',
  },
  citationLabels: {},
  searchAliases: {
    'atp synthase': ['ATP synthase'],
    ribosome: ['ribosomal protein'],
    rnap: ['RNA polymerase'],
  },
  searchAliasExample: 'rnap',
  freshAxes: { x: 'lengthNt', y: 'gc3' },
  locusExample: 'ECDH10B_RS00005',
  annotationSources: [],
  layers: {},
  recoding: null,
  referenceCodonPca: null,
  copy: {
    annotationSourceHint: null,
    tabBlurbs: {
      native: 'Each dot is a gene from the public DH10B CP000948.1 reference, placed by a '
        + 'codon PCA fitted only to this reference. No 2026 experimental omics or fitness '
        + 'value is attached to this record, which is not the exact 2026 study-stock genome.',
      axes: 'Choose two sequence-derived gene metrics. This public-reference record carries no '
        + 'experimental omics or fitness values.',
      chromosome: 'Every plotted CDS at its position on public DH10B CP000948.1 '
        + '(RefSeq NC_010473.1). The study-stock genotype differs and exact stock equality is '
        + 'not established.',
      regulatory: '',
    },
    nativeProjectionSummary: 'The native PCA standardizes 59 RSCU columns across genes from '
      + 'public DH10B CP000948.1 and fits this reference alone. It is a sequence-derived '
      + 'reference view, not an experimental measurement or an exact model of the 2026 stock.',
    copyNumberNote: null,
    copyNumberSentence: null,
    coordinateEvidenceNote: 'This record contains sequence-derived public-reference values only; '
      + 'no experimental value is transferred from a study stock.',
    noAdmittedTrackData: 'No experimental start-site, ribosome-occupancy, translation-initiation, '
      + 'termination, omics, growth, or fitness data are attached to this public reference.',
    directProteomicsLabel: 'Direct proteomics detection',
    goSearchNote: 'No GO relationship layer is admitted for this public reference.',
    metricMethods: {},
    metricReading: {
      cai: 'A sequence-derived convention, not expression or fitness measured in the study stock.',
      tai: 'A sequence-derived convention, not expression or fitness measured in the study stock.',
      expressionProxy: 'A rank derived from CAI and tAI; it is not experimental expression.',
    },
    goTermsCaveat: 'No GO relationship layer is admitted for this public reference.',
  },
};
