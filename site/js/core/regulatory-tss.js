/** Tan 2018 regulatory start sites remain independent feature records. */
export const REGULATORY_TYPES = Object.freeze([
  { id: 'all', label: 'All site types' },
  { id: 'aTSS', label: 'Antisense TSS' },
  { id: 'iTSS', label: 'Internal TSS' },
  { id: 'nTSS', label: 'Orphan or novel TSS' },
]);

export function validateRegulatoryTss(document, genes) {
  if (document?.schemaVersion !== 1 || !Array.isArray(document.rows)
    || !Array.isArray(document.potentialTargets)
    || !Array.isArray(document.sourceDiscrepancies)
    || !Array.isArray(document.sourceWarnings)
    || document.source?.derivedTsvSha256 !== '98a19729bf47940bf6832e3f08c3548fc4ddc7bb866176ab70e9c92c7c8d3dbe'
    || document.source?.potentialTargetsTsvSha256 !== '0aa810d75f1e92200044ac445a7ba4ee90652a9d82d575040a803c9d66607a69') {
    throw new Error('regulatory_tss.json has an unsupported or unpinned schema');
  }
  const loci = new Set(genes.map((gene) => gene.id));
  const counts = { aTSS: 0, iTSS: 0, nTSS: 0 };
  const mapped = new Set();
  const ids = new Set();
  for (const row of document.rows) {
    if (!Object.hasOwn(counts, row.type) || ids.has(row.tss_id)
      || !Number.isInteger(Number(row.position))
      || !['+', '-'].includes(row.strand)) {
      throw new Error('regulatory_tss.json has an invalid site record');
    }
    ids.add(row.tss_id);
    counts[row.type] += 1;
    if (row.mapping_status === 'mapped') {
      if (!loci.has(row.mapped_locus_tag)
        || row.source_locus_tag !== row.mapped_locus_tag) {
        throw new Error('regulatory_tss.json has an invalid exact-locus link');
      }
      mapped.add(row.tss_id);
    } else if (!['unassociated', 'unmapped'].includes(row.mapping_status)
      || row.mapped_locus_tag !== ''
      || (row.mapping_status === 'unassociated' && row.source_locus_tag !== '')
      || (row.mapping_status === 'unmapped'
        && (!row.source_locus_tag || loci.has(row.source_locus_tag)))) {
      throw new Error('regulatory_tss.json has an invalid mapping status');
    }
  }
  if (counts.aTSS !== 1380 || counts.iTSS !== 724 || counts.nTSS !== 229
    || mapped.size !== 2068) {
    throw new Error('regulatory_tss.json does not reconcile to Tan Table S1');
  }
  const byId = new Map(document.rows.map((row) => [row.tss_id, row]));
  const targetCounts = { dark: 0, high_light: 0, high_temperature: 0 };
  for (const claim of document.potentialTargets) {
    const site = byId.get(claim.tss_id);
    if (!Object.hasOwn(targetCounts, claim.comparison)
      || site?.type !== 'aTSS'
      || claim.potential_target_locus !== site.source_locus_tag
      || claim.atss_position !== site.position
      || Number(claim.source_selection_min_abs_log2fc)
        !== (claim.comparison === 'high_temperature' ? 1 : 1.5)) {
      throw new Error('regulatory_tss.json has an invalid potential-target claim');
    }
    targetCounts[claim.comparison] += 1;
  }
  if (targetCounts.dark !== 77 || targetCounts.high_light !== 21
    || targetCounts.high_temperature !== 3) {
    throw new Error('regulatory_tss.json does not reconcile to Tan Table S8');
  }
  if (document.sourceDiscrepancies.length !== 1
    || document.sourceDiscrepancies[0].tssId !== 'aTSS-320358'
    || document.sourceDiscrepancies[0].comparison !== 'dark') {
    throw new Error('regulatory_tss.json has an unexpected Table S1/S8 disagreement');
  }
  if (document.sourceWarnings.length !== 2
    || document.sourceWarnings[0].tssId !== 'aTSS-320358'
    || document.sourceWarnings[1].tssId !== 'iTSS+320358'
    || document.sourceWarnings.some((warning) =>
      warning.comparison !== 'dark' || typeof warning.message !== 'string'
      || !byId.has(warning.tssId))) {
    throw new Error('regulatory_tss.json has unexpected source warnings');
  }
  const counterpart = byId.get('iTSS+320358');
  if (counterpart.dark_log2fc !== '-4.78047469754605'
    || counterpart.control_1 !== '0' || counterpart.control_2 !== '9'
    || counterpart.dark_1 !== '420' || counterpart.dark_2 !== '422') {
    throw new Error('regulatory_tss.json source warning has changed evidence');
  }
  const discrepancy = document.sourceDiscrepancies[0];
  if (discrepancy.tableS1Log2Fc !== byId.get(discrepancy.tssId).dark_log2fc
    || !document.potentialTargets.some((claim) => claim.tss_id === discrepancy.tssId
      && claim.comparison === discrepancy.comparison
      && claim.atss_log2fc === discrepancy.tableS8Log2Fc)) {
    throw new Error('regulatory_tss.json source disagreement has changed evidence');
  }
  return document;
}

export function potentialTargetsBySite(claims) {
  const grouped = new Map();
  for (const claim of claims) {
    if (!grouped.has(claim.tss_id)) grouped.set(claim.tss_id, []);
    grouped.get(claim.tss_id).push(claim);
  }
  return grouped;
}

export function searchRegulatoryTss(rows, {
  query = '', type = 'all', mapping = 'all', potential = 'any', targetSiteIds = new Set(),
} = {}) {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (type !== 'all' && row.type !== type) return false;
    if (mapping !== 'all' && row.mapping_status !== mapping) return false;
    if (potential === 'only' && !targetSiteIds.has(row.tss_id)) return false;
    if (!needle) return true;
    return [row.tss_id, row.source_locus_tag, row.mapped_locus_tag,
      row.replicon, row.position].some((value) => String(value).toLowerCase().includes(needle));
  });
}
