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
  citationLabels: {
    'ncbi-ecoli-mds42-public-reference': 'NCBI MDS42 public reference AP012306.1',
  },
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
  strainFitnessDatasets: [{
    id: 'nyerges-2026-syn61-fitness',
    label: 'Nyerges 2026 strain growth and Biolog fitness',
    file: 'strain_fitness.json',
  }],
  recoding: {
    schemeId: 'syn61',
    schemeName: 'Syn61 three-codon scheme',
    targets: ['TCA', 'TCG', 'TAG'],
    scope: 'Deposited whole-genome Syn61Δ3(ev5) sequence',
    source: 'Assembly GCA_028355435.1; chromosome CP116771.1. Original Syn61 design: '
      + 'Fredens et al. 2019; Chin lab depositor comments, Addgene #174513.',
    replacements: 'Original Syn61 design: TCG → AGC, TCA → AGT, TAG → TAA (100% per target). '
      + 'This is the published design prescription, not an ev5 per-locus edit history; '
      + 'the evolved deposited genome has the observed residuals shown above.',
    replacementNote: 'The original design prescription does not establish every ev5 replacement event.',
  },
  referenceCodonPca: {
    panelName: 'MDS42 public-reference codon space',
    parentOrganismId: 'ecoli-mds42-public-reference',
    parentLabel: 'Escherichia coli str. K-12 substr. MDS42',
    parentGenomeAccession: 'GCF_000350185.1',
    parentSequenceAccession: 'AP012306.1',
    parentTaxid: 1110693,
    childLabel: 'Escherichia coli Syn61 substr. delta 3 (ev5)',
    citationId: 'ncbi-ecoli-mds42-public-reference',
  },
  copy: {
    annotationSourceHint: null,
    tabBlurbs: {
      native: 'Each dot is a gene from the deposited recoded genome, placed by a PCA refitted '
        + 'to this genome. Separation reflects surviving synonymous variation.',
      reference: 'Each dot is a Syn61 gene projected into the fixed axes fitted on public MDS42 '
        + 'AP012306.1. That public reference differs from the 2026 study stock and represents '
        + 'historical lineage, not an exact isogenic experimental parent. Removed sense codons '
        + 'TCA and TCG dominate the expected shift; TAG is a stop, not an RSCU feature. These '
        + 'sequence-derived coordinates do not measure fitness or expression and must not be '
        + 'mixed with those scales.',
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
    referenceProjectionSummary: 'This map applies the complete scaler and PCA transform fitted '
      + 'on public MDS42 AP012306.1 to Syn61 RSCU vectors. The removed sense codons TCA and TCG '
      + 'dominate the expected shift; TAG is a stop and is not one of the 59 RSCU features. '
      + 'The coordinates do not measure fitness, expression, or causal recoding effects, and '
      + 'the public reference differs from the 2026 MDS42 study stock.',
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
