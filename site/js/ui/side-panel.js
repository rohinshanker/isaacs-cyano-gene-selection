/**
 * Gene detail panel.
 *
 * Hovering previews a gene, clicking pins it. Every metric is shown with its
 * unit, its one-line description from the dataset, and its percentile against
 * the genome, because a bare number does not tell a bench scientist whether the
 * value is unusual.
 */
import { firstUnsettled, pendingState } from '../core/data-files.js';
import { pendingNote } from './loading-note.js';
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
import { renderGeneViewer } from './gene-viewer.js';
import { tanDisclosure } from './disclosures.js';
import { essentialityEvidenceFor } from '../core/go-iea-essentiality.js';
import {
  categoryResolutionFor, conflictNote, sourceDisplayNames,
  THRESHOLDS as DERIVED_THRESHOLDS,
} from '../core/source-derived-categories.js';
import {
  fillTemplate, layerOf, organismOf, sourceIds, sourceLabels,
} from '../core/organisms.js';

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
 * The RefSeq annotation-method/inference/coordinate rows are the organism's own
 * release content; the GO relationships inside the same bundle are its GO
 * annotations. Nothing here comes from another strain.
 */
function annotationDisclosure(gene, meta, goTerms) {
  const model = annotationEvidenceModel(gene, meta, goTerms);
  if (!model) return null;
  const details = document.createElement('details');
  details.className = 'metric-group annotation-evidence';
  const summary = document.createElement('summary');
  summary.textContent = 'Annotation evidence and recoding context';
  const intro = document.createElement('p');
  intro.className = 'panel-note';
  intro.textContent = `Pinned RefSeq release ${model.releaseId}. Overlap and nearby-RNA rows are `
    + 'coordinate evidence, not proof of regulation. GO rows retain their evidence codes and are '
    + 'not collapsed into pathway or functional-category claims.';
  const list = document.createElement('dl');
  list.className = 'annotation-evidence-list';
  list.append(
    labelledList('Replicon', [model.replicon]),
    labelledList('Annotation method', model.methods),
    labelledList('Inference', model.inferences),
  );
  if (model.curatedFunction) {
    const curated = model.curatedFunction;
    list.append(
      labelledList('UniProtKB entry', [curated.heading, curated.proteinName].filter(Boolean)),
      labelledList('Curated function (UniProtKB)', curated.functions),
    );
  }
  list.append(
    labelledList('Overlapping CDS', model.overlaps.map((entry) => entry.text)),
    labelledList('Nearby non-coding RNA (≤250 nt)', model.nearby.map((entry) => entry.text)),
    labelledList('GO relationships', model.go.map((entry) => entry.text)),
  );
  details.append(summary, intro, list);
  if (model.attribution) {
    const attribution = document.createElement('p');
    attribution.className = 'panel-note';
    attribution.textContent = `GO: ${model.attribution.creator}; ${model.attribution.license}; `
      + `${model.attribution.source}`;
    details.append(attribution);
  }
  return details;
}

/** The GO IEA fallback wording, shown only where it can decide the tier. */
function goContextBlock(evidence, source, copy) {
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
    rank.textContent = copy.goTierRank;
    block.append(rank);
  }
  if (evidence.goContext) block.append(goAttribution(source));
  return tanDisclosure(block, 'Function category / information');
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

/** The suffix on a source line whose toggle is off: it is shown, not coloured by. */
/**
 * The stand-in for an evidence section whose file has not landed, or null when
 * every file it reads has settled and the section itself should be drawn.
 */
export function pendingSection(dataset, keys, title, what) {
  const waiting = firstUnsettled(dataset, keys);
  if (!waiting) return null;
  const block = document.createElement('div');
  block.className = 'metric-group evidence-pending-section';
  const heading = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = title;
  heading.append(strong);
  block.append(heading, pendingNote(waiting.state, what));
  return block;
}

function colouringSuffix(entry) {
  return entry.enabled ? '' : ' Not enabled for colouring.';
}

/** One source's own category line for the detail panel. */
function derivedSourceLine(sourceId, entry, derivedData, organism) {
  const fromProduct = sourceId === sourceIds(organism).product;
  const item = document.createElement('li');
  const label = document.createElement('strong');
  label.textContent = `${sourceDisplayNames(organism)[sourceId]}: `;
  item.append(label);
  if (!entry.judged) {
    item.append(`not judged (${entry.reason}).${colouringSuffix(entry)}`);
    return item;
  }
  const probability = entry.probability.toFixed(2);
  const provenance = fromProduct && entry.pccLocusTag
    ? fillTemplate(layerOf(organism, 'sourceDerivedCategories').productLocusProvenance,
      { locus: entry.pccLocusTag })
    : '';
  if (entry.categoryId) {
    item.append(`${entry.label} (TypeSafe Jev probability ${probability}${provenance}).`
      + colouringSuffix(entry));
  } else if (entry.mostLikely === 'unknown-or-unclassified') {
    item.append(`no category; the ${fromProduct ? 'product name states' : 'GO terms state'} `
      + `no specific function (probability ${probability}${provenance}).${colouringSuffix(entry)}`);
  } else {
    item.append(`no category; most likely ${entry.mostLikelyLabel} at ${probability}, below the `
      + `${DERIVED_THRESHOLDS.derivedProbabilityAtLeast.toFixed(2)} threshold${provenance}.`
      + colouringSuffix(entry));
  }
  if (derivedData?.judgment) item.dataset.model = derivedData.judgment.model;
  return item;
}

/**
 * The colour category under the sources enabled for colouring, the source and
 * evidence label behind it, every source's own judgment, and an explicit
 * conflict note, so a computational colour is never read as a reviewed one.
 *
 * Drawn only for an organism whose record declares the function-category
 * layer, in the names that record gives its sources.
 */
function functionCategoryBlock(gene, dataset, sources) {
  const organism = organismOf(dataset);
  if (!layerOf(organism, 'functionCategories')) return null;
  const ids = sourceIds(organism);
  const names = sourceLabels(organism);
  const resolution = categoryResolutionFor({
    reviewed: dataset.functionCategories, derived: dataset.sourceDerivedCategories,
    sources, locusId: gene.id, organism,
  });
  if (!resolution) return null;
  const block = document.createElement('div');
  block.className = 'gene-flag function-category-block';
  block.dataset.categoryEvidence = resolution.evidence ?? 'none';
  const headline = document.createElement('p');
  const heading = document.createElement('strong');
  heading.textContent = 'Function category (colour): ';
  const evidenceText = resolution.evidence === null
    ? (resolution.sources.length === 0
      ? 'no source is enabled for colouring'
      : 'no enabled source assigns one')
    : `evidence ${resolution.evidence}`;
  headline.append(heading, `${resolution.label} — ${evidenceText}.`);
  block.append(headline);
  const conflicts = conflictNote(resolution, organism);
  if (conflicts) {
    const note = document.createElement('p');
    note.className = 'panel-note function-category-conflict';
    note.setAttribute('role', 'note');
    note.textContent = `Conflict: ${conflicts}. The colour follows the highest-priority `
      + `enabled source (${names.precedence}); no source is preferred as truth.`;
    block.append(note);
  }
  const list = document.createElement('ul');
  list.className = 'function-category-sources';
  const reviewed = resolution.perSource[ids.reviewed];
  const reviewedItem = document.createElement('li');
  const reviewedLabel = document.createElement('strong');
  reviewedLabel.textContent = `${sourceDisplayNames(organism)[ids.reviewed]}: `;
  reviewedItem.append(reviewedLabel, (reviewed.reviewed
    ? `${reviewed.labels.join('; ')} (lab review, `
      + `${dataset.functionCategories.source.provenance.userReview.date}).`
    : 'no reviewed assignment.') + colouringSuffix(reviewed));
  list.append(reviewedItem);
  for (const sourceId of [ids.product, ids.go]) {
    list.append(derivedSourceLine(
      sourceId, resolution.perSource[sourceId], dataset.sourceDerivedCategories, organism,
    ));
  }
  block.append(list);
  const derivedData = dataset.sourceDerivedCategories;
  if (derivedData) {
    const note = document.createElement('p');
    note.className = 'panel-note';
    const goLicense = document.createElement('a');
    goLicense.href = derivedData.attribution.goIea.licenseUrl;
    goLicense.target = '_blank';
    goLicense.rel = 'noopener noreferrer';
    goLicense.textContent = derivedData.attribution.goIea.license;
    note.append('Derived categories are computational judgments by TypeSafe '
      + `${derivedData.judgment.model} (rubric ${derivedData.judgment.rubricVersion}) over `
      + 'automated annotations. They never change the reviewed table and are not lab review. '
      + `${names.go}: ${derivedData.attribution.goIea.creator}, `, goLicense,
      layerOf(organism, 'sourceDerivedCategories').attribution);
    block.append(note);
  }
  return block;
}

/**
 * Tested alleles and borrowed sister-strain calls for one gene.
 *
 * The evidence is one organism's own studies, so every name in it is read from
 * the `candidateEvidence` layer of that organism's record, and nothing is drawn
 * for an organism that declares no such layer.
 */
function candidateEvidenceDisclosure(gene, data, goData, organism) {
  const copy = layerOf(organism, 'candidateEvidence');
  if (!copy) return null;
  const model = candidateEvidenceFor(data, gene.id);
  if (!model) return null;
  const evidence = essentialityEvidenceFor(goData, gene.id, organism);
  const details = document.createElement('details');
  details.className = 'metric-group candidate-evidence';
  details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = evidence ? copy.tierSummaries[evidence.tier] : model.tested
    ? copy.testedSummary
    : ['unknown', 'missing', 'ambiguous', 'not_analyzed'].includes(model.pccCall?.status)
      ? copy.indeterminateSummary
      : copy.borrowedSummary;
  details.append(summary);
  if (evidence) {
    const tier = document.createElement('p');
    tier.className = 'candidate-tier';
    const label = document.createElement('strong');
    label.textContent = `Evidence tier ${evidence.tierRank} of 4: ${evidence.tierLabel}.`;
    tier.append(label, copy.tierPrecedence);
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
    citation.textContent = copy.testedStudyLink;
    details.append(claim, identity, condition, citation);
  }

  const borrowed = document.createElement('p');
  borrowed.className = 'candidate-borrowed-caution';
  const badge = document.createElement('strong');
  const call = model.pccCall;
  badge.textContent = call?.status === 'unknown'
    ? copy.callUnavailable
    : ['missing', 'ambiguous', 'not_analyzed'].includes(call?.status)
      ? copy.callIndeterminate
      : copy.callAssumed;
  const statusLabel = {
    essential: 'essential', beneficial: 'beneficial for growth',
    'non-essential': 'non-essential under the tested conditions',
    ambiguous: 'ambiguous', not_analyzed: 'not analysed', missing: 'missing in source',
    unknown: 'unknown',
  }[call?.status] ?? 'unknown';
  const callText = call?.pccLocusTag
    ? fillTemplate(copy.callAt, { locus: call.pccLocusTag, status: statusLabel })
    : fillTemplate(copy.noCall, { status: statusLabel });
  borrowed.append(badge, callText, copy.assumption);
  details.append(tanDisclosure(borrowed, 'Cross-organism evidence / information'));
  if (call?.status === 'unknown' && call.mappingReason) {
    const reason = document.createElement('p');
    reason.className = 'panel-note';
    reason.textContent = `Missing call: ${call.mappingReason}`;
    details.append(reason);
  }
  if (evidence && ['go-iea-context', 'unknown'].includes(evidence.tier)) {
    details.append(goContextBlock(evidence, goData, copy));
  }
  if (evidence?.discrepancies.length) details.append(discrepancyBlock(evidence, goData));
  const source = model.borrowedEssentiality.source;
  const condition = document.createElement('p');
  condition.className = 'panel-note';
  condition.textContent = `${copy.assayLabel}: ${source.rubinCondition}`;
  details.append(condition);
  const growth = document.createElement('p');
  growth.className = 'panel-note';
  growth.textContent = copy.growthContext;
  details.append(growth);
  const citation = document.createElement('p');
  citation.className = 'panel-note';
  for (const [label, field] of copy.citationLinks) {
    if (citation.childNodes.length) citation.append(' · ');
    const link = document.createElement('a');
    link.href = `https://doi.org/${source[field]}`;
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

function tssEvidenceDisclosure(gene, meta, organism) {
  const startSites = layerOf(organism, 'tssEvidence');
  if (!startSites || !meta?.tssEvidenceSource) return null;
  const model = tssEvidenceModel(gene);
  const details = document.createElement('details');
  details.className = 'metric-group tss-evidence';
  const summary = document.createElement('summary');
  summary.textContent = model.count === 0
    ? 'TSS initiation evidence — no mapped TSS evidence'
    : `TSS initiation evidence (${model.count} mapped `
      + `${model.count === 1 ? 'site' : 'sites'})`;
  // Evidence measured in this organism opens with the gene: its raw replicate counts
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
  source.append(`Source: ${startSites.citation}, `);
  const doi = document.createElement('a');
  doi.href = `https://doi.org/${startSites.doi}`;
  doi.textContent = `doi:${startSites.doi}`;
  doi.target = '_blank';
  doi.rel = 'noopener noreferrer';
  source.append(doi, '.');
  details.append(source);
  return details;
}

/** Build the rows for one metric family against the current gene and data. */
function metricFamilyTable(metrics, index, gene, state) {
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
      const note = document.createElement('p');
      note.className = metric.provenance.isTargetOrganism === false
        ? 'provenance-warning' : 'panel-note';
      note.textContent = formatExpressionSource(metric.provenance);
      noteCell.append(metric.provenance.isTargetOrganism === false
        ? tanDisclosure(note, 'Source / information') : note);
      noteRow.append(noteCell);
      body.append(noteRow);
    }
  }
  table.append(body);
  return table;
}

export class SidePanel {
  /**
   * @param {HTMLElement} host
   * @param {{onShortlistToggle: (index: number) => void, onUnpin: () => void}} handlers
   */
  constructor(host, handlers) {
    this.host = host;
    this.handlers = handlers;
    // Which disclosures the reader has opened or closed, by stable key.
    //
    // This panel is rebuilt from scratch for every gene, so without a memory
    // each section snapped back to its default the moment the pin moved. A
    // reader comparing the same section across several genes had to reopen it
    // every time. Only sections the reader actually toggled are recorded; the
    // rest keep following their own defaults, which depend on whether a
    // recoding scheme is active.
    //
    // Deliberately in memory and not in the link: it is how one person is
    // reading right now, not part of the view a link reproduces.
    this.disclosureState = new Map();
    // Whether this column's gene visualizer draws its start-site marks. The
    // panel is rebuilt for every hover, so the view cannot hold it; unlike the
    // disclosures above, it is a reader's choice about what the picture
    // contains, so the caller owns it, a link carries it, and `update` adopts
    // whatever the caller last recorded. Visible until then. It is this
    // column's own: the controls column's copy, the chromosome view's layer
    // control and the sequence close-up's are three separate choices.
    this.startSitesVisible = true;
  }

  /**
   * Give one disclosure a stable identity and restore what the reader chose.
   * Returns the element, so it can wrap a builder's result inline.
   */
  rememberDisclosure(details, key) {
    if (!details) return details;
    details.dataset.disclosure = key;
    const remembered = this.disclosureState.get(key);
    if (remembered !== undefined) details.open = remembered;
    details.dataset.disclosureOpen = String(details.open);
    details.addEventListener('toggle', () => {
      // Native toggle events can be delivered after a hover rebuild has
      // detached this disclosure. An obsolete element must not overwrite the
      // state chosen in the current panel.
      if (!details.isConnected || !this.host.contains(details)) return;
      // Setting `open` while constructing or restoring a disclosure queues the
      // same native event as a user gesture. The recorded starting value lets
      // that no-change event pass without turning a scheme-dependent default
      // into a remembered reader choice.
      if (details.dataset.disclosureOpen === String(details.open)) return;
      this.disclosureState.set(key, details.open);
      details.dataset.disclosureOpen = String(details.open);
    });
    return details;
  }

  /**
   * Capture a user toggle whose native event has not been delivered yet.
   *
   * Untouched disclosures are deliberately skipped, so their next rebuild can
   * still follow scheme-dependent defaults. `rememberDisclosure` records the
   * state each attached element started with; a difference is a real change
   * that must survive replacing the panel for another gene or source.
   */
  capturePendingDisclosureState() {
    for (const details of this.host.querySelectorAll('details')) {
      const key = details.dataset.disclosure;
      if (!key || details.dataset.disclosureOpen === String(details.open)) continue;
      this.disclosureState.set(key, details.open);
    }
  }

  /**
   * @param {{index: number, isPinned: boolean, dataset: object, registry: object,
   *   percentileOf: (key: string, value: number) => number, schemeActive: boolean,
   *   live: object, inShortlist: boolean}} state
   */
  update(state) {
    const { index, dataset } = state;
    const organism = organismOf(dataset);
    // The caller's record of this column's choice, so a shared link, a reload
    // and a live hash all reach the picture. Omitted leaves the last value.
    if (typeof state.startSitesVisible === 'boolean') {
      this.startSitesVisible = state.startSitesVisible;
    }
    this.capturePendingDisclosureState();
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
    const view = gene;
    const identity = geneIdentity(view);
    const header = document.createElement('div');
    header.className = 'gene-header';

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
      header.append(tanDisclosure(flag, 'Translational exception / information'));
    }
    if (Array.isArray(gene.cdsSegments) && gene.cdsSegments.length > 1) {
      const spliced = document.createElement('p');
      spliced.className = 'gene-flag';
      const label = document.createElement('strong');
      label.textContent = `Discontinuous coding sequence: ${gene.cdsSegments.length} segments. `;
      const text = document.createElement('span');
      text.textContent = 'The coding length is shorter than the span between its coordinates.';
      spliced.append(label, text);
      header.append(tanDisclosure(spliced, 'Sequence structure / information'));
    }

    const actions = document.createElement('div');
    actions.className = 'gene-actions';
    actions.append(shortlistButton);
    header.append(actions);
    this.host.append(header);

    // The picture of the gene leads the detail column. It answers "what am I
    // looking at" from coordinates and the release's own measurements, before
    // any section that interprets the gene. Open by default here, unlike the
    // controls column, because this column exists to describe one gene.
    const viewer = document.createElement('details');
    viewer.className = 'metric-group gene-view-group';
    viewer.open = true;
    this.rememberDisclosure(viewer, 'gene-viewer');
    const viewerSummary = document.createElement('summary');
    viewerSummary.textContent = 'Gene visualizer';
    const viewerBody = document.createElement('div');
    renderGeneViewer(viewerBody, gene, {
      tssPending: pendingState(dataset, 'tssEvidence'),
      organism,
      startSitesVisible: this.startSitesVisible,
      onStartSitesVisibleChange: (visible) => {
        this.startSitesVisible = visible;
        this.handlers.onStartSitesVisibleChange?.(visible);
      },
    });
    viewer.append(viewerSummary, viewerBody);
    this.host.append(viewer);

    // Focus is restored here rather than with the header, because the gene
    // visualizer carries a control too: this is the first point at which every
    // control a reader could have been holding is back in the tree.
    if (focusedAction) {
      const replacement = this.host.querySelector(`[data-detail-action="${focusedAction}"]`);
      (replacement ?? this.host).focus({ preventScroll: true });
    }

    // Each evidence section below reads a file that may not have landed. Until
    // it has, the section's place is taken by a note that says so: an absent
    // section would read as a gene with no such evidence.
    const candidateEvidence = pendingSection(dataset, ['candidateEvidence', 'goIeaEssentiality'],
      'Candidate evidence', 'candidate evidence')
      ?? this.rememberDisclosure(candidateEvidenceDisclosure(
        gene, dataset.candidateEvidence, dataset.goIeaEssentiality, organism,
      ), 'candidate-evidence');
    if (candidateEvidence) this.host.append(candidateEvidence);

    const category = (dataset.functionCategories
      ? pendingSection(dataset, ['sourceDerivedCategories'], 'Function category (colour)',
        'function categories')
      : null)
      ?? this.rememberDisclosure(
        functionCategoryBlock(gene, dataset, state.colorSources), 'function-category',
      );
    if (category) this.host.append(category);

    const annotation = pendingSection(dataset, ['annotations', 'goTerms'],
      'Annotation evidence and recoding context', 'annotation evidence')
      ?? this.rememberDisclosure(
        annotationDisclosure(gene, dataset.meta, dataset.goTerms?.terms), 'annotation',
      );
    if (annotation) this.host.append(annotation);

    const startSites = layerOf(organism, 'tssEvidence');
    const tssEvidence = (startSites && dataset.meta?.tssEvidenceSource
      ? pendingSection(dataset, ['tssEvidence'], 'TSS initiation evidence', startSites.fileLabel)
      : null)
      ?? this.rememberDisclosure(
        tssEvidenceDisclosure(gene, dataset.meta, organism), 'tss-evidence',
      );
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
      this.rememberDisclosure(details, `metric:${family}`);
      const summary = document.createElement('summary');
      summary.textContent = `${family} (${metrics.length})`;
      details.append(summary);
      this.host.append(details);
      if (details.open) {
        details.append(metricFamilyTable(metrics, index, gene, state));
        continue;
      }
      // Closed native disclosures hide their descendants from readers, so do
      // not build those rows or prepare their whole-genome percentile cohorts
      // until the reader asks for them. A toggle event can be queued while a
      // hover, source change or late file landing replaces the panel; detached
      // disclosures must never append rows computed from that obsolete state.
      details.addEventListener('toggle', () => {
        if (!details.open || !details.isConnected || !this.host.contains(details)
          || details.querySelector('table.metric-table')) return;
        details.append(metricFamilyTable(metrics, index, gene, state));
      });
    }
  }
}
