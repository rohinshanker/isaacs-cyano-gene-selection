/**
 * The Design a panel workflow.
 *
 * The rest of this page answers "what is this gene like". This card answers a
 * different question: which six to ten genes, taken together, would make an
 * experiment worth running. It is deterministic filtering and optimization, not
 * a judgement and not a prediction, and every part of the interface says so.
 *
 * The card is built once and updated in place. Designing is deliberately a
 * button rather than something that happens as you type: it scans the genome
 * once per selected scheme, and a panel that changed under the reader's hands
 * would be impossible to reason about.
 */
import { compileScheme } from '../core/scheme.js';
import { computeLiveMetrics } from '../core/live-metrics.js';
import { buildPanelSpace } from '../core/panel-features.js';
import {
  designPanel, normaliseConfig, FLAG_CONSTRAINTS, MIN_PANEL_SIZE, MAX_PANEL_SIZE,
  DEFAULT_PANEL_SIZE, SELECTION_ORDER,
} from '../core/panel-design.js';
import {
  buildPanelExport, buildSchemeMatrix, describeSchemes,
} from '../core/panel-export.js';
import { canonicalJson, schemeIdOf } from '../core/export-manifest.js';
import { isBorrowedMetric } from '../core/panel-features.js';
import { formatValue, formatCount, formatPercentile } from './format.js';

/**
 * The metrics a bench scientist reaches for first. Everything else the dataset
 * publishes follows them, so a pipeline that adds a metric offers it here with
 * no change to this file.
 */
const PREFERRED_CONSTRAINT_KEYS = [
  'cai', 'tai', 'lengthCodons', 'gc3', 'rareFraction', 'mfeStart', 'enc',
];

/**
 * Every metric that can be a hard constraint, preferred ones first.
 *
 * Only published metrics qualify. A live metric is whatever the active scheme
 * makes it, so constraining on one would mean something different as soon as the
 * scheme changed.
 */
function constrainableMetrics(registry) {
  const published = registry.metrics.filter((metric) => metric.source === 'pipeline');
  const preferred = PREFERRED_CONSTRAINT_KEYS
    .map((key) => published.find((metric) => metric.key === key))
    .filter(Boolean);
  const rest = published
    .filter((metric) => !preferred.includes(metric))
    .sort((a, b) => (a.family === b.family
      ? a.label.localeCompare(b.label)
      : a.family.localeCompare(b.family)));
  return [...preferred, ...rest];
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function labelled(id, text, control) {
  const row = element('span', 'field-row');
  const label = element('label', null, text);
  label.htmlFor = id;
  control.id = id;
  row.append(label, control);
  return row;
}

function checkbox(id, labelText, checked, onChange) {
  const row = element('span', 'checkbox-row');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const label = element('label', null, labelText);
  label.htmlFor = id;
  row.append(input, label);
  return { row, input, label };
}

/** A saved scheme's selection follows its name and map, not its sorted-list position. */
export function savedSchemeKey(scheme) {
  return `saved:${encodeURIComponent(String(scheme.name))}:${schemeIdOf(scheme.map)}`;
}

/** Drop selections whose saved scheme was deleted, without transferring them to another row. */
export function reconcileSchemeSelection(selectedKeys, schemes) {
  const available = new Set(['active', ...schemes.saved.map(savedSchemeKey)]);
  return new Set([...selectedKeys].filter((key) => available.has(key)));
}

/** Resolve checkbox state to the maps used by panel computation and export. */
export function selectedSchemes(schemes, selectedKeys) {
  const chosen = [];
  if (selectedKeys.has('active')) {
    chosen.push({ name: schemes.active.name || 'Current scheme', map: schemes.active.map });
  }
  for (const scheme of schemes.saved) {
    if (selectedKeys.has(savedSchemeKey(scheme))) chosen.push(scheme);
  }
  return chosen.length > 0 ? chosen : [{ name: 'Wild type', map: {} }];
}

/** Canonical identity for every setting that determines a generated panel and its export. */
export function panelInputKey(config, schemes) {
  return canonicalJson({
    config: normaliseConfig(config),
    schemes: schemes.map((scheme) => ({
      name: scheme.name ?? '',
      schemeId: schemeIdOf(scheme.map),
    })),
  });
}

/** Whether the controls no longer describe the panel result on screen. */
export function panelResultIsStale(resultKey, config, schemes) {
  return Boolean(resultKey) && resultKey !== panelInputKey(config, schemes);
}

export class PanelDesigner {
  /**
   * @param {HTMLElement} host
   * @param {{onSelect: (id: string) => void, onAnnounce: (message: string) => void,
   *   onShortlist: (ids: string[]) => void}} handlers
   */
  constructor(host, handlers) {
    this.host = host;
    this.handlers = handlers;
    this.config = normaliseConfig({ size: DEFAULT_PANEL_SIZE });
    this.selectedSchemeKeys = new Set(['active']);
    this.design = null;
    this.space = null;
    this.spaceKey = '';
    this.designInputKey = '';
    this.build();
  }

  build() {
    this.host.replaceChildren();
    this.host.append(this.buildIntro(), this.buildHelp());

    this.form = element('div', 'panel-config');
    const refreshResultStatus = () => queueMicrotask(() => this.renderResult());
    this.form.addEventListener('change', refreshResultStatus);
    this.form.addEventListener('click', refreshResultStatus);
    this.host.append(this.form);

    this.resultHost = element('div', 'panel-result');
    // The concise result is announced through the page announcer. Keeping the
    // entire (potentially very long) result in a live region would make screen
    // readers repeat every table and explanation after each design. Important
    // changes inside the result retain their own status or alert role.
    this.host.append(this.resultHost);
  }

  buildIntro() {
    const intro = element('p', 'panel-note');
    intro.textContent = 'Pick a size and the constraints your bench actually imposes, and this '
      + 'chooses a spread of genes that no single measurement would have picked. It is a coverage '
      + 'design, not a prediction of how a recoded strain will behave.';
    return intro;
  }

  /** Four short sections, closed by default, so the card stays short until asked. */
  buildHelp() {
    const details = element('details', 'panel-help');
    details.append(element('summary', null, 'How a panel is chosen'));
    const grid = element('div', 'panel-help-grid');
    const section = (heading, body) => {
      const wrap = element('div');
      wrap.append(element('h3', null, heading), element('p', null, body));
      return wrap;
    };
    grid.append(
      section('What you configure',
        'A size between six and ten, the recoding schemes the panel should span, and any genes you '
        + 'already know are in or out. A seeded gene always stays; an excluded gene never appears. '
        + 'Locking a gene from a result turns it into a seed for the next run.'),
      section('What a constraint does',
        'A hard constraint removes genes before anything is chosen, so it never trades off against '
        + 'spread. A gene with no value for a constrained metric is kept by default, because '
        + 'unknown is not out of range; you can require a value instead, and the export records '
        + 'which you chose.'),
      section('How the spread is measured',
        'Every feature is replaced by its percentile across the whole genome, so a length in '
        + 'nucleotides cannot outweigh a fraction, and changing the units cannot change the panel. '
        + 'A gene with no value for a feature is compared on the features it has and is never '
        + 'given a stand-in number.'),
      section('What the result is not',
        'It is not a ranking of genes and not a fitness prediction. It is the set that covers the '
        + 'most of the measured space while staying inside your constraints. Expression measured '
        + 'in another strain is left out entirely unless you switch it on, and is labelled '
        + 'wherever it appears.'),
    );
    const order = element('p', 'panel-note');
    order.textContent = `Genes are added one at a time, each time taking the gene that ${SELECTION_ORDER[0]}, `
      + `then the one that is ${SELECTION_ORDER[1]}. Remaining ties fall to the ${SELECTION_ORDER
        .slice(2).join(', then the ')}, so the same settings always give the same panel.`;
    details.append(grid, order);
    return details;
  }

  /**
   * @param {{dataset: object, registry: object,
   *   schemes: {active: {name: string, map: object}, saved: Array<{name: string, map: object}>},
   *   shortlist: string[], pinnedId: string|null}} state
   */
  update(state) {
    this.state = state;
    this.selectedSchemeKeys = reconcileSchemeSelection(this.selectedSchemeKeys, state.schemes);
    this.renderForm();
    this.renderResult();
  }

  /** The schemes the reader ticked, as `{name, map}` in a stable order. */
  chosenSchemes() {
    return selectedSchemes(this.state.schemes, this.selectedSchemeKeys);
  }

  renderForm() {
    const { dataset, registry, schemes } = this.state;
    this.form.replaceChildren();

    this.form.append(element('h3', 'panel-settings-heading', 'Settings'));

    const size = document.createElement('input');
    size.type = 'number';
    size.min = String(MIN_PANEL_SIZE);
    size.max = String(MAX_PANEL_SIZE);
    size.step = '1';
    size.value = String(this.config.size);
    size.addEventListener('change', () => {
      this.config = normaliseConfig({ ...this.config, size: Number(size.value) });
      size.value = String(this.config.size);
    });
    const sizeSet = element('fieldset', 'flag-filter');
    sizeSet.append(element('legend', null, 'How many genes'));
    sizeSet.append(labelled('panel-size', 'Genes in the panel', size));
    sizeSet.append(element('p', 'panel-note',
      `Between ${MIN_PANEL_SIZE} and ${MAX_PANEL_SIZE}, the range the lab builds and assays in one `
      + 'run. A larger panel covers more of the space; a smaller one leaves more replicates per '
      + 'construct.'));
    this.form.append(sizeSet);

    // Schemes ------------------------------------------------------------
    const schemeSet = element('fieldset', 'flag-filter');
    schemeSet.append(element('legend', null, 'Recoding schemes the panel should span'));
    const options = [
      { key: 'active', label: schemes.active.name
        ? `Current scheme: ${schemes.active.name}`
        : (Object.keys(schemes.active.map).length > 0 ? 'Current scheme' : 'Wild type (no scheme set)') },
      ...schemes.saved.map((scheme, i) => ({
        key: savedSchemeKey(scheme),
        id: `panel-scheme-saved-${i}`,
        label: `Saved: ${scheme.name}`,
      })),
    ];
    for (const option of options) {
      const { row } = checkbox(
        option.id ?? `panel-scheme-${option.key}`,
        option.label,
        this.selectedSchemeKeys.has(option.key),
        (checked) => {
          if (checked) this.selectedSchemeKeys.add(option.key);
          else this.selectedSchemeKeys.delete(option.key);
        },
      );
      schemeSet.append(row);
    }
    const schemeNote = element('p', 'panel-note');
    schemeNote.textContent = 'Each scheme adds its own edit burden and adaptation change to the '
      + 'spread, so a panel across two schemes covers how differently they would disturb a gene.';
    schemeSet.append(schemeNote);
    this.form.append(schemeSet);

    // Seeds and exclusions ------------------------------------------------
    this.form.append(this.renderGeneLists());

    // Constraints ---------------------------------------------------------
    this.form.append(this.renderConstraints(registry, dataset));

    // Actions -------------------------------------------------------------
    const actions = element('div', 'button-row');
    const design = element('button', 'chip-button active', this.design ? 'Regenerate panel' : 'Design panel');
    design.type = 'button';
    design.addEventListener('click', () => this.run());
    const reset = element('button', 'chip-button', 'Reset settings');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      this.config = normaliseConfig({ size: DEFAULT_PANEL_SIZE });
      this.selectedSchemeKeys = new Set(['active']);
      this.design = null;
      this.designInputKey = '';
      this.renderForm();
      this.renderResult();
      this.handlers.onAnnounce('Panel settings reset.');
    });
    actions.append(design, reset);
    this.form.append(actions);
  }

  renderGeneLists() {
    const wrap = element('fieldset', 'flag-filter');
    wrap.append(element('legend', null, 'Genes you have already decided about'));

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Locus tag, such as M744_RS00005';
    input.autocomplete = 'off';
    const row = labelled('panel-gene-input', 'Locus tag', input);

    const status = element('p', 'panel-note');
    status.setAttribute('role', 'status');

    const add = (list, name) => {
      const id = input.value.trim().toUpperCase();
      if (!id) return;
      if (!this.state.dataset.indexById.has(id)) {
        status.textContent = `${id} is not in this dataset.`;
        return;
      }
      if (!this.config[list].includes(id)) this.config[list] = [...this.config[list], id];
      if (list === 'seeds') this.config.exclude = this.config.exclude.filter((entry) => entry !== id);
      else this.config.seeds = this.config.seeds.filter((entry) => entry !== id);
      input.value = '';
      status.textContent = `${id} added to ${name}.`;
      this.renderForm();
      this.handlers.onAnnounce(`${id} added to ${name}.`);
    };

    const buttons = element('span', 'search-result-actions');
    const seedButton = element('button', 'chip-button', 'Keep in panel');
    seedButton.type = 'button';
    seedButton.addEventListener('click', () => add('seeds', 'the genes kept in the panel'));
    const excludeButton = element('button', 'chip-button danger', 'Never use');
    excludeButton.type = 'button';
    excludeButton.addEventListener('click', () => add('exclude', 'the excluded genes'));
    buttons.append(seedButton, excludeButton);
    row.append(buttons);
    wrap.append(row, status);

    const shortlist = this.state.shortlist ?? [];
    if (shortlist.length > 0) {
      const useShortlist = element('button', 'chip-button',
        `Keep the ${formatCount(shortlist.length)} shortlisted gene${shortlist.length === 1 ? '' : 's'}`);
      useShortlist.type = 'button';
      useShortlist.addEventListener('click', () => {
        this.config.seeds = [...new Set([...this.config.seeds, ...shortlist])];
        this.config.exclude = this.config.exclude.filter((id) => !shortlist.includes(id));
        this.renderForm();
        this.handlers.onAnnounce(`${formatCount(shortlist.length)} shortlisted genes kept in the panel.`);
      });
      const actionRow = element('div', 'button-row');
      actionRow.append(useShortlist);
      wrap.append(actionRow);
    }

    wrap.append(
      this.renderChips('seeds', 'Kept in the panel', 'Nothing is pinned into the panel yet.'),
      this.renderChips('exclude', 'Never used', 'No gene is excluded.'),
    );
    return wrap;
  }

  renderChips(list, heading, empty) {
    const wrap = element('div', 'panel-chips');
    wrap.append(element('h4', null, heading));
    const ids = this.config[list];
    if (ids.length === 0) {
      wrap.append(element('p', 'panel-note', empty));
      return wrap;
    }
    const items = element('ul', 'panel-chip-list');
    for (const id of ids) {
      const item = element('li', 'panel-chip');
      const tag = element('span', 'locus-tag', id);
      const remove = element('button', 'icon-button', 'Remove');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${id} from ${heading.toLowerCase()}`);
      remove.addEventListener('click', () => {
        this.config[list] = this.config[list].filter((entry) => entry !== id);
        this.renderForm();
        this.handlers.onAnnounce(`${id} removed from ${heading.toLowerCase()}.`);
      });
      item.append(tag, remove);
      items.append(item);
    }
    wrap.append(items);
    return wrap;
  }

  renderConstraints(registry, dataset) {
    const wrap = element('fieldset', 'flag-filter');
    wrap.append(element('legend', null, 'Hard constraints'));

    const borrowed = registry.metrics.filter((metric) => isBorrowedMetric(metric));
    for (const flag of FLAG_CONSTRAINTS) {
      const disabled = flag.needsBorrowed && !this.config.allowBorrowedExpression;
      const { row, input, label } = checkbox(
        `panel-flag-${flag.id}`,
        flag.label,
        Boolean(this.config[flag.id]),
        (checked) => {
          this.config[flag.id] = checked;
          this.renderForm();
        },
      );
      input.disabled = disabled;
      if (disabled) label.classList.add('panel-disabled-label');
      const detail = element('p', 'panel-note', flag.detail);
      wrap.append(row, detail);
    }

    if (borrowed.length > 0) {
      const { row, input } = checkbox(
        'panel-allow-borrowed',
        'Use expression measured in another organism',
        this.config.allowBorrowedExpression,
        (checked) => {
          this.config.allowBorrowedExpression = checked;
          if (!checked) {
            this.config.requireMeasuredExpression = false;
            for (const metric of borrowed) delete this.config.ranges[metric.key];
          }
          this.renderForm();
        },
      );
      input.setAttribute('aria-describedby', 'panel-borrowed-note');
      const note = element('p', 'provenance-warning');
      note.id = 'panel-borrowed-note';
      note.textContent = `${borrowed.map((metric) => metric.label).join(', ')} come from a different `
        + 'organism and condition. Off by default: a panel spread on a borrowed measurement is '
        + 'spread on something this genome was never measured for.';
      wrap.append(row, note);
    }

    wrap.append(this.renderRanges(registry, dataset));
    return wrap;
  }

  renderRanges(registry, dataset) {
    const wrap = element('div', 'panel-ranges');
    wrap.append(element('h4', null, 'Value ranges'));

    const available = constrainableMetrics(registry)
      .filter((metric) => this.config.allowBorrowedExpression || !isBorrowedMetric(metric))
      .filter((metric) => !Object.hasOwn(this.config.ranges, metric.key));

    for (const [key, range] of Object.entries(this.config.ranges)) {
      const metric = registry.byKey.get(key);
      if (!metric) continue;
      wrap.append(this.renderRangeRow(metric, range, dataset));
    }

    if (available.length > 0) {
      const select = document.createElement('select');
      for (const metric of available) {
        const option = document.createElement('option');
        option.value = metric.key;
        option.textContent = metric.unit ? `${metric.label} (${metric.unit})` : metric.label;
        select.append(option);
      }
      const row = labelled('panel-range-add', 'Constrain a metric', select);
      select.setAttribute('aria-describedby', 'panel-range-note');
      const add = element('button', 'chip-button', 'Add');
      add.type = 'button';
      add.addEventListener('click', () => {
        this.config.ranges = {
          ...this.config.ranges,
          [select.value]: { min: null, max: null, includeMissing: true },
        };
        this.renderForm();
      });
      row.append(add);
      wrap.append(row);
    }
    const note = element('p', 'panel-note');
    note.id = 'panel-range-note';
    note.textContent = Object.keys(this.config.ranges).length === 0
      ? 'No value range is set, so only the flags above narrow the pool. Only published metrics '
        + 'can be constrained: anything that changes with the recoding scheme would mean a '
        + 'different thing under a different scheme.'
      : 'Only published metrics can be constrained, because a value that changes with the '
        + 'recoding scheme would mean a different thing under a different scheme.';
    wrap.append(note);
    return wrap;
  }

  renderRangeRow(metric, range, dataset) {
    const row = element('div', 'filter-row');
    const heading = element('div', 'filter-heading');
    heading.append(
      element('span', 'filter-title', metric.label),
      element('span', 'filter-unit', metric.unit ?? ''),
    );
    const remove = element('button', 'icon-button', 'Remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove the ${metric.label} constraint`);
    remove.addEventListener('click', () => {
      const { [metric.key]: _dropped, ...rest } = this.config.ranges;
      this.config.ranges = rest;
      this.renderForm();
    });
    heading.append(remove);
    row.append(heading);

    const inputs = element('div', 'filter-inputs');
    for (const bound of ['min', 'max']) {
      const field = element('div', 'filter-input');
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.value = Number.isFinite(range[bound]) ? String(range[bound]) : '';
      input.id = `panel-range-${metric.key}-${bound}`;
      input.addEventListener('change', () => {
        const value = input.value === '' ? null : Number(input.value);
        this.config.ranges = {
          ...this.config.ranges,
          [metric.key]: { ...this.config.ranges[metric.key], [bound]: Number.isFinite(value) ? value : null },
        };
      });
      const label = element('label', null, bound === 'min' ? 'At least' : 'At most');
      label.htmlFor = input.id;
      field.append(label, input);
      inputs.append(field);
    }
    row.append(inputs);

    const missing = dataset.genes.reduce(
      (count, _gene, index) => count + (Number.isFinite(metric.read(index)) ? 0 : 1), 0,
    );
    const { row: missingRow } = checkbox(
      `panel-range-${metric.key}-missing`,
      `Require a value (${formatCount(missing)} gene${missing === 1 ? ' has' : 's have'} none)`,
      range.includeMissing === false,
      (checked) => {
        this.config.ranges = {
          ...this.config.ranges,
          [metric.key]: { ...this.config.ranges[metric.key], includeMissing: !checked },
        };
      },
    );
    missingRow.classList.add('missing-control');
    row.append(missingRow);
    if (isBorrowedMetric(metric)) {
      row.append(element('p', 'provenance-warning',
        'This is a borrowed measurement, so this constraint filters on another organism.'));
    }
    return row;
  }

  /** Build the feature space for the chosen schemes, reusing it when nothing changed. */
  ensureSpace(schemes) {
    const key = `${schemes.map((scheme) => scheme.schemeId).join('|')}::${this.config.allowBorrowedExpression}`;
    if (this.space && this.spaceKey === key) return this.space;
    const { dataset, registry } = this.state;
    const schemeFields = new Map(schemes.map((scheme) => [
      scheme.schemeId,
      computeLiveMetrics(
        dataset, compileScheme(scheme.map, dataset.table), { baseline: dataset.baseline },
      ).fields,
    ]));
    this.schemeFields = schemeFields;
    this.space = buildPanelSpace({
      dataset, registry, schemes, schemeFields, allowBorrowed: this.config.allowBorrowedExpression,
    });
    this.spaceKey = key;
    return this.space;
  }

  run() {
    const { dataset, registry } = this.state;
    const schemes = describeSchemes(this.chosenSchemes());
    const space = this.ensureSpace(schemes);
    this.schemes = schemes;
    this.design = designPanel({ dataset, registry, space, config: this.config });
    this.designInputKey = panelInputKey(this.config, this.chosenSchemes());
    this.renderForm();
    this.renderResult();
    this.handlers.onAnnounce(this.design.feasible
      ? `Panel of ${formatCount(this.design.selected.length)} genes designed. `
        + `${this.design.selected.join(', ')}.`
      : `No panel could be designed. ${this.design.problems[0] ?? ''}`);
    this.resultHost.scrollIntoView({ block: 'nearest' });
  }

  renderResult() {
    this.resultHost.replaceChildren();
    if (!this.design) {
      this.resultHost.append(element('p', 'empty-state',
        'No panel yet. Choose a size and any constraints, then select Design panel.'));
      return;
    }
    const { design } = this;

    if (panelResultIsStale(this.designInputKey, this.config, this.chosenSchemes())) {
      const stale = element('div', 'gene-flag');
      stale.setAttribute('role', 'status');
      stale.append(
        element('strong', null, 'Settings changed. '),
        'These results and exports still use the settings from the last design. '
          + 'Select Regenerate panel to update them.',
      );
      this.resultHost.append(stale);
    }

    if (design.problems.length > 0) {
      const alert = element('div', design.feasible ? 'gene-flag' : 'metric-alert');
      alert.setAttribute('role', design.feasible ? 'status' : 'alert');
      alert.append(element('strong', null, design.feasible
        ? 'The panel was built, with something worth knowing.'
        : 'No panel satisfies these settings.'));
      const list = element('ul');
      for (const problem of design.problems) list.append(element('li', null, problem));
      alert.append(list);
      if (!design.feasible) {
        alert.append(element('p', null, `${formatCount(design.pool.length)} of `
          + `${formatCount(this.state.dataset.genes.length)} genes clear every constraint. `
          + 'Relax a range, allow a flagged gene, or lower the size. What each constraint '
          + 'removes, counting a gene once per constraint it fails:'));
        alert.append(this.renderRejectionSummary());
      }
      this.resultHost.append(alert);
    }

    if (design.selected.length === 0) return;

    const summary = element('p', 'panel-summary');
    summary.append(element('strong', null,
      `${formatCount(design.selected.length)} genes: `), document.createTextNode(design.selected.join(', ')));
    this.resultHost.append(summary);

    const dropped = this.space?.dropped ?? [];
    if (dropped.length > 0) {
      const details = element('details', 'panel-gene-details');
      details.append(element('summary', null,
        `${formatCount(dropped.length)} feature${dropped.length === 1 ? ' was' : 's were'} left `
        + 'out of the spread'));
      const list = element('ul', 'panel-reason-list');
      for (const entry of dropped) list.append(element('li', null, entry.reason));
      details.append(list);
      this.resultHost.append(details);
    }

    this.resultHost.append(this.renderCoverage());
    this.resultHost.append(this.renderGenes());
    this.resultHost.append(this.renderMatrix());
    this.resultHost.append(this.renderExport());
  }

  renderRejectionSummary() {
    const { counts } = this.design.eligibility;
    const list = element('ul');
    const named = new Map([
      ...FLAG_CONSTRAINTS.map((flag) => [flag.id, flag.label]),
      ['excluded', 'Excluded by hand'],
      ['replicons', 'Not on the selected sequences'],
    ]);
    for (const constraint of this.design.constraints.active) {
      const count = counts.get(constraint.id) ?? 0;
      if (count === 0) continue;
      list.append(element('li', null,
        `${named.get(constraint.id) ?? constraint.label}: ${formatCount(count)} `
        + `gene${count === 1 ? '' : 's'}`));
    }
    const excluded = counts.get('excluded') ?? 0;
    if (excluded > 0) {
      list.append(element('li', null, `Excluded by hand: ${formatCount(excluded)} `
        + `gene${excluded === 1 ? '' : 's'}`));
    }
    return list;
  }

  renderCoverage() {
    const section = element('section', 'panel-coverage');
    section.append(element('h3', null, 'Coverage before and after'));
    const { coverageBefore: before, coverageAfter: after } = this.design;

    const note = element('p', 'panel-note');
    note.textContent = before.members === 0
      ? 'Nothing was pinned into the panel, so "before" is empty and every part of the space the '
        + 'panel reaches was reached by the design.'
      : `Before: the ${formatCount(before.members)} gene${before.members === 1 ? '' : 's'} you kept. `
        + `After: all ${formatCount(after.members)}.`;
    section.append(note);

    const scroll = element('div', 'table-scroll');
    const table = element('table', 'data-table');
    const caption = element('caption', null,
      'Each feature is split into five equal-sized slices of the genome. A panel covers a feature '
      + 'when it puts a gene in every slice. Distances are in percentile units.');
    const head = element('thead');
    const headRow = document.createElement('tr');
    for (const title of ['Feature', 'Slices before', 'Slices after', 'Range covered']) {
      // The two counts are right-aligned, so their headings are too; a left-aligned
      // heading over right-aligned numbers reads as a different column.
      const th = element('th', /Slices/.test(title) ? 'numeric' : null, title);
      th.scope = 'col';
      headRow.append(th);
    }
    head.append(headRow);

    const body = element('tbody');
    const beforeByKey = new Map(before.perFeature.map((entry) => [entry.key, entry]));
    for (const entry of after.perFeature) {
      const previous = beforeByKey.get(entry.key);
      const tr = document.createElement('tr');
      const th = element('th', null, entry.label);
      th.scope = 'row';
      const rangeText = Number.isFinite(entry.min)
        ? `${formatPercentile(entry.min)} to ${formatPercentile(entry.max)}`
        : 'no gene has a value';
      tr.append(
        th,
        element('td', 'numeric', `${previous ? previous.binCount : 0} of 5`),
        element('td', 'numeric', `${entry.binCount} of 5`),
        element('td', null, rangeText),
      );
      if (entry.missing > 0) {
        const missing = element('span', 'row-unit', ` · ${formatCount(entry.missing)} without a value`);
        tr.lastChild.append(missing);
      }
      body.append(tr);
    }

    const foot = element('tfoot');
    const footRow = document.createElement('tr');
    const footHead = element('th', null, 'All features');
    footHead.scope = 'row';
    footRow.append(
      footHead,
      element('td', 'numeric', `${before.filledBins} of ${before.totalBins}`),
      element('td', 'numeric', `${after.filledBins} of ${after.totalBins}`),
      element('td', null, Number.isFinite(after.minPairDistance)
        ? `closest pair ${after.minPairDistance.toFixed(2)}, average ${after.meanPairDistance.toFixed(2)}`
        : 'a single gene has no pair'),
    );
    foot.append(footRow);

    table.append(caption, head, body, foot);
    scroll.append(table);
    section.append(scroll);
    return section;
  }

  renderGenes() {
    const section = element('section', 'panel-genes');
    section.append(element('h3', null, 'Why each gene is here'));
    const list = element('ol', 'panel-gene-list');
    for (const gene of this.design.genes) list.append(this.renderGene(gene));
    section.append(list);
    return section;
  }

  renderGene(gene) {
    const item = element('li', 'panel-gene');
    const header = element('div', 'panel-gene-header');

    const title = element('p', 'panel-gene-title');
    const select = element('button', 'shortlist-row-link');
    select.type = 'button';
    select.append(element('span', 'locus-tag', gene.id));
    if (gene.name) select.append(element('b', null, ` ${gene.name}`));
    select.setAttribute('aria-label', `Show ${gene.id} in the gene panel`);
    select.addEventListener('click', () => this.handlers.onSelect(gene.id));
    const role = element('span', 'panel-role-tag', gene.role === 'added' ? 'chosen' : gene.role);
    title.append(select, ' ', role);
    header.append(title);

    const actions = element('div', 'search-result-actions');
    const locked = this.config.seeds.includes(gene.id);
    const lock = element('button', locked ? 'chip-button active' : 'chip-button',
      locked ? 'Kept' : 'Keep');
    lock.type = 'button';
    lock.setAttribute('aria-pressed', String(locked));
    lock.setAttribute('aria-label', locked
      ? `${gene.id} is kept in the panel; select to release it`
      : `Keep ${gene.id} in the panel when it is regenerated`);
    lock.addEventListener('click', () => {
      this.config.seeds = locked
        ? this.config.seeds.filter((id) => id !== gene.id)
        : [...this.config.seeds, gene.id];
      this.renderForm();
      this.renderResult();
      this.handlers.onAnnounce(locked
        ? `${gene.id} released. Regenerate to choose again.`
        : `${gene.id} kept in the panel.`);
    });
    const drop = element('button', 'chip-button danger', 'Remove');
    drop.type = 'button';
    drop.setAttribute('aria-label', `Remove ${gene.id} and design the panel again without it`);
    drop.addEventListener('click', () => {
      this.config.exclude = [...new Set([...this.config.exclude, gene.id])];
      this.config.seeds = this.config.seeds.filter((id) => id !== gene.id);
      this.run();
    });
    actions.append(lock, drop);
    header.append(actions);
    item.append(header);

    if (gene.product) item.append(element('p', 'panel-gene-product', gene.product));

    if (gene.nearestId) {
      item.append(element('p', 'panel-gene-line',
        `Closest selected gene: ${gene.nearestId}, ${gene.nearestDistance.toFixed(2)} away in `
        + 'percentile units.'));
    } else {
      item.append(element('p', 'panel-gene-line', gene.role === 'seed'
        ? 'You kept this gene, so the panel was built around it.'
        : 'Chosen first, as the gene furthest from an ordinary one in every feature.'));
    }

    if (gene.expands.length > 0) {
      const details = element('details', 'panel-gene-details');
      details.append(element('summary', null,
        `Reaches ${gene.expands.length} part${gene.expands.length === 1 ? '' : 's'} of the space `
        + 'nothing before it reached'));
      const list = element('ul', 'panel-reason-list');
      for (const entry of gene.expands.slice(0, 8)) {
        const text = entry.newBin
          ? `${entry.label}: ${formatPercentile(entry.percentile)}, a slice no earlier gene occupied`
          : `${entry.label}: ${formatPercentile(entry.percentile)}, ${entry.direction} everything earlier`;
        list.append(element('li', null, text));
      }
      if (gene.expands.length > 8) {
        list.append(element('li', 'panel-note',
          `and ${gene.expands.length - 8} more.`));
      }
      details.append(list);
      item.append(details);
    }

    if (gene.satisfies.length > 0) {
      const details = element('details', 'panel-gene-details');
      details.append(element('summary', null,
        `Clears ${gene.satisfies.length} constraint${gene.satisfies.length === 1 ? '' : 's'}`));
      const list = element('ul', 'panel-reason-list');
      for (const entry of gene.satisfies) {
        const text = entry.value === null || entry.value === undefined
          ? entry.label
          : `${entry.label} — this gene: ${formatValue({ integer: false }, entry.value)}`;
        list.append(element('li', null, text));
      }
      details.append(list);
      item.append(details);
    }

    if (gene.caveats.length > 0) {
      const caveats = element('div', 'gene-flag');
      caveats.append(element('strong', null, 'Worth knowing. '));
      const list = element('ul', 'panel-reason-list');
      for (const caveat of gene.caveats) list.append(element('li', null, caveat));
      caveats.append(list);
      item.append(caveats);
    }
    return item;
  }

  renderMatrix() {
    const { dataset, registry } = this.state;
    const matrix = buildSchemeMatrix({
      dataset,
      registry,
      ids: this.design.selected,
      schemes: this.schemes,
      schemeFields: this.schemeFields,
    });
    const section = element('section', 'panel-matrix');
    section.append(element('h3', null, 'Gene by scheme'));
    section.append(element('p', 'panel-note',
      'One row per gene and scheme, never a wider row, so every number stays attached to the '
      + 'scheme that produced it. An empty cell is a value this dataset does not have.'));

    const scroll = element('div', 'table-scroll');
    const table = element('table', 'data-table');
    table.append(element('caption', null,
      `${formatCount(matrix.rows.length)} genes across ${formatCount(matrix.schemes.length)} `
      + `scheme${matrix.schemes.length === 1 ? '' : 's'}.`));
    const head = element('thead');
    const headRow = document.createElement('tr');
    for (const title of ['Gene', 'Scheme', ...matrix.metrics.map((metric) => metric.label)]) {
      const th = element('th', null, title);
      th.scope = 'col';
      headRow.append(th);
    }
    head.append(headRow);
    const body = element('tbody');
    for (const row of matrix.rows) {
      row.cells.forEach((cell, position) => {
        const tr = document.createElement('tr');
        const th = element('th', null, position === 0 ? row.id : '');
        th.scope = 'row';
        if (position > 0) th.setAttribute('aria-label', row.id);
        tr.append(th, element('td', null, cell.schemeName ?? 'Wild type'));
        cell.values.forEach((value, i) => {
          const td = element('td', 'numeric');
          if (Number.isFinite(value)) {
            td.textContent = formatValue(matrix.metrics[i], value);
          } else {
            td.classList.add('missing');
            td.append(element('span', 'visually-hidden', 'no value'));
          }
          tr.append(td);
        });
        body.append(tr);
      });
    }
    table.append(head, body);
    scroll.append(table);
    section.append(scroll);
    return section;
  }

  renderExport() {
    const section = element('section', 'panel-export');
    const actions = element('div', 'button-row');
    const exportButton = element('button', 'chip-button', 'Export panel and manifest');
    exportButton.type = 'button';
    exportButton.setAttribute('aria-describedby', 'panel-export-note');
    exportButton.addEventListener('click', () => this.exportPanel());
    const shortlistButton = element('button', 'chip-button', 'Add the panel to the shortlist');
    shortlistButton.type = 'button';
    shortlistButton.addEventListener('click', () => {
      this.handlers.onShortlist(this.design.selected);
    });
    actions.append(exportButton, shortlistButton);

    const note = element('p', 'panel-note');
    note.id = 'panel-export-note';
    note.textContent = 'The manifest carries the size, the seeds, every constraint including the '
      + 'ones that were blocked, the objective, the feature set, and the dataset identity, so the '
      + 'same panel can be rebuilt and checked rather than taken on trust.';
    this.exportStatus = element('p', 'panel-note');
    this.exportStatus.setAttribute('role', 'status');
    section.append(actions, note, this.exportStatus);
    return section;
  }

  exportPanel() {
    const { dataset, registry } = this.state;
    const result = buildPanelExport({
      dataset,
      registry,
      design: this.design,
      space: this.space,
      schemes: this.schemes,
    });
    for (const file of result.files) {
      const blob = new Blob([file.content], { type: file.type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
    this.exportStatus.textContent = `Exported ${formatCount(result.rows.length)} rows as `
      + `${result.baseName}.csv, manifest ${result.manifest.manifestId}.`;
  }
}
