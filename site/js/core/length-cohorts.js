/** Pinned annotation cohorts and inclusive nucleotide-length arithmetic. */

export const LENGTH_COHORTS = Object.freeze([
  { id: 'annotated', label: 'All annotated loci', field: 'geneSpanNt' },
  { id: 'coding', label: 'Protein-coding gene spans', field: 'geneSpanNt' },
  { id: 'cds', label: 'Screened CDSs', field: 'cdsLengthNt' },
  { id: 'refseq', label: 'RefSeq protein-record CDSs', field: 'cdsLengthNt' },
  { id: 'rna', label: 'Noncoding RNA genes', field: 'geneSpanNt' },
  { id: 'pseudogene', label: 'Pseudogenes', field: 'geneSpanNt' },
]);

export function validateLengthInventory(inventory, genes, annotationRelease) {
  if (!inventory || inventory.schemaVersion !== 1 || !Array.isArray(inventory.records)) {
    throw new Error('length_cohorts.json has an invalid schema');
  }
  if (annotationRelease && inventory.annotationRelease !== annotationRelease) {
    throw new Error('length cohort annotation release differs from the gene dataset');
  }
  const byId = new Map();
  for (const row of inventory.records) {
    if (typeof row.id !== 'string' || byId.has(row.id)
      || !Number.isInteger(row.geneSpanNt) || row.geneSpanNt < 1
      || (row.cdsLengthNt !== null
        && (!Number.isInteger(row.cdsLengthNt) || row.cdsLengthNt < 1))) {
      throw new Error('length cohort record is missing, repeated, or invalid');
    }
    byId.set(row.id, row);
  }
  for (const gene of genes) {
    const row = byId.get(gene.id);
    if (!row || row.biotype !== 'protein_coding' || row.cdsLengthNt !== gene.lengthNt) {
      throw new Error(`length cohort CDS disagrees with ${gene.id}`);
    }
  }
  if (inventory.counts.annotatedLoci !== byId.size
    || inventory.counts.screenedCds !== genes.length
    || inventory.counts.refseqProteinRecordLoci
      !== inventory.records.filter((row) => row.refseqProteinRecord).length) {
    throw new Error('length cohort denominators are inconsistent');
  }
  return inventory;
}

export function cohortValues(inventory, cohortId) {
  const cohort = LENGTH_COHORTS.find((entry) => entry.id === cohortId);
  if (!cohort) throw new Error(`unknown length cohort: ${cohortId}`);
  const records = inventory?.records ?? [];
  const included = records.filter((record) => {
    if (cohortId === 'annotated') return true;
    if (cohortId === 'coding') return record.biotype === 'protein_coding';
    if (cohortId === 'cds') return record.cdsLengthNt !== null;
    if (cohortId === 'refseq') return record.refseqProteinRecord;
    if (cohortId === 'rna') {
      return !['protein_coding', 'pseudogene'].includes(record.biotype);
    }
    return record.biotype === 'pseudogene';
  });
  const values = included.map((record) => record[cohort.field]);
  return {
    cohort,
    values: values.filter(Number.isFinite),
    total: included.length,
    unknown: values.length - values.filter(Number.isFinite).length,
  };
}

export function countInRange(values, min, max) {
  return values.filter((value) => Number.isFinite(value)
    && (min === null || value >= min) && (max === null || value <= max)).length;
}

export function lengthBins(values, count = 32) {
  if (!Number.isInteger(count) || count < 1) throw new Error('bin count must be positive');
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { min: null, max: null, bins: Array(count).fill(0) };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  const bins = Array(count).fill(0);
  for (const value of finite) {
    bins[Math.min(count - 1, Math.floor(((value - min) / span) * count))] += 1;
  }
  return { min, max, bins };
}

/** Count passing loci inside each displayed bin, including endpoint values. */
export function passingLengthBins(values, histogram, minBound, maxBound) {
  const passed = Array(histogram.bins.length).fill(0);
  if (histogram.min === null) return passed;
  const span = histogram.max - histogram.min || 1;
  for (const value of values) {
    if (!Number.isFinite(value)
      || (minBound !== null && value < minBound)
      || (maxBound !== null && value > maxBound)) continue;
    const index = Math.min(passed.length - 1,
      Math.floor(((value - histogram.min) / span) * passed.length));
    passed[index] += 1;
  }
  return passed;
}
