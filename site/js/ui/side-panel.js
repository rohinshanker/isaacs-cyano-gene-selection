/**
 * Gene detail panel.
 *
 * Hovering previews a gene, clicking pins it. Every metric is shown with its
 * unit, its one-line description from the dataset, and its percentile against
 * the genome, because a bare number does not tell a bench scientist whether the
 * value is unusual.
 */
import {
  formatValue, formatDelta, formatPercentile, formatCount, formatExpressionSource,
  formatSpan, MISSING,
} from './format.js';
import {
  isExpressionMetric, isExpressionProxyMetric, expressionBasisOf, orderMeasuredFirst,
} from '../core/metric-registry.js';
import { annotationEvidenceModel } from '../core/annotation-evidence.js';
import { formatTssStatistic, tssEvidenceModel } from '../core/tss-evidence.js';
import { geneIdentity } from '../core/gene-identity.js';
import { createLocusTag } from './locus-tag.js';
import { candidateEvidenceFor } from '../core/candidate-evidence.js';
import { essentialityEvidenceFor } from '../core/go-iea-essentiality.js';
import {
  ALL_SOURCES, PCC_SOURCE, UTEX_SOURCE, GO_IEA_SOURCE,
  annotationSourceEvidenceNote, annotationSourceLabel, annotationSourceView,
} from '../core/annotation-source.js';

/**
 * Baseline context stays visible; scheme-only results open only when a scheme
 * exists. "Expression" holds this release's measured evidence and is listed
 * first by the registry's family order, so a reader meets the measurement
 * before the codon-usage indices in "Translation".
 */
const BASE_OPEN_FAMILIES = new Set(['Expression', 'Size', 'Translation']);
const SCHEME_OPEN_FAMILIES = new Set(['Recoding load', 'Change from wild type']);

/** A crossed pin marks the action that clears the committed selection. */
function unpinIcon() {
  const namespace = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(namespace, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  const pin = document.createElementNS(namespace, 'path');
  pin.setAttribute('d', 'M8 3h8l-1 5 2 3v2H7v-2l2-3-1-5Zm4 10v8');
  const slash = document.createElementNS(namespace, 'path');
  slash.setAttribute('d', 'M4 4l16 16');
  icon.append(pin, slash);
  return icon;
}

export function metricFamilyStartsOpen(family, schemeActive) {
  return BASE_OPEN_FAMILIES.has(family)
    || (schemeActive && SCHEME_OPEN_FAMILIES.has(family));
}

const DELTA_ROWS = [
  { label: 'GC3', unit: 'fraction', wild: 'recodedGc3', recoded: 'recodedGc3', delta: 'dGc3' },
  { label: 'CAI', unit: 'index 0-1', wild: 'recodedCai', recoded: 'recodedCai', delta: 'dCai' },
  { label: 'tAI', unit: 'index 0-1', wild: 'recodedTai', recoded: 'recodedTai', delta: 'dTai' },
  { label: 'ENC', unit: 'codons', wild: 'recodedEnc', recoded: 'recodedEnc', delta: 'dEnc' },
  { label: 'Codon-pair score', unit: 'mean log ratio', wild: 'recodedCps', recoded: 'recodedCps', delta: 'dCps' },
];

function cell(text, className) {
  const element = document.createElement('td');
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function labelledList(label, values) {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  term.textContent = label;
  const detail = document.createElement('dd');
  if (values.length === 0) {
    detail.textContent = 'None recorded';
  } else {
    const list = document.createElement('ul');
    for (const value of values) {
      const item = document.createElement('li');
      item.textContent = value;
      list.append(item);
    }
    detail.append(list);
  }
  row.append(term, detail);
  return row;
}

/**
 * The RefSeq annotation-method/inference/coordinate rows are UTEX 2973 release
 * content; the GO relationships inside the same bundle are the GO IEA source.
 * A single source shows only its own rows here, blanking the rest; PCC 7942
 * contributes nothing to this bundle at all, so the disclosure does not exist
 * in that view.
 */
function annotationDisclosure(gene, meta, goTerms, source = ALL_SOURCES) {
  if (source === PCC_SOURCE) return null;
  const model = annotationEvidenceModel(gene, meta, goTerms);
  if (!model) return null;
  const showUtex = source === ALL_SOURCES || source === UTEX_SOURCE;
  const showGo = source === ALL_SOURCES || source === GO_IEA_SOURCE;
  const details = document.createElement('details');
  details.className = 'metric-group annotation-evidence';
  const summary = document.createElement('summary');
  summary.textContent = source === ALL_SOURCES
    ? 'Annotation evidence and recoding context'
    : `Annotation evidence and recoding context — ${annotationSourceLabel(source)} only`;
  const intro = document.createElement('p');
  intro.className = 'panel-note';
  intro.textContent = source === ALL_SOURCES
    ? `Pinned RefSeq release ${model.releaseId}. Overlap and nearby-RNA rows are `
      + 'coordinate evidence, not proof of regulation. GO rows retain their evidence codes and are '
      + 'not collapsed into pathway or functional-category claims.'
    : annotationSourceEvidenceNote(source);
  const list = document.createElement('dl');
  list.className = 'annotation-evidence-list';
  if (showUtex) {
    list.append(
      labelledList('Replicon', [model.replicon]),
      labelledList('Annotation method', model.methods),
      labelledList('Inference', model.inferences),
      labelledList('Overlapping CDS', model.overlaps.map((entry) => entry.text)),
      labelledList('Nearby non-coding RNA (≤250 nt)', model.nearby.map((entry) => entry.text)),
    );
  }
  if (showGo) {
    list.append(labelledList('GO relationships', model.go.map((entry) => entry.text)));
  }
  details.append(summary, intro, list);
  if (showGo && model.attribution) {
    const attribution = document.createElement('p');
    attribution.className = 'panel-note';
    attribution.textContent = `GO: ${model.attribution.creator}; ${model.attribution.license}; `
      + `${model.attribution.source}`;
    details.append(attribution);
  }
  return details;
}

const TIER_SUMMARIES = Object.freeze({
  'tested-utex-allele': 'Candidate evidence · tested UTEX allele',
  'admitted-pcc-call': 'Candidate evidence · borrowed PCC 7942 call',
  'go-iea-context': 'Candidate evidence · GO IEA context only',
  unknown: 'Candidate evidence · no determinate call',
});

/** The GO IEA fallback wording, shown only where it can decide the tier. */
function goContextBlock(evidence, source) {
  const block = document.createElement('div');
  block.className = 'candidate-go-context';
  const text = document.createElement('p');
  const badge = document.createElement('strong');
  badge.textContent = evidence.tier === 'go-iea-context'
    ? 'GO IEA context · computational inference, not a knockout result'
    : evidence.goContext ? 'GO IEA context · not essentiality-relevant' : 'No GO IEA context';
  text.append(badge, ` ${evidence.goContextText}`);
  block.append(text);
  if (evidence.tier === 'go-iea-context') {
    const rank = document.createElement('p');
    rank.className = 'panel-note';
    rank.textContent = 'This tier ranks below tested UTEX alleles and PCC 7942 calls and '
      + 'never enters the panel objective.';
    block.append(rank);
  }
  if (evidence.goContext) block.append(goAttribution(source));
  return block;
}

/** Explicit notes wherever GO IEA terms disagree with another annotation. */
function discrepancyBlock(evidence, source) {
  const block = document.createElement('div');
  block.className = 'candidate-discrepancies';
  block.setAttribute('role', 'note');
  const heading = document.createElement('strong');
  heading.textContent = `Annotation disagreement (${evidence.discrepancies.length})`;
  const list = document.createElement('ul');
  for (const entry of evidence.discrepancies) {
    const item = document.createElement('li');
    item.textContent = entry.note;
    list.append(item);
  }
  const advice = document.createElement('p');
  advice.className = 'panel-note';
  advice.textContent = 'Neither source is preferred. Review the locus before relying on either.';
  block.append(heading, list, advice, goAttribution(source));
  return block;
}

function goAttribution(source) {
  const note = document.createElement('p');
  note.className = 'panel-note';
  const license = document.createElement('a');
  license.href = source.attribution.licenseUrl;
  license.target = '_blank';
  license.rel = 'noopener noreferrer';
  license.textContent = source.attribution.license;
  note.append(`GO IEA: ${source.attribution.creator}, `, license,
    `. Judged by TypeSafe ${source.judgment.model}, rubric ${source.judgment.rubricVersion}.`);
  return note;
}

function candidateEvidenceDisclosure(gene, data, goData) {
  const model = candidateEvidenceFor(data, gene.id);
  if (!model) return null;
  const evidence = essentialityEvidenceFor(goData, gene.id);
  const details = document.createElement('details');
  details.className = 'metric-group candidate-evidence';
  details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = evidence ? TIER_SUMMARIES[evidence.tier] : model.tested
    ? 'Candidate evidence · tested UTEX allele'
    : ['unknown', 'missing', 'ambiguous', 'not_analyzed'].includes(model.pccCall?.status)
      ? 'Candidate evidence · no determinate PCC 7942 call'
      : 'Candidate evidence · borrowed PCC 7942 call';
  details.append(summary);
  if (evidence) {
    const tier = document.createElement('p');
    tier.className = 'candidate-tier';
    const label = document.createElement('strong');
    label.textContent = `Evidence tier ${evidence.tierRank} of 4: ${evidence.tierLabel}.`;
    tier.append(label, ' Precedence: tested UTEX allele > PCC 7942 call > GO IEA context '
      + '> unknown.');
    details.append(tier);
  }

  if (model.tested) {
    const claim = document.createElement('p');
    claim.className = 'candidate-tested-claim';
    claim.textContent = model.tested.claim;
    const identity = document.createElement('p');
    identity.className = 'panel-note';
    identity.textContent = `Tested allele ${model.tested.oldLocusTag}; current locus ${gene.id}; `
      + `protein ${model.tested.proteinId}. The result is allele- and condition-specific.`;
    const condition = document.createElement('p');
    condition.className = 'panel-note';
    condition.textContent = `Assay conditions: ${model.testedSource.condition}`;
    const citation = document.createElement('a');
    citation.href = `https://doi.org/${model.testedSource.doi}`;
    citation.target = '_blank';
    citation.rel = 'noopener noreferrer';
    citation.textContent = 'Ungerer et al. 2018 study';
    details.append(claim, identity, condition, citation);
  }

  const borrowed = document.createElement('p');
  borrowed.className = 'candidate-borrowed-caution';
  const badge = document.createElement('strong');
  const call = model.pccCall;
  badge.textContent = call?.status === 'unknown'
    ? 'PCC 7942 call unavailable'
    : ['missing', 'ambiguous', 'not_analyzed'].includes(call?.status)
      ? 'PCC 7942 call indeterminate'
      : 'PCC 7942 evidence · cross-strain assumption';
  const statusLabel = {
    essential: 'essential', beneficial: 'beneficial for growth',
    'non-essential': 'non-essential under the tested conditions',
    ambiguous: 'ambiguous', not_analyzed: 'not analysed', missing: 'missing in source',
    unknown: 'unknown',
  }[call?.status] ?? 'unknown';
  const callText = call?.pccLocusTag
    ? ` PCC locus ${call.pccLocusTag}: ${statusLabel}.`
    : ` No supported PCC call for this UTEX locus: ${statusLabel}.`;
  borrowed.append(badge, callText,
    ' Treating PCC 7942 essentiality as UTEX 2973 essentiality is an assumption, '
      + 'not a UTEX measurement or recoding outcome.');
  details.append(borrowed);
  if (call?.status === 'unknown' && call.mappingReason) {
    const reason = document.createElement('p');
    reason.className = 'panel-note';
    reason.textContent = `Missing call: ${call.mappingReason}`;
    details.append(reason);
  }
  if (evidence && ['go-iea-context', 'unknown'].includes(evidence.tier)) {
    details.append(goContextBlock(evidence, goData));
  }
  if (evidence?.discrepancies.length) details.append(discrepancyBlock(evidence, goData));
  const source = model.borrowedEssentiality.source;
  const condition = document.createElement('p');
  condition.className = 'panel-note';
  condition.textContent = `PCC assay: ${source.rubinCondition}`;
  details.append(condition);
  const growth = document.createElement('p');
  growth.className = 'panel-note';
  growth.textContent = 'Growth context: the strains grew at similar rates at PCC-compatible '
    + '400 µmol photons m⁻² s⁻¹ in Ungerer et al. 2018, but have different growth '
    + 'optima. That comparison did not reproduce the Rubin screen conditions.';
  details.append(growth);
  const citation = document.createElement('p');
  citation.className = 'panel-note';
  for (const [label, doi] of [
    ['Adomako 2022 data', source.adomakoDoi],
    ['Rubin 2015 assay', source.rubinDoi],
    ['Ungerer 2018 growth comparison', source.growthDoi],
  ]) {
    if (citation.childNodes.length) citation.append(' · ');
    const link = document.createElement('a');
    link.href = `https://doi.org/${doi}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    citation.append(link);
  }
  details.append(citation);
  return details;
}

function tssValue(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : 'Unknown';
}

function tssTable(headers, rows, className, captionText) {
  const table = document.createElement('table');
  table.className = className;
  const caption = document.createElement('caption');
  caption.className = 'visually-hidden';
  caption.textContent = captionText;
  table.append(caption);
  const head = document.createElement('thead');
  const headingRow = document.createElement('tr');
  for (const header of headers) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = header;
    headingRow.append(th);
  }
  head.append(headingRow);
  const body = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = row.label;
    tr.append(label);
    for (const value of row.values) {
      const td = document.createElement('td');
      td.className = 'numeric';
      td.textContent = value;
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(head, body);
  return table;
}

function tssEvidenceDisclosure(gene, meta) {
  if (!meta?.tssEvidenceSource) return null;
  const model = tssEvidenceModel(gene);
  const details = document.createElement('details');
  details.className = 'metric-group tss-evidence';
  const summary = document.createElement('summary');
  summary.textContent = model.count === 0
    ? 'TSS initiation evidence — no mapped TSS evidence'
    : `TSS initiation evidence (${model.count} mapped `
      + `${model.count === 1 ? 'site' : 'sites'})`;
  // Measured UTEX 2973 evidence opens with the gene: its raw replicate counts
  // and condition comparisons are the first thing a candidate is read on. A
  // gene with no mapped TSS says so in the summary and stays collapsed, so an
  // explicit unknown does not take the room the evidence would.
  details.open = model.count > 0;
  details.append(summary);

  const caveat = document.createElement('p');
  caveat.className = 'panel-note tss-caveat';
  caveat.textContent = 'Start-site initiation evidence, not gene-body RNA abundance. The study has '
    + 'only two biological cultures per condition. Published gene links use 2018 start models, '
    + 'so a site can fall inside the current CDS. Missing DESeq2 results are unknown, not zero; '
    + 'no gene-level fold-change aggregate is calculated.';
  details.append(caveat);

  if (model.count === 0) {
    const empty = document.createElement('p');
    empty.className = 'tss-empty';
    empty.textContent = 'No mapped TSS evidence. This does not mean there was no transcription.';
    details.append(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'tss-site-list';
    for (const entry of model.entries) {
      const site = document.createElement('section');
      site.className = 'tss-site';
      const heading = document.createElement('h4');
      heading.textContent = entry.id;
      const location = document.createElement('p');
      location.className = 'tss-location';
      location.textContent = `${entry.type} · ${entry.replicon} · ${entry.strand} strand · `
        + `position ${tssValue(entry.position)}`
        + (Number.isFinite(entry.sourceStartDistanceNt)
          ? ` · ${tssValue(entry.sourceStartDistanceNt)} nt before the 2018 start`
          : '');
      const rawHeading = document.createElement('h5');
      rawHeading.textContent = 'Raw reads';
      const rawTable = tssTable(
        ['Condition', 'Culture 1', 'Culture 2'],
        entry.rawReads.map((row) => ({
          label: row.label,
          values: row.cultures.map(tssValue),
        })),
        'tss-table tss-reads',
        `Raw reads for ${entry.id}`,
      );
      const deHeading = document.createElement('h5');
      deHeading.textContent = 'Condition versus control (DESeq2)';
      const deTable = tssTable(
        ['Condition', 'log2FC', 'adjusted p'],
        entry.differential.map((row) => ({
          label: row.label,
          values: [formatTssStatistic(row.log2FoldChange), formatTssStatistic(row.padj)],
        })),
        'tss-table tss-differential',
        `DESeq2 condition-versus-control results for ${entry.id}`,
      );
      site.append(heading, location, rawHeading, rawTable, deHeading, deTable);
      list.append(site);
    }
    details.append(list);
  }

  const source = document.createElement('p');
  source.className = 'panel-note tss-source';
  source.append('Source: Tan et al. 2018, ');
  const doi = document.createElement('a');
  doi.href = 'https://doi.org/10.1186/s13068-018-1215-8';
  doi.textContent = 'doi:10.1186/s13068-018-1215-8';
  doi.target = '_blank';
  doi.rel = 'noopener noreferrer';
  source.append(doi, '.');
  details.append(source);
  return details;
}

export class SidePanel {
  /**
   * @param {HTMLElement} host
   * @param {{onShortlistToggle: (index: number) => void, onUnpin: () => void}} handlers
   */
  constructor(host, handlers) {
    this.host = host;
    this.handlers = handlers;
  }

  /**
   * @param {{index: number, isPinned: boolean, dataset: object, registry: object,
   *   percentileOf: (key: string, value: number) => number, schemeActive: boolean,
   *   live: object, inShortlist: boolean}} state
   */
  update(state) {
    const { index, dataset } = state;
    const source = state.annotationSource ?? ALL_SOURCES;
    const focusedAction = this.host.contains(document.activeElement)
      ? document.activeElement.dataset.detailAction : null;
    this.host.replaceChildren();
    if (index < 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Hover a gene on the map to preview it here. Click, or press Enter while '
        + 'the map has keyboard focus, to pin it.';
      this.host.append(empty);
      if (focusedAction) this.host.focus({ preventScroll: true });
      return;
    }

    const gene = dataset.genes[index];
    // "All sources" reads the gene directly, unchanged; a single source reads
    // only what that source itself annotated, leaving the rest blank.
    const view = source !== ALL_SOURCES ? annotationSourceView(gene, dataset, source) : gene;
    const identity = geneIdentity(view);
    const header = document.createElement('div');
    header.className = 'gene-header';

    if (source !== ALL_SOURCES) {
      const sourceNote = document.createElement('p');
      sourceNote.className = 'panel-note annotation-source-note';
      sourceNote.textContent = `Showing ${annotationSourceLabel(source)} annotations only. `
        + `${annotationSourceEvidenceNote(source)}`;
      header.append(sourceNote);
    }

    const title = document.createElement('h3');
    title.className = 'gene-title';
    const tag = createLocusTag(gene);
    tag.dataset.detailAction = 'identity';
    const name = document.createElement('span');
    name.className = 'gene-name';
    name.textContent = identity
      ? `${identity.kind === 'Product' ? 'Product: ' : ''}${identity.text}` : MISSING;
    title.append(tag, ' ', name);

    const status = document.createElement('p');
    status.className = 'gene-status';
    status.textContent = state.isPinned ? 'Pinned' : 'Preview — click the dot to pin it';
    const statusRow = document.createElement('div');
    statusRow.className = 'gene-status-row';
    statusRow.append(status);
    if (state.isPinned) {
      const unpinButton = document.createElement('button');
      unpinButton.type = 'button';
      unpinButton.className = 'icon-button unpin-button';
      unpinButton.dataset.detailAction = 'unpin';
      unpinButton.setAttribute('aria-label', `Unpin ${gene.id}`);
      unpinButton.title = `Unpin ${gene.id}`;
      unpinButton.append(unpinIcon());
      unpinButton.addEventListener('click', () => this.handlers.onUnpin());
      statusRow.prepend(unpinButton);
    }

    const product = document.createElement('p');
    product.className = 'gene-product';
    product.textContent = view.product ?? MISSING;

    const location = document.createElement('p');
    location.className = 'gene-location';
    location.textContent = `${gene.seqid} ${formatSpan(gene.start, gene.end, gene.strand)} · `
      + `${formatCount(gene.lengthNt)} nt · ${formatCount(gene.lengthCodons)} sense codons`
      + (gene.terminalStop ? ` · stops with ${gene.terminalStop}` : '');

    const shortlistButton = document.createElement('button');
    shortlistButton.type = 'button';
    shortlistButton.className = state.inShortlist ? 'chip-button active' : 'chip-button';
    shortlistButton.textContent = state.inShortlist
      ? 'Remove from shortlist'
      : 'Add to shortlist';
    shortlistButton.dataset.detailAction = 'shortlist';
    shortlistButton.addEventListener('click', () => this.handlers.onShortlistToggle(index));

    header.append(title, statusRow);
    if (identity?.kind === 'Gene symbol') header.append(product);
    header.append(location);

    if (gene.translationalException) {
      const flag = document.createElement('p');
      flag.className = 'gene-flag';
      const label = document.createElement('strong');
      label.textContent = `Translational exception: ${gene.translationalException.replace(/_/g, ' ')}. `;
      const text = document.createElement('span');
      text.textContent = 'This gene only translates correctly through a programmed event in the '
        + 'ribosome, so recoding it is high risk.';
      flag.append(label, text);
      header.append(flag);
    }
    if (Array.isArray(gene.cdsSegments) && gene.cdsSegments.length > 1) {
      const spliced = document.createElement('p');
      spliced.className = 'gene-flag';
      const label = document.createElement('strong');
      label.textContent = `Discontinuous coding sequence: ${gene.cdsSegments.length} segments. `;
      const text = document.createElement('span');
      text.textContent = 'The coding length is shorter than the span between its coordinates.';
      spliced.append(label, text);
      header.append(spliced);
    }

    const actions = document.createElement('div');
    actions.className = 'gene-actions';
    actions.append(shortlistButton);
    header.append(actions);
    this.host.append(header);
    if (focusedAction) {
      const replacement = this.host.querySelector(`[data-detail-action="${focusedAction}"]`);
      (replacement ?? this.host).focus({ preventScroll: true });
    }

    if (source === ALL_SOURCES || source === PCC_SOURCE) {
      // The GO IEA tier and discrepancy notes are shown only when every source is combined.
      const candidateEvidence = candidateEvidenceDisclosure(
        gene, dataset.candidateEvidence, source === ALL_SOURCES ? dataset.goIeaEssentiality : null,
      );
      if (candidateEvidence) this.host.append(candidateEvidence);
    }

    if (dataset.functionCategories && (source === ALL_SOURCES || source === UTEX_SOURCE)) {
      const assignment = dataset.functionCategories.assignmentsById.get(gene.id);
      const category = document.createElement('p');
      category.className = 'gene-flag';
      const heading = document.createElement('strong');
      heading.textContent = 'Reviewed function category: ';
      category.append(heading, assignment
        ? `${gene.reviewedFunctionLabels.join('; ')} (lab review, `
          + `${dataset.functionCategories.source.provenance.userReview.date}).`
        : 'No reviewed assignment; this gene remains unknown or unclassified. '
          + 'GO IEA suggestions do not assign a category colour.');
      this.host.append(category);
    }

    const annotation = annotationDisclosure(gene, dataset.meta, dataset.goTerms?.terms, source);
    if (annotation) this.host.append(annotation);

    const tssEvidence = tssEvidenceDisclosure(gene, dataset.meta);
    if (tssEvidence) this.host.append(tssEvidence);

    if (state.schemeActive) {
      const section = document.createElement('section');
      section.className = 'delta-section';
      const heading = document.createElement('h4');
      heading.textContent = 'Wild type against recoded';
      const table = document.createElement('table');
      table.className = 'delta-table';
      const head = document.createElement('thead');
      head.innerHTML = '<tr><th scope="col">Metric</th><th scope="col">Wild type</th>'
        + '<th scope="col">Recoded</th><th scope="col">Change</th></tr>';
      const body = document.createElement('tbody');
      for (const row of DELTA_ROWS) {
        const metric = { integer: false };
        const wild = dataset.baseline[row.wild][index];
        const recoded = state.live[row.recoded][index];
        const delta = state.live[row.delta][index];
        const tr = document.createElement('tr');
        const label = document.createElement('th');
        label.scope = 'row';
        label.textContent = row.label;
        const unit = document.createElement('span');
        unit.className = 'row-unit';
        unit.textContent = row.unit;
        label.append(' ', unit);
        tr.append(
          label,
          cell(formatValue(metric, wild), 'numeric'),
          cell(formatValue(metric, recoded), 'numeric'),
          cell(formatDelta(metric, delta), delta < 0 ? 'numeric down' : delta > 0 ? 'numeric up' : 'numeric'),
        );
        body.append(tr);
      }
      table.append(head, body);
      const note = document.createElement('p');
      note.className = 'panel-note';
      note.textContent = 'Both columns are recomputed in your browser from the same sequence, so '
        + 'the change is directly comparable.';
      section.append(heading, table, note);
      this.host.append(section);
    }

    for (const family of state.registry.families) {
      const metrics = orderMeasuredFirst(
        state.registry.metrics.filter((metric) => metric.family === family),
      );
      if (metrics.length === 0) continue;
      const details = document.createElement('details');
      details.className = 'metric-group';
      details.open = metricFamilyStartsOpen(family, state.schemeActive);
      const summary = document.createElement('summary');
      summary.textContent = `${family} (${metrics.length})`;
      const table = document.createElement('table');
      table.className = 'metric-table';
      const body = document.createElement('tbody');
      for (const metric of metrics) {
        const value = metric.read(index);
        const tr = document.createElement('tr');
        const label = document.createElement('th');
        label.scope = 'row';
        const labelText = document.createElement('span');
        labelText.className = 'metric-label';
        labelText.textContent = metric.label;
        const desc = document.createElement('span');
        desc.className = 'metric-desc';
        desc.textContent = metric.desc ?? '';
        label.append(labelText, desc);

        const valueCell = document.createElement('td');
        valueCell.className = 'numeric';
        valueCell.textContent = formatValue(metric, value);
        const unit = document.createElement('span');
        unit.className = 'row-unit';
        unit.textContent = metric.unit ?? '';
        valueCell.append(' ', unit);
        if (!Number.isFinite(value)) {
          valueCell.classList.add('missing');
          const hidden = document.createElement('span');
          hidden.className = 'visually-hidden';
          hidden.textContent = 'no value';
          valueCell.append(hidden);
        }
        // A measured expression value says per gene whether it is a measurement,
        // a proxy standing in, or nothing at all. The proxy metric is its own row.
        if (isExpressionMetric(metric) && !isExpressionProxyMetric(metric)) {
          const { basis, short, text } = expressionBasisOf(gene, metric, value);
          const tag = document.createElement('span');
          tag.className = `basis-tag basis-${basis}`;
          tag.textContent = short;
          tag.title = text;
          valueCell.append(document.createElement('br'), tag);
        }

        const percentile = state.percentileOf(metric.key, value);
        const rankCell = document.createElement('td');
        rankCell.className = 'rank-cell';
        const rankText = document.createElement('span');
        rankText.className = 'rank-text';
        rankText.textContent = formatPercentile(percentile);
        const track = document.createElement('span');
        track.className = 'rank-track';
        const fill = document.createElement('span');
        fill.className = 'rank-fill';
        fill.style.width = Number.isFinite(percentile) ? `${percentile * 100}%` : '0%';
        track.append(fill);
        rankCell.append(rankText, track);

        tr.append(label, valueCell, rankCell);
        body.append(tr);

        // A borrowed measurement says so beside the number, not in a tooltip.
        if (metric.provenance) {
          const noteRow = document.createElement('tr');
          const noteCell = document.createElement('td');
          noteCell.colSpan = 3;
          noteCell.className = metric.provenance.isTargetOrganism === false
            ? 'provenance-warning' : 'panel-note';
          noteCell.textContent = formatExpressionSource(metric.provenance);
          noteRow.append(noteCell);
          body.append(noteRow);
        }
      }
      table.append(body);
      details.append(summary, table);
      this.host.append(details);
    }
  }
}
