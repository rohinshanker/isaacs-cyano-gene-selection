// Runs the site's own live-metric code against the REAL generated data, in Node.
//
// The site's development fixtures are synthetic, so a burden number verified
// against them proves the arithmetic but not the biology. This harness loads
// site/data through the same loader the page uses and asserts the results match
// figures measured independently from the raw genome. It needs no browser, so it
// can run in CI alongside the contract validator.
//
// Usage: node tools/check_live_metrics.mjs

import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const DATA = new URL('site/data/', ROOT);

const { loadDataset } = await import(new URL('site/js/core/dataset.js', ROOT));
const { compileScheme, verifyProteinsUnchanged, PRESETS } =
  await import(new URL('site/js/core/scheme.js', ROOT));
const { computeLiveMetrics } = await import(new URL('site/js/core/live-metrics.js', ROOT));

// Measured independently from the raw NCBI CDS records. See
// docs/validation/genome-provenance.md and tools/validate_contract.py.
const EXPECTED_GENES = 2715;
const EXPECTED_STOPS = { TAG: 1071, TAA: 895, TGA: 749 };

const failures = [];
function note(ok, label, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ': ' + detail : ''}`);
  if (!ok) failures.push(label);
}

const fetchImpl = async (href) => {
  const body = await readFile(new URL(href), 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

const dataset = await loadDataset({ baseUrl: DATA, fetchImpl });
const { genes, table, packed, offsets } = dataset;

note(genes.length === EXPECTED_GENES, 'dataset loads every gene',
  `${genes.length} of ${EXPECTED_GENES}`);

const stops = {};
for (const gene of genes) stops[gene.terminalStop] = (stops[gene.terminalStop] ?? 0) + 1;
const stable = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort()));
note(stable(stops) === stable(EXPECTED_STOPS),
  'terminal stop distribution matches the raw genome', stable(stops));

// Amber reassignment is the case that the packed string alone cannot express.
// Every TAG-terminated gene must register exactly one stop edit.
const amber = computeLiveMetrics(dataset, compileScheme({ TAG: 'TAA' }, table));
let stopEdits = 0;
for (let g = 0; g < genes.length; g += 1) stopEdits += amber.fields.targetStopEdit[g];
note(stopEdits === EXPECTED_STOPS.TAG,
  'amber scheme reports one stop edit per TAG-terminated gene',
  `${stopEdits} edits, expected ${EXPECTED_STOPS.TAG}`);

// Per the contract, a reassigned terminal stop contributes to the edit total.
// Amber targets no sense codon, so the total must equal the stop edits exactly.
let totalEdits = 0;
for (let g = 0; g < genes.length; g += 1) totalEdits += amber.fields.targetCount[g];
note(totalEdits === stopEdits,
  'amber total equals its stop edits, since it targets no sense codon',
  `${totalEdits} total against ${stopEdits} stop edits`);

// Position zero is the initiation triplet and must never be matched, even when
// the same triplet is a legitimate target elsewhere in the gene.
const gtg = computeLiveMetrics(dataset, compileScheme({ GTG: 'GTA' }, table));
const gtgIndex = table.indexOf('GTG');
let initiationCounted = 0;
for (let g = 0; g < genes.length; g += 1) {
  const start = offsets[g];
  const end = offsets[g + 1];
  let internal = 0;
  for (let i = start + 1; i < end; i += 1) if (packed[i] === gtgIndex) internal += 1;
  if (gtg.fields.targetCount[g] !== internal) initiationCounted += 1;
}
note(initiationCounted === 0,
  'initiation codon is excluded from target matching',
  `${initiationCounted} genes disagreed`);

let gtgStarts = 0;
for (let g = 0; g < genes.length; g += 1) if (packed[offsets[g]] === gtgIndex) gtgStarts += 1;
note(gtgStarts > 0, 'genes beginning GTG exist, so that rule is actually exercised',
  `${gtgStarts} genes`);

// No scheme may change an encoded protein.
for (const preset of PRESETS) {
  const compiled = compileScheme(preset.map ?? preset.codons ?? {}, table);
  const result = verifyProteinsUnchanged(dataset, compiled);
  const ok = result === true || result?.ok === true;
  note(ok, `preset "${preset.name ?? preset.id}" preserves every protein`,
    ok ? '' : JSON.stringify(result?.firstMismatch ?? result).slice(0, 140));
}

// The whole-genome scan must stay inside the interaction budget.
note(amber.elapsedMs < 400, 'a scheme change scans the genome within budget',
  `${amber.elapsedMs.toFixed(1)} ms for ${amber.codonsScanned.toLocaleString()} codons`);

console.log(`\nfailed=${failures.length}`);
process.exit(failures.length ? 1 : 0);
