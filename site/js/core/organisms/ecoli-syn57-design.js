/** The complete publisher-deposited Ec_Syn57 design, not a measured isolate. */
export const ECOLI_SYN57_DESIGN = {
  id: 'ecoli-syn57-design',
  label: 'E. coli Syn57 design',
  species: 'Escherichia coli',
  strain: 'Ec_Syn57 complete design · design only',
  shortName: 'Ec_Syn57 design',
  title: 'Ec_Syn57 complete-design recoding-diversity map',
  description: 'Interactive gene-level map of the complete published Ec_Syn57 design. '
    + 'This design record is not a measured isolate and carries no assay measurements.',
  dataDirectory: 'data/organisms/ecoli-syn57-design/',
  storageNamespace: 'recoding-map.ecoli-syn57-design',
  exportTag: 'ecoli-syn57-design',
  handoffStrain: 'Escherichia-coli-Ec-Syn57-complete-design',
  genome: {
    accession: 'Ec_Syn57',
    replicons: [
      { accession: 'Ec_Syn57', lengthBp: 3973902, role: 'chromosome', label: 'Design chromosome', primary: true },
    ],
  },
  genomeCitation: {
    id: 'nyerges-2026-syn57-design',
    label: 'Nyerges 2026 Ec_Syn57 complete design',
  },
  citationLabels: {},
  searchAliases: {
    'atp synthase': ['ATP synthase'],
    ribosome: ['ribosomal protein'],
    rnap: ['RNA polymerase'],
  },
  searchAliasExample: 'rnap',
  freshAxes: { x: 'lengthNt', y: 'gc3' },
  locusExample: 'b0002',
  annotationSources: [],
  layers: {},
  recoding: {
    recordType: 'design',
    schemeId: 'ec-syn57',
    schemeName: 'Ec_Syn57 seven-codon design',
    targets: ['AGC', 'AGT', 'TTA', 'TTG', 'AGA', 'AGG', 'TAG'],
    scope: 'Complete 3,973,902 bp circular Ec_Syn57 design sequence in native design coordinates',
    source: 'Nyerges et al. 2026, DOI 10.1038/s41467-026-74300-9; publisher Source Data Ec_Syn57.gb.',
    replacements: 'The Ec_Syn57 aggregate simulation uses whole-percentage shares rounded from '
      + 'observed substitutions in 3,490 matched design/MG1655 CDS pairs. It does not reconstruct '
      + 'the complete design or claim exact design-wide replacement shares.',
    replacementNote: 'This is the complete published design, not a reconstruction of a partial isolate.',
  },
  referenceCodonPca: null,
  copy: {
    annotationSourceHint: null,
    tabBlurbs: {
      native: 'Each dot is a gene from the complete Ec_Syn57 design, placed by a PCA refitted '
        + 'to this design sequence. These sequence-derived coordinates are not measurements.',
      axes: 'Choose one design-derived gene metric for each axis. CAI and tAI are calculated '
        + 'sequence conventions, not expression measurements.',
      chromosome: 'Every included CDS at its native position on the 3.97 Mb Ec_Syn57 design chromosome.',
      regulatory: '',
    },
    nativeProjectionSummary: 'The PCA is refitted to the complete Ec_Syn57 design: 59 relative '
      + 'synonymous codon use columns are standardized across included design CDSs before PCA. '
      + 'It describes sequence variation within the design and no measured phenotype.',
    copyNumberNote: null,
    copyNumberSentence: null,
    coordinateEvidenceNote: 'Coordinates are native to the complete Ec_Syn57 design. A value the '
      + 'design annotation does not report is absent, never zero.',
    noAdmittedTrackData: 'No start-site, ribosome-occupancy, translation-initiation-site, '
      + 'transcription-termination-site, omics, growth, or fitness data set is admitted for this '
      + 'design record, so none of those tracks is drawn.',
    directProteomicsLabel: 'Direct proteomics detection',
    goSearchNote: 'No GO relationship layer is admitted for this design record.',
    metricOrigin: 'Derived from the publisher-deposited Ec_Syn57 complete-design CDSs in native design coordinates; this is not a RefSeq assembly or a measurement.',
    metricMethods: {
      tai: 'Dos Reis tAI over a defined approximate annotation model: 75 ordinary codon-recognition notes are reverse-complemented, three explicit initiator anticodon notes are used as stated, one Sec special convention is excluded from the elongator pool, and six unsupported tRNAs are excluded from the model. These are not established genomic anticodons or charging calls.',
      minLocalTai: 'Minimum sliding-window mean of the same qualified approximate tAI weights; the Sec convention is excluded from the elongator pool and six unsupported tRNAs are excluded from the model.',
      expressionProxy: 'Tie-aware rank of √(CAI × tAI), where tAI uses the qualified approximate tRNA annotation model. This is a sequence model, not measured expression.',
    },
    metricReading: {
      cai: 'A sequence-derived convention, not a measurement: use it as design context only.',
      tai: 'A defined approximate annotation model using 75 reverse-complemented ordinary notes and three explicit initiator notes; one Sec convention is excluded from the elongator pool and six unsupported tRNAs are excluded from the model. These are not established anticodons or charging measurements.',
      expressionProxy: 'A rank built from CAI and the qualified approximate tAI model; it is design context, not expression.',
    },
    goTermsCaveat: 'No GO relationship layer is admitted for this design record.',
  },
};
