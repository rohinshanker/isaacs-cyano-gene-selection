/** Resolve source membership once per immutable application-state snapshot. */
import { normalizeSelection } from './data-sources.js';
import { selectedOfType, typeGroups } from './type-metrics.js';

const NONE = Object.freeze([]);

/**
 * Source membership depends on the dataset catalogue, selected IDs and named
 * contributors, never on the gene being read. Callers replace these inputs
 * when they change; do not mutate their arrays, records or objects in place.
 *
 * Only membership is cached. Registry metrics and their values remain live,
 * including values joined by a later expression-layer download.
 */
export function createSourceSelectionResolver() {
  let previousDatasets;
  let previousSources;
  let previousTypeSources;
  let resolved;
  return (datasets, sources, typeSources) => {
    if (resolved && datasets === previousDatasets && sources === previousSources
      && typeSources === previousTypeSources) return resolved;

    const selection = Object.freeze(normalizeSelection(sources, datasets));
    const contributors = new Map();
    for (const [key, group] of typeGroups(datasets)) {
      const selected = selectedOfType(group, selection);
      const named = selected.find((dataset) => dataset.id === typeSources?.[key]);
      contributors.set(key, Object.freeze(named ? [named] : selected));
    }
    previousDatasets = datasets;
    previousSources = sources;
    previousTypeSources = typeSources;
    resolved = {
      selection,
      contributing: (key) => contributors.get(key) ?? NONE,
    };
    return resolved;
  };
}
