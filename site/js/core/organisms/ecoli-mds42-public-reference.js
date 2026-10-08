/** Public MDS42 reference assembly; not the MDS42 stock assayed in Nyerges 2026. */
export const ECOLI_MDS42_PUBLIC_REFERENCE = {
  id: 'ecoli-mds42-public-reference',
  label: 'MDS42 public reference',
  species: 'Escherichia coli',
  strain: 'K-12 MDS42 public reference',
  shortName: 'MDS42 public reference',
  title: 'E. coli MDS42 public-reference recoding-diversity map',
  description: 'Interactive gene-level map of the public Escherichia coli MDS42 '
    + 'AP012306.1 reference genome; not the 2026 experimental stock.',
  dataDirectory: 'data/organisms/ecoli-mds42-public-reference/',
  storageNamespace: 'recoding-map.ecoli-mds42-public-reference',
  exportTag: 'ecoli-mds42-public-reference',
  handoffStrain: 'Escherichia-coli-MDS42-public-reference',
  genome: {
    accession: 'GCF_000350185.1',
    replicons: [
      { accession: 'NC_020518.1', lengthBp: 3976195, role: 'chromosome', label: 'Chromosome (AP012306.1)', primary: true },
    ],
  },
  genomeCitation: {
    id: 'ncbi-ecoli-mds42-public-reference',
    label: 'NCBI MDS42 public reference AP012306.1',
  },
  citationLabels: {},
  searchAliases: {
    'atp synthase': ['ATP synthase'],
    ribosome: ['ribosomal protein'],
    rnap: ['RNA polymerase'],
  },
  searchAliasExample: 'rnap',
  freshAxes: { x: 'lengthNt', y: 'gc3' },
  locusExample: 'ECMDS42_RS00005',
  annotationSources: [],
  layers: {},
  recoding: null,
  referenceCodonPca: null,
  copy: {
    annotationSourceHint: null,
    tabBlurbs: {
      native: 'Each dot is a gene from the public MDS42 AP012306.1 reference, placed by a '
        + 'codon PCA fitted only to this reference. No 2026 experimental omics or fitness '
        + 'value is attached to this record, which is not the exact 2026 study-stock genome.',
      axes: 'Choose two sequence-derived gene metrics. This public-reference record carries no '
        + 'experimental omics or fitness values.',
      chromosome: 'Every plotted CDS at its position on public MDS42 AP012306.1 '
        + '(RefSeq NC_020518.1). The 2026 study stock has a reported 51 bp insertion absent '
        + 'from this accession, so this is not an exact stock genome.',
      regulatory: '',
    },
    nativeProjectionSummary: 'The native PCA standardizes 59 RSCU columns across genes from '
      + 'public MDS42 AP012306.1 and fits this reference alone. It is a sequence-derived '
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
