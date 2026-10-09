/**
 * Synechococcus elongatus UTEX 2973: the organism the site opens on.
 *
 * Every fact and sentence here is one the page showed before it could show a
 * second organism, moved out of the modules that used to spell it. The field
 * contract is in `../organisms.js`.
 */
export const UTEX2973 = {
  id: 'utex2973',
  label: 'Cyanobacteria',
  species: 'Synechococcus elongatus',
  strain: 'UTEX 2973',
  shortName: 'UTEX 2973',
  title: 'Synechococcus elongatus recoding-diversity map',
  description: 'Interactive gene-level map of the Synechococcus elongatus UTEX 2973 coding '
    + 'genome for choosing genome-recoding targets.',
  dataDirectory: 'data/',
  // The keys this browser already holds its saved schemes and shortlist under.
  storageNamespace: 'cyano',
  // The default organism's files keep the names they have always had.
  exportTag: null,
  handoffStrain: 'Synechococcus-elongatus-UTEX-2973',
  genome: {
    accession: 'GCF_000817325.1',
    replicons: [
      { accession: 'NZ_CP006471.1', lengthBp: 2690418, role: 'chromosome', label: 'Chromosome', primary: true },
      { accession: 'NZ_CP006472.1', lengthBp: 46366, role: 'plasmid', label: 'Plasmid', primary: false },
      { accession: 'NZ_CP006473.1', lengthBp: 7842, role: 'plasmid', label: 'Plasmid', primary: false },
    ],
  },
  genomeCitation: { id: 'ncbi-utex-2973', label: 'UTEX 2973 RefSeq release' },
  citationLabels: {
    'simkovsky-2022': 'Simkovsky et al. 2022, RNA-seq and RB-TnSeq',
    'tan-2018': 'Tan et al., UTEX TSS',
  },
  searchAliases: {
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
  },
  searchAliasExample: 'rubisco',
  // Metric X vs Y opens on CDS length against the strongest measured evidence.
  freshAxes: { x: 'lengthNt', y: 'tssInitiation' },
  locusExample: 'M744_RS00005',
  // Colour sources for the function category, in precedence order.
  annotationSources: [
    { id: 'utex-2973', label: 'UTEX 2973', role: 'reviewed' },
    { id: 'pcc-7942', label: 'PCC 7942', role: 'product' },
    { id: 'go-iea', label: 'GO IEA', role: 'go' },
  ],
  sequenceContext: {
    maxUpstreamNt: 1000,
    optionsNt: [30, 60, 120, 240, 500, 1000],
  },
  layers: {
    functionCategories: {
      summary: 'A broad cyanobacterial function for each CDS under the enabled annotation '
        + 'sources: the lab-reviewed UTEX 2973 assignment when that source is enabled and a '
        + 'reviewed row exists, otherwise a category derived from the PCC 7942 product name or '
        + 'the GO IEA terms. The same colour has the same category on every map tab.',
      derivedOrigin: 'PCC 7942 RefSeq product names at admitted joins (Adomako et al. 2022, '
        + 'CC BY 4.0); Gene Ontology IEA relationships (CC BY 4.0).',
      exportCaveat: 'The reviewed function-category table holds the {rows} '
        + 'exact UTEX 2973 locus decisions approved by the lab on '
        + '{date}; it is never changed by derived categories. '
        + 'functionCategory is the colour bucket under the enabled sources and '
        + 'functionCategoryEvidence names what produced it: reviewed, pcc-7942-derived, or '
        + 'go-iea-derived. An unknown colour does not imply that a function was experimentally '
        + 'ruled out.',
    },
    sourceDerivedCategories: {
      productLocusProvenance: ' from the product name of joined PCC locus {locus}',
      attribution: '. PCC 7942 product names: NCBI RefSeq GCF_000012525.1; joins: Adomako et al. 2022 '
        + '(CC BY 4.0), republishing Rubin et al. 2015.',
      exportCaveat: 'pcc7942DerivedCategory and goIeaDerivedCategory are computational judgments by '
        + 'TypeSafe {model} (rubric {rubric}) over the '
        + 'joined PCC 7942 RefSeq product name and the locus\u2019s GO IEA terms, assigned only at '
        + 'probability {threshold} or above. They are '
        + 'not lab review and never enter the reviewed table. Among the enabled sources colour '
        + 'follows UTEX 2973 > PCC 7942 > GO IEA; when enabled sources disagree, the '
        + 'highest-priority one sets functionCategory and functionCategoryConflict names the '
        + 'other, never the Multiple functions bucket. GO data: Gene Ontology Consortium, CC BY 4.0. PCC 7942 product '
        + 'names: NCBI RefSeq GCF_000012525.1; joins: Adomako et al. 2022 (CC BY 4.0), '
        + 'republishing Rubin et al. 2015.',
    },
    candidateEvidence: {
      tierSummaries: {
        'tested-utex-allele': 'Candidate evidence · tested UTEX allele',
        'admitted-pcc-call': 'Candidate evidence · borrowed PCC 7942 call',
        'go-iea-context': 'Candidate evidence · GO IEA context only',
        unknown: 'Candidate evidence · no determinate call',
      },
      testedSummary: 'Candidate evidence · tested UTEX allele',
      indeterminateSummary: 'Candidate evidence · no determinate PCC 7942 call',
      borrowedSummary: 'Candidate evidence · borrowed PCC 7942 call',
      tierPrecedence: ' Precedence: tested UTEX allele > PCC 7942 call > GO IEA context '
        + '> unknown.',
      goTierRank: 'This tier ranks below tested UTEX alleles and PCC 7942 calls and '
        + 'never enters the panel objective.',
      testedStudyLink: 'Ungerer et al. 2018 study',
      callUnavailable: 'PCC 7942 call unavailable',
      callIndeterminate: 'PCC 7942 call indeterminate',
      callAssumed: 'PCC 7942 evidence · cross-strain assumption',
      callAt: ' PCC locus {locus}: {status}.',
      noCall: ' No supported PCC call for this UTEX locus: {status}.',
      assumption: ' Treating PCC 7942 essentiality as UTEX 2973 essentiality is an assumption, '
        + 'not a UTEX measurement or recoding outcome.',
      assayLabel: 'PCC assay',
      growthContext: 'Growth context: the strains grew at similar rates at PCC-compatible '
        + '400 µmol photons m⁻² s⁻¹ in Ungerer et al. 2018, but have different growth '
        + 'optima. That comparison did not reproduce the Rubin screen conditions.',
      // Link text for each DOI field of the borrowed-essentiality source record.
      citationLinks: [
        ['Adomako 2022 data', 'adomakoDoi'],
        ['Rubin 2015 assay', 'rubinDoi'],
        ['Ungerer 2018 growth comparison', 'growthDoi'],
      ],
      exportCaveat: 'PCC 7942 essentiality was measured by Rubin et al. 2015 under its laboratory '
        + 'conditions and republished in Adomako et al. 2022 Data Set S1. Applying each mapped '
        + 'call to a UTEX 2973 candidate is a cross-strain assumption, not a UTEX measurement '
        + 'or a recoding outcome. Unknown or ambiguous calls never mean non-essential. '
        + 'Ungerer et al. 2018 reported similar growth at PCC-compatible light, but the strains '
        + 'have different growth optima and Rubin used different conditions.',
    },
    goIeaEssentiality: {
      tierLabels: {
        'tested-utex-allele': 'Tested UTEX 2973 allele',
        'admitted-pcc-call': 'Borrowed PCC 7942 call',
        'go-iea-context': 'GO IEA context (computational)',
        unknown: 'Unknown',
      },
      notAResult: 'This is computational inference from automated annotations, not a knockout '
        + 'result, an essentiality call, or a UTEX 2973 measurement.',
      exportCaveat: 'essentialityEvidenceTier follows tested UTEX allele > PCC 7942 call > GO IEA '
        + 'context > unknown. GO IEA context is computational inference from automated Gene '
        + 'Ontology annotations, judged by TypeSafe '
        + '{model}; it is not a knockout result or a UTEX '
        + 'measurement and never enters the panel objective. annotationDiscrepancies lists every '
        + 'disagreement between GO IEA terms and the product names, reviewed category, or PCC '
        + 'call; neither source is preferred. GO data: Gene Ontology Consortium, CC BY 4.0.',
    },
    tssEvidence: {
      label: 'Tan 2018',
      fileLabel: 'Tan 2018 start sites',
      citation: 'Tan et al. 2018',
      doi: '10.1186/s13068-018-1215-8',
      exportCaveat: 'Tan 2018 TSS counts and DESeq2 comparisons have only two biological '
        + 'cultures per condition. They describe start-site initiation, not whole-gene '
        + 'RNA abundance; a gene can have multiple separately regulated TSSs.',
    },
    trnaLoci: {
      fileLabel: 'UTEX 2973 tRNA loci',
      label: 'UTEX 2973 tRNA loci',
    },
    regulatoryTss: {
      intro: 'Tan et al. measured transcription initiation in UTEX 2973. These 2,333 '
        + 'antisense, internal, and orphan or novel sites are separate from the gene-linked TSSs '
        + 'in gene detail. A published locus association is context, not proof that a site '
        + 'regulates that gene. Missing results are unknown, not zero.',
      citation: 'Tan et al. 2018',
      doi: '10.1186/s13068-018-1215-8',
      sourceSuffix: ' · UTEX 2973 · dRNA-seq · CC BY 4.0.',
      searchPlaceholder: 'e.g. aTSS-1705677 or M744_RS08610',
    },
  },
  recoding: null,
  referenceCodonPca: null,
  copy: {
    annotationSourceHint: 'Each checkbox enables one annotation source for function-category '
      + 'colouring and the legend counts only; the detail panel, lists, search, and export '
      + 'always show every source. Colour follows UTEX 2973, then PCC 7942, then GO IEA among '
      + 'the enabled sources: a lab-reviewed assignment wins, otherwise a category derived from '
      + 'the PCC 7942 product name or the GO IEA terms, drawn as a hollow ring with a centre dot '
      + 'and labelled as derived. A lower source that disagrees never changes the colour; the '
      + 'gene detail names the conflict.',
    // The blurb under each tab whose wording states an organism fact.
    tabBlurbs: {
      native: 'Each dot is a gene, placed by how it uses synonymous codons in the wild-type genome. '
        + 'Two genes close together prefer the same codons, whatever they do in the cell. '
        + 'Short CDSs have more zero RSCU entries and can shift along PC2; length filters keep these coordinates fixed.',
      axes: 'Choose one gene metric for each axis to inspect their relationship directly. '
        + 'A fresh view compares CDS length with measured UTEX 2973 evidence, and the note '
        + 'below the selectors states that measurement\u2019s replicate and condition limits. '
        + 'CAI and tAI remain selectable on either axis.',
      chromosome: 'Every plotted CDS at its position on the genome of record: the 2.69 Mb '
        + 'chromosome as the primary linear track, with both plasmids beneath it as explicit '
        + 'secondary tracks at their own scales. Selecting a CDS opens it in the gene visualizer.',
      regulatory: 'Explore UTEX 2973 antisense, internal, and orphan or novel transcription start sites from Tan et al. 2018.',
    },
    nativeProjectionSummary: 'The wild-type PCA uses 59 relative synonymous codon use (RSCU) columns. Each codon value is its observed use divided by equal use within that amino-acid family. Columns are standardized across genes before PCA; the map shows PC1 and PC2. PC2 correlates with CDS length (Pearson r = 0.141) and zero-RSCU count (r = -0.274). Downsampling long genes to 75 codons explains only part of the observed short-CDS shift. Filtering keeps the published coordinates fixed.',
    copyNumberNote: 'Every per-gene value on this view is per genome copy. This '
      + 'chromosome is present in many copies per cell, that number changes with growth '
      + 'condition, and no source in this release records it, so nothing here is a per-cell '
      + 'dosage.',
    copyNumberSentence: 'Every value here is per genome copy. This chromosome is present in '
      + 'multiple copies per cell and no source in this release records that copy number, so no '
      + 'per-cell dosage is shown or implied.',
    coordinateEvidenceNote: 'Coordinates do not transfer between strains, so no '
      + 'sister-strain position is placed on these axes; such evidence reaches the viewer only as '
      + 'an offset against a named UTEX locus, in the gene visualizer. A value a source does not '
      + 'report is absent here, never zero.',
    noAdmittedTrackData: 'No ribosome-occupancy, translation-initiation-site, '
      + 'transcription-termination-site, or start-site data set beyond Tan 2018 is admitted for '
      + 'this strain or its admitted sister strains, so none of those tracks is drawn.',
    directProteomicsLabel: 'Direct UTEX 2973 proteomics detection',
    goSearchNote: 'GO matches are RefSeq IEA computational suggestions, not tested '
      + 'UTEX 2973 functions. Review their evidence before selecting a candidate.',
    metricMethods: {
      cai: 'Geometric mean of synonymous codon weights relative to a fixed 71-locus '
        + 'ribosomal/housekeeping reference. Zero reference counts receive 0.5 before '
        + 'normalization; Met and Trp are excluded.',
      recodedCai: 'Apply the active scheme, then recalculate CAI with the same fixed 71-locus '
        + 'reference and 0.5 zero-count convention.',
      expressionPercentile: 'Midrank percentile of the PCC 7942 measured abundance values among '
        + 'genes with a mapped value; it is not a UTEX 2973 measurement.',
      expression: 'DESeq2 normalized transcript counts from the mapped PCC 7942 study; no value '
        + 'is imputed for an unmatched UTEX locus.',
    },
    metricReading: {
      cai: 'A convention-derived index, not a measurement: read it as supporting context '
        + 'for a candidate, behind measured UTEX 2973 evidence, never as the primary evidence.',
      tai: 'A convention-derived index, not a measurement: read it as supporting context '
        + 'for a candidate, behind measured UTEX 2973 evidence, never as the primary evidence.',
      expressionProxy: 'A rank built from CAI and tAI, so it inherits both conventions: '
        + 'read it as supporting context, behind measured UTEX 2973 evidence.',
    },
    goTermsCaveat: 'GO relationships are RefSeq IEA computational suggestions, not '
      + 'experimentally tested UTEX 2973 functions. Obsolete GO IDs retain their historical '
      + 'names and are not remapped.',
  },
};
