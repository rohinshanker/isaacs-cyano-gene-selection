"""Independent native-file audit; imports no project mapping/reader code."""
import argparse
import csv
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

PARSER = argparse.ArgumentParser(description=__doc__)
PARSER.add_argument("--input", type=Path, required=True)
PARSER.add_argument("--output", type=Path, required=True)
ARGS = PARSER.parse_args()
if ARGS.output.exists() or ARGS.output.is_symlink():
    PARSER.error("Output must be a new file")
ROOT = Path(__file__).resolve().parents[3]
SOURCE = ARGS.input
UNI = ROOT/'data/expression/ingest/uniprot_pcc7942_orf_names.tsv'
CROSS = ROOT/'data/annotation/releases/GCF_000817325.1-RS_2026_05_13/identifier-crosswalk-v1.tsv'
PROTEIN = ROOT/'data/protein-evidence/releases/GCF_000817325.1-RS_2026_05_13-protein-evidence-v1/protein-identity-v1.tsv'

def digest(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


PINS = {
    SOURCE: "c6cb4794f0a1ff854899b83ddec2ebbef20577387c262b279a6f2519be9a06b5",
    UNI: "d3a018d87aa173c89468a068da5d71aa8c4166b9b5607c777354bab807bee515",
    CROSS: "97e3022e53cd1e31f5931ead37f425e1d99c032704e5ff8f02c0d75d1755e9ae",
    PROTEIN: "3e9b2b4dafab2ed7e88d09a6126e4464d83bf7929e9e5fc7f5ffdf70eb19e79a",
}
for path, pin in PINS.items():
    if digest(path) != pin:
        PARSER.error(f"SHA-256 mismatch: {path}")


def table(path):
    with path.open() as handle:
        return list(csv.DictReader(handle, delimiter='\t', strict=True))

uni = {row['Entry']: row for row in table(UNI)}
u_links = {key: set(row['Gene Names (ordered locus)'].replace(';', ' ').split()) for key, row in uni.items()}
u_inverse = defaultdict(set)
for key, loci in u_links.items():
    for locus in loci:
        u_inverse[locus].add(key)
c_links = defaultdict(set)
c_inverse = defaultdict(set)
c_refseq = defaultdict(set)
c_ambig = set()
for row in table(CROSS):
    if row['relationship'] != 'pcc7942_old_locus_tag':
        continue
    key, target = row['object_id'], row['subject_locus_tag']
    c_links[key].add(target)
    c_inverse[target].add(key)
    c_refseq[key].add(row['evidence'])
    if row['mapping_ambiguity']:
        c_ambig.add(key)
protein = {row['locus_tag']: row for row in table(PROTEIN)}
ids = defaultdict(lambda: {'loci': set(), 'lengths': set(), 'rows': 0, 'labels': set()})
groups = defaultdict(lambda: {'rowCount': 0, 'ambiguousRowCount': 0, 'evaluatedRowCount': 0, 'significantRowCount': 0})
with SOURCE.open() as handle:
    for row in csv.DictReader(handle, delimiter='\t', strict=True):
        e, label = row['Entry'], row['Label']
        ids[e]['loci'].add(row['Gene names  (ordered locus )'])
        ids[e]['lengths'].add(row['Length'])
        ids[e]['rows'] += 1
        ids[e]['labels'].add(label)
        g = groups[e,label]
        g['rowCount'] += 1
        g['ambiguousRowCount'] += row['ambig'] == 'yes'
        # This reproducer accepts only the pinned source, whose statistics are
        # complete. Verify that fact directly instead of assuming prior validity.
        statistics = {name: float(row[name]) for name in (
            'log2FC', 'SE', 'Tvalue', 'DF', 'pvalue', 'adj.pvalue',
            'MissingPercentage', 'ImputationPercentage')}
        if not all(math.isfinite(value) for value in statistics.values()):
            raise ValueError("Pinned source contains a nonfinite statistic")
        if not all(0 <= statistics[name] <= 1 for name in ('pvalue', 'adj.pvalue')):
            raise ValueError("Pinned source contains an invalid p-value")
        if row['issue'] != 'NA' or row['ambig'] not in ('yes', 'no'):
            raise ValueError("Pinned source issue/ambiguity vocabulary changed")
        g['evaluatedRowCount'] += row['ambig'] == 'no'
        g['significantRowCount'] += row['ambig'] == 'no' and float(row['adj.pvalue']) < .01

mappings = {}
for e, data in sorted(ids.items()):
    loci = u_links.get(e, set()); pcc = None; utex = None
    if e not in uni:
        status = 'uniprot_missing'
    elif not loci:
        status = 'uniprot_no_locus'
    elif any(not re.fullmatch(r'Synpcc7942_B?\d{4}[a-z]?', x) for x in loci):
        status = 'uniprot_unsupported_locus'
    elif len(loci) != 1 or any(len(u_inverse[x]) != 1 for x in loci):
        status = 'uniprot_ambiguous'
    else:
        pcc = next(iter(loci))
        refs = set(re.findall(r'[A-Z]+_\d+\.\d+', uni[e]['RefSeq']))
        if pcc not in c_links:
            status = 'crosswalk_missing'
        elif len(c_links[pcc]) != 1 or pcc in c_ambig or any(len(c_inverse[x]) != 1 for x in c_links[pcc]):
            status = 'crosswalk_ambiguous'
        elif not refs:
            status = 'refseq_unconfirmed'
        elif not refs & c_refseq[pcc]:
            status = 'refseq_disagreement'
        elif data['loci'] != {pcc}:
            status = 'source_locus_disagreement'
        else:
            status = 'mapped'; utex = next(iter(c_links[pcc]))
    mappings[e] = {'status': status, 'pccLocus': pcc, 'utexLocus': utex,
                   'sourceLoci': sorted(data['loci']), 'sourceLengths': sorted(data['lengths']),
                   'rowCount': data['rows'], 'comparisonCount': len(data['labels'])}
    if utex:
        mappings[e]['targetProteinLength'] = int(protein[utex]['protein_length_aa'])
        mappings[e]['lengthAgrees'] = data['lengths'] == {protein[utex]['protein_length_aa']}

status_counts=Counter();state_counts=Counter();mapped_state=Counter();label_counts={}
for (e,label), g in sorted(groups.items()):
    status=mappings[e]['status'];status_counts[status]+=1
    state='significant_peptide_evidence' if g['significantRowCount'] else 'no_significant_peptide_evidence' if g['evaluatedRowCount'] else 'not_evaluated'
    state_counts[state]+=1
    if status=='mapped':mapped_state[state]+=1
    report=label_counts.setdefault(label, {'groupCount':0, 'mappingStatuses':Counter(), 'mappedEvidenceStates':Counter(), 'mappedSourceRows':0, 'mappedAmbiguousRows':0, 'mappedSignificantRows':0})
    report['groupCount']+=1;report['mappingStatuses'][status]+=1
    if status=='mapped':
        report['mappedEvidenceStates'][state]+=1
        report['mappedSourceRows']+=g['rowCount'];report['mappedAmbiguousRows']+=g['ambiguousRowCount'];report['mappedSignificantRows']+=g['significantRowCount']
result={
  'schemaVersion':1,
  'scope':'Independent exact-identity check of pinned S3; no browser admission or measured UTEX/confirmed-binding claim',
  'sources':[{'path':str(p.relative_to(ROOT)) if p!=SOURCE else 'S3-pcc7942.tsv', 'sha256':PINS[p], 'bytes':p.stat().st_size} for p in [SOURCE,UNI,CROSS,PROTEIN]],
  'entryCount':len(ids),'groupCount':len(groups),
  'entryMappingStatuses':Counter(x['status'] for x in mappings.values()),
  'groupMappingStatuses':status_counts,'sourceEvidenceStates':state_counts,'mappedEvidenceStates':mapped_state,
  'mappedLengthAgreementCount':sum(x.get('lengthAgrees',False) for x in mappings.values()),
  'mappedLengthDisagreements':{e:x for e,x in mappings.items() if x.get('lengthAgrees') is False},
  'excludedEntries':{e:x for e,x in mappings.items() if x['status']!='mapped'},
  'perLabel':label_counts,
}
serialized = json.dumps(result, indent=2, sort_keys=True) + "\n"
with ARGS.output.open("x", encoding="utf-8", newline="\n") as handle:
    handle.write(serialized)
print(f"Reproduced {len(ids)} identities and {len(groups)} comparisons: {digest(ARGS.output)}")
