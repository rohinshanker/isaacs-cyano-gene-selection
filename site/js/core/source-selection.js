/** Resolve source membership once per immutable application-state snapshot. */
import { normalizeSelection } from './data-sources.js';
import { informingOfType, selectedOfType, typeGroups } from './type-metrics.js';

const NONE = Object.freeze([]);

/**
 * Source membership depends on the dataset catalogue, selected IDs and named
 * contributors, never on the gene being read. Callers replace these inputs
 * when they change. The resolver freezes these containers when accepting them;
 * catalogue records must also remain unchanged for the lifetime of a snapshot.
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

    for (const snapshot of [datasets, sources, typeSources]) {
      if (snapshot) Object.freeze(snapshot);
    }
    const selection = Object.freeze(normalizeSelection(sources, datasets));
    const selectedByType = new Map();
    const contributors = new Map();
    for (const [key, group] of typeGroups(datasets)) {
      const selected = Object.freeze(selectedOfType(group, selection));
      selectedByType.set(key, selected);
      const named = informingOfType(group, selected, typeSources?.[key]);
      contributors.set(key, Object.freeze(named ? [named] : selected));
    }
    previousDatasets = datasets;
    previousSources = sources;
    previousTypeSources = typeSources;
    resolved = {
      selection,
      selected: (key) => selectedByType.get(key) ?? NONE,
      contributing: (key) => contributors.get(key) ?? NONE,
    };
    return resolved;
  };
}
