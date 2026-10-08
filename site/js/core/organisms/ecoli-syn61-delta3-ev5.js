/**
 * The deposited Escherichia coli Syn61 delta 3 evolved variant 5 genome.
 *
 * The assembly identity and expected chromosome length mirror
 * `config/organisms.json`. The recoding declaration is deliberately narrower
 * than a historical edit manifest: the admitted sources establish the three
 * targeted codons and the deposited strain, but not every replacement event.
 * The field contract shared with the native records is in `../organisms.js`.
 */
export const ECOLI_SYN61_DELTA3_EV5 = {
  id: 'ecoli-syn61-delta3-ev5',
  label: 'E. coli Syn61',
  species: 'Escherichia coli',
  strain: 'Syn61 substr. delta 3 (ev5)',
  shortName: 'Syn61Δ3(ev5)',
  title: 'Escherichia coli Syn61Δ3(ev5) recoding-diversity map',
  description: 'Interactive gene-level map of the deposited Escherichia coli '
    + 'Syn61 delta 3 evolved variant 5 coding genome.',
  dataDirectory: 'data/organisms/ecoli-syn61-delta3-ev5/',
  storageNamespace: 'recoding-map.ecoli-syn61-delta3-ev5',
  exportTag: 'ecoli-syn61-delta3-ev5',
  handoffStrain: 'Escherichia-coli-Syn61-delta3-ev5',
  genome: {
    accession: 'GCA_028355435.1',
    replicons: [
      { accession: 'CP116771.1', lengthBp: 3977501, role: 'chromosome', label: 'Chromosome', primary: true },
    ],
  },
  genomeCitation: {
    id: 'ncbi-ecoli-syn61-delta3-ev5',
    label: 'E. coli Syn61 delta 3 evolved variant 5 GenBank assembly',
  },
  citationLabels: {},
  searchAliases: {
    'atp synthase': ['ATP synthase'],
    ribosome: ['ribosomal protein'],
    rnap: ['RNA polymerase'],
  },
  searchAliasExample: 'rnap',
  freshAxes: { x: 'lengthNt', y: 'gc3' },
  locusExample: 'PPG85_00005',
  annotationSources: [],
  layers: {},
  recoding: {
    schemeId: 'syn61',
    schemeName: 'Syn61 three-codon scheme',
    targets: ['TCA', 'TCG', 'TAG'],
    scope: 'Deposited whole-genome Syn61Δ3(ev5) sequence',
    source: 'Assembly GCA_028355435.1; chromosome CP116771.1',
    replacements: null,
    replacementNote: 'Historical replacements are unavailable from the admitted strain record; '
      + 'they are not inferred from the codons that survive in the deposited genome.',
  },
  copy: {
    annotationSourceHint: null,
    tabBlurbs: {
      native: 'Each dot is a gene from the deposited recoded genome, placed by a PCA refitted '
        + 'to this genome. Separation reflects surviving synonymous variation.',
      axes: 'Choose one gene metric for each axis to inspect their relationship directly. '
        + 'CAI and tAI remain selectable on either axis.',
      chromosome: 'Every plotted CDS at its position on the deposited 3.98 Mb chromosome. '
        + 'Selecting a CDS opens it in the gene visualizer.',
      regulatory: '',
    },
    nativeProjectionSummary: 'The PCA is refitted to the deposited Syn61Δ3(ev5) genome: 59 '
      + 'relative synonymous codon use (RSCU) columns are standardized across its included '
      + 'coding genes before PCA. Separation therefore reflects surviving synonymous variation '
      + 'within this recoded genome; these are not parent-fixed axes.',
    copyNumberNote: null,
    copyNumberSentence: null,
    coordinateEvidenceNote: 'A value a source does not report is absent here, never zero.',
    noAdmittedTrackData: 'No start-site, ribosome-occupancy, translation-initiation-site, or '
      + 'transcription-termination-site data set is admitted for this strain, so none of those '
      + 'tracks is drawn.',
    directProteomicsLabel: 'Direct proteomics detection',
    goSearchNote: 'No GO relationship layer is admitted for this deposited genome.',
    metricMethods: {},
    metricReading: {
      cai: 'A convention-derived index, not a measurement: read it as supporting context '
        + 'for a candidate, never as the primary evidence.',
      tai: 'A convention-derived index, not a measurement: read it as supporting context '
        + 'for a candidate, never as the primary evidence.',
      expressionProxy: 'A rank built from CAI and tAI, so it inherits both conventions: '
        + 'read it as supporting context.',
    },
    goTermsCaveat: 'No GO relationship layer is admitted for this deposited genome.',
  },
};
