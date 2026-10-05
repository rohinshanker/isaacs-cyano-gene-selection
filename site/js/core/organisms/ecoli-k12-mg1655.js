/**
 * Escherichia coli K-12 MG1655.
 *
 * A RefSeq-only release: sequence, annotation, and what is computed from them.
 * It declares no study-bound evidence layer, so none is requested, drawn, or
 * exported, and nothing here names another organism. The field contract is in
 * `../organisms.js`.
 */
export const ECOLI_K12_MG1655 = {
  id: 'ecoli-k12-mg1655',
  label: 'E. coli',
  species: 'Escherichia coli',
  strain: 'K-12 MG1655',
  shortName: 'E. coli K-12 MG1655',
  title: 'Escherichia coli recoding-diversity map',
  description: 'Interactive gene-level map of the Escherichia coli K-12 MG1655 coding genome '
    + 'for choosing genome-recoding targets.',
  dataDirectory: 'data/organisms/ecoli-k12-mg1655/',
  storageNamespace: 'recoding-map.ecoli-k12-mg1655',
  exportTag: 'ecoli-k12-mg1655',
  handoffStrain: 'Escherichia-coli-K-12-MG1655',
  genome: {
    accession: 'GCF_000005845.2',
    replicons: [
      { accession: 'NC_000913.3', lengthBp: 4641652, role: 'chromosome', label: 'Chromosome', primary: true },
    ],
  },
  genomeCitation: { id: 'ncbi-ecoli-k12-mg1655', label: 'E. coli K-12 MG1655 RefSeq release' },
  citationLabels: {},
  searchAliases: {
    'atp synthase': ['ATP synthase'],
    ribosome: ['ribosomal protein'],
    rnap: ['RNA polymerase'],
  },
  searchAliasExample: 'rnap',
  // No measurement is published, so Metric X vs Y opens on two sequence facts.
  freshAxes: { x: 'lengthNt', y: 'gc3' },
  locusExample: 'b0001',
  annotationSources: [],
  layers: {},
  copy: {
    annotationSourceHint: null,
    tabBlurbs: {
      native: 'Each dot is a gene, placed by how it uses synonymous codons in the wild-type genome. '
        + 'Two genes close together prefer the same codons, whatever they do in the cell.',
      axes: 'Choose one gene metric for each axis to inspect their relationship directly. '
        + 'CAI and tAI remain selectable on either axis.',
      chromosome: 'Every plotted CDS at its position on the genome of record: the 4.64 Mb '
        + 'chromosome as one linear track. Selecting a CDS opens it in the gene visualizer.',
      regulatory: '',
    },
    nativeProjectionSummary: 'The wild-type PCA uses 59 relative synonymous codon use (RSCU) '
      + 'columns. Each codon value is its observed use divided by equal use within that '
      + 'amino-acid family. Columns are standardized across genes before PCA; the map shows PC1 '
      + 'and PC2. Filtering keeps the published coordinates fixed.',
    // No copy-number statement has been decided for this organism, so none is made.
    copyNumberNote: null,
    copyNumberSentence: null,
    coordinateEvidenceNote: 'A value a source does not report is absent here, never zero.',
    noAdmittedTrackData: 'No start-site, ribosome-occupancy, translation-initiation-site, or '
      + 'transcription-termination-site data set is admitted for this strain, so none of those '
      + 'tracks is drawn.',
    directProteomicsLabel: 'Direct proteomics detection',
    goSearchNote: 'GO matches are RefSeq computational suggestions, not experimentally tested '
      + 'functions. Review their evidence before selecting a candidate.',
    metricMethods: {},
    metricReading: {
      cai: 'A convention-derived index, not a measurement: read it as supporting context '
        + 'for a candidate, never as the primary evidence.',
      tai: 'A convention-derived index, not a measurement: read it as supporting context '
        + 'for a candidate, never as the primary evidence.',
      expressionProxy: 'A rank built from CAI and tAI, so it inherits both conventions: '
        + 'read it as supporting context.',
    },
    goTermsCaveat: 'GO relationships are RefSeq computational suggestions, not experimentally '
      + 'tested functions. Obsolete GO IDs retain their historical names and are not remapped.',
  },
};
