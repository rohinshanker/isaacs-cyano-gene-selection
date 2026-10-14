#!/usr/bin/env python3
"""Non-release native Tan gTSS motif-discovery and external ranking pilot."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
import math
from pathlib import Path
import platform
import random
import re
import shutil
import subprocess
import tempfile

try:
    from tools.regulatory_transterm import load_fasta, sha256_file, FASTA_SHA256, EXPECTED_REPLICON_LENGTHS
except ModuleNotFoundError:
    from regulatory_transterm import load_fasta, sha256_file, FASTA_SHA256, EXPECTED_REPLICON_LENGTHS

TSS_SHA256 = 'd06524cf492aa8f009bf004c596a5d305ac54acbe7537ec98bbc7992ce164bff'
ARCHIVE_SHA256 = '0406fb7b1dc27f6aab3d6d3a29ecdf617bbdd946690cfa97ca2129bc210bfd12'
BINARY_SHA256 = 'ae3939a2230f9a03654339b661656033eb6aad5a047700f332203cd3e67c2bd8'
BENCHMARK_SHA256 = ('1bb39334d8eedc911948d82ef58547bd327c2d75893b233518604ee6babfc592',
                    '723a2cca1d3c7b96bedff0190a3a06c071a47b2ffd659f38b5d8865165bd1863')
BASES = 'ACGT'
PLANT = 'ACGTCGAT'


class PilotError(ValueError):
    """Input, execution or output contract violation."""


def rc(sequence):
    return sequence.translate(str.maketrans('ACGT', 'TGCA'))[::-1]


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def require_pin(path, expected):
    if sha256_file(path) != expected:
        raise PilotError(f'{path.name}: SHA-256 mismatch')


def upstream_window(sequence, position, strand, width):
    """Return transcription-oriented [-width,-1], excluding the one-based TSS."""
    if strand not in ('+', '-') or not 1 <= position <= len(sequence) or not 1 <= width < len(sequence):
        raise PilotError('invalid window strand/anchor/width')
    start = position - width if strand == '+' else position + 1
    coordinates = [((start + i - 1) % len(sequence)) + 1 for i in range(width)]
    segments = []
    for coordinate in coordinates:
        if segments and segments[-1][1] + 1 == coordinate:
            segments[-1][1] = coordinate
        else:
            segments.append([coordinate, coordinate])
    bases = ''.join(sequence[p - 1] for p in coordinates)
    if strand == '-':
        bases = rc(bases)
        coordinates.reverse()
    return dict(sequence=bases, physicalSegments=segments, wrapsOrigin=len(segments) > 1,
                orientedFirstBase=coordinates[0], orientedLastBase=coordinates[-1])


def native_cohort(fasta, tss, width):
    require_pin(fasta, FASTA_SHA256)
    require_pin(tss, TSS_SHA256)
    sequences = load_fasta(fasta)
    if {key: len(value) for key, value in sequences.items()} != EXPECTED_REPLICON_LENGTHS:
        raise PilotError('native replicon lengths mismatch')
    with tss.open(encoding='utf-8', newline='') as handle:
        anchors = list(csv.DictReader(handle, delimiter='\t'))
    if len(anchors) != 2475:
        raise PilotError('expected 2475 gTSS anchors')
    result = []
    seen = set()
    for anchor in anchors:
        identifier = anchor['tss_id']
        replicon = 'NZ_' + anchor['replicon'] + '.1'
        position = int(anchor['position'])
        strand = anchor['strand']
        if identifier in seen or identifier != f'gTSS{strand}{position}' or anchor['type'] != 'gTSS':
            raise PilotError('invalid or duplicate gTSS identifier')
        if replicon not in sequences or not anchor['locus_tag']:
            raise PilotError('unknown replicon or empty source locus')
        seen.add(identifier)
        result.append(dict(id=identifier, replicon=replicon, position=position, strand=strand,
                           sourceLocus=anchor['locus_tag'],
                           **upstream_window(sequences[replicon], position, strand, width)))
    return sorted(result, key=lambda row: row['id'])


def blocked_partition(rows, seed, max_discovery, max_evaluation, homology_word=30):
    """Union loci, overlaps, exact words and >=80% aligned identity either strand."""
    if not rows or homology_word < 1 or min(max_discovery, max_evaluation) < 2:
        raise PilotError('invalid partition bounds')
    parent = list(range(len(rows)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        parent[find(j)] = find(i)

    loci, words, intervals = {}, {}, defaultdict(list)
    for i, row in enumerate(rows):
        locus = (row['replicon'], row['sourceLocus'])
        if locus in loci:
            union(i, loci[locus])
        loci[locus] = i
        sequence = row['sequence']
        # Whole-window key also protects sequences shorter than homology_word.
        keys = {min(sequence, rc(sequence))}
        for offset in range(len(sequence) - homology_word + 1):
            word = sequence[offset:offset + homology_word]
            keys.add(min(word, rc(word)))
        for word in sorted(keys):
            if word in words:
                union(i, words[word])
            words[word] = i
        for start, end in row['physicalSegments']:
            intervals[row['replicon']].append((start, end, i))
    for spans in intervals.values():
        last_end, last_i = -1, 0
        for start, end, i in sorted(spans):
            if start <= last_end:
                union(i, last_i)
            if end > last_end:
                last_end, last_i = end, i
    # Two-bit packed Hamming distance avoids an expensive Python loop per base.
    # All equal-length pairs are compared: no sketch or candidate filter can miss
    # an ungapped, offset-zero 80% identity pair in either orientation.
    encoded = []
    for row in rows:
        sequence = row['sequence']
        forward = int(''.join(format(BASES.index(base), '02b') for base in sequence), 2)
        reverse = int(''.join(format(BASES.index(base), '02b') for base in rc(sequence)), 2)
        mask = int('01' * len(sequence), 2)
        encoded.append((len(sequence), forward, reverse, mask))
    for i, (width, forward, _, mask) in enumerate(encoded):
        for j in range(i):
            other_width, other_forward, other_reverse, _ = encoded[j]
            if width != other_width:
                continue
            for other in (other_forward, other_reverse):
                difference = forward ^ other
                mismatches = ((difference | (difference >> 1)) & mask).bit_count()
                if mismatches * 5 <= width:
                    union(i, j)
                    break
    groups = defaultdict(list)
    for i, row in enumerate(rows):
        groups[find(i)].append(row)
    counts = Counter()
    group_sizes = []
    ordered = []
    for members in groups.values():
        group_id = digest('\n'.join(sorted(row['id'] for row in members)))
        key = digest(f'{seed}:{group_id}')
        ordered.append((key, group_id, members))
    for key, group_id, members in sorted(ordered):
        split = 'evaluation' if int(key, 16) % 5 == 0 else 'discovery'
        limit = max_evaluation if split == 'evaluation' else max_discovery
        selected = counts[split] + len(members) <= limit
        if selected:
            counts[split] += len(members)
        for row in members:
            row.update(group=group_id, partition=split, selected=selected)
        group_sizes.append(len(members))
    if min(counts['evaluation'], counts['discovery']) < 5:
        raise PilotError('fewer than five sequences in selected cohort')
    return dict(groups=len(groups), largestGroup=max(group_sizes), selected=dict(counts),
                totalByPartition=dict(Counter(row['partition'] for row in rows)))


def word_counts(sequence, k):
    return Counter(sequence[i:i + k] for i in range(len(sequence) - k + 1))


def shuffle_order2(sequence, seed):
    """Random Euler trail: preserve linear 1/2/3-mer counts and first/last 2 nt."""
    if len(sequence) < 3 or set(sequence) - set(BASES):
        raise PilotError('order-2 shuffle requires >=3 ACGT bases')
    rng = random.Random(seed)
    edges = defaultdict(list)
    for i in range(len(sequence) - 2):
        edges[sequence[i:i + 2]].append(sequence[i + 1:i + 3])
    for node in sorted(edges):
        rng.shuffle(edges[node])
    stack, trail = [sequence[:2]], []
    while stack:
        node = stack[-1]
        if edges[node]:
            stack.append(edges[node].pop())
        else:
            trail.append(stack.pop())
    trail.reverse()
    shuffled = trail[0] + ''.join(node[-1] for node in trail[1:])
    if any(word_counts(sequence, k) != word_counts(shuffled, k) for k in (1, 2, 3)):
        raise PilotError('shuffle preservation failure')
    return shuffled


def fasta_bytes(rows):
    return ''.join(f">{row['id']}\n{row['sequence']}\n" for row in rows).encode()


def execute(command, timeout):
    try:
        result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise PilotError(f'STREME execution failed: {error}') from error
    if result.returncode:
        raise PilotError(f'STREME exited {result.returncode}: {result.stderr[:500]}')
    return result


def parse_pwms(report):
    if 'MEME version 5.5.9' not in report or 'ALPHABET= ACGT' not in report:
        raise PilotError('wrong STREME version/alphabet in report')
    motifs = []
    lines = report.splitlines()
    for i, line in enumerate(lines):
        if not line.startswith('MOTIF '):
            continue
        if i + 2 >= len(lines):
            raise PilotError('truncated motif')
        match = re.search(r'alength=\s*4\s+w=\s*(\d+)', lines[i + 1])
        if not match:
            raise PilotError('invalid PWM header')
        width = int(match[1])
        if not 3 <= width <= 30:
            raise PilotError('invalid PWM width')
        try:
            pwm = [[float(value) for value in row.split()] for row in lines[i + 2:i + 2 + width]]
        except ValueError as error:
            raise PilotError('invalid PWM numbers') from error
        if len(pwm) != width or any(len(row) != 4 or any(not math.isfinite(p) or p < 0 or p > 1 for p in row)
                                   or abs(sum(row) - 1) > 1e-4 for row in pwm):
            raise PilotError('invalid PWM probabilities')
        motifs.append(dict(id=line.split()[1], pwm=pwm,
                           consensus=''.join(BASES[max(range(4), key=lambda j: row[j])] for row in pwm)))
    # No motif is a valid bounded null outcome, not invented recovery.
    return motifs


def streme_run(binary, foreground, destination, seed, timeout, negative=None, fixed_width=None):
    command = [str(binary), '--p', str(foreground), '--dna', '--order', '2', '--seed', str(seed),
               '--hofract', '0.2', '--nmotifs', '1', '--text']
    command += ['--w', str(fixed_width)] if fixed_width else ['--minw', '6', '--maxw', '15']
    if negative is not None:
        command += ['--n', str(negative)]
    result = execute(command, timeout)
    destination.with_suffix('.txt').write_text(result.stdout, encoding='utf-8')
    destination.with_suffix('.stderr').write_text(result.stderr, encoding='utf-8')
    return dict(argv=command, motifs=parse_pwms(result.stdout))


def background_frequencies(rows):
    counts = Counter(''.join(row['sequence'] for row in rows))
    total = sum(counts.values()) + 4
    return [(counts[base] + 1) / total for base in BASES]


def best_score(sequence, pwm, background):
    """Maximum both-strand sum log2((p+1e-6)/(1+4e-6)/background)."""
    width = len(pwm)
    if len(sequence) < width or set(sequence) - set(BASES) or len(background) != 4 \
            or any(not math.isfinite(p) or p <= 0 for p in background):
        raise PilotError('invalid score sequence/background')
    weights = [[math.log2((p + 1e-6) / (1 + 4e-6) / background[j]) for j, p in enumerate(row)] for row in pwm]
    best = None
    for strand, bases in (('+', sequence), ('-', rc(sequence))):
        for offset in range(len(sequence) - width + 1):
            score = sum(weights[i][BASES.index(base)] for i, base in enumerate(bases[offset:offset + width]))
            candidate = dict(score=score, strand=strand,
                             offset0=offset if strand == '+' else len(sequence) - offset - width)
            if best is None or score > best['score']:
                best = candidate
    return best


def ranking_evaluation(rows, controls, motifs, background):
    results = []
    for motif in motifs:
        positive = [dict(id=row['id'], **best_score(row['sequence'], motif['pwm'], background)) for row in rows]
        negative = [dict(id=row['id'], **best_score(row['sequence'], motif['pwm'], background)) for row in controls]
        p_scores = [row['score'] for row in positive]
        n_scores = [row['score'] for row in negative]
        auc = sum((p > n) + 0.5 * (p == n) for p in p_scores for n in n_scores) / (len(rows) * len(controls))
        results.append(dict(motif=motif['id'], auc=auc, meanPositive=sum(p_scores)/len(p_scores),
                            meanControl=sum(n_scores)/len(n_scores), positive=positive, controls=negative))
    return results


def motif_recovery(pwm, planted=PLANT):
    """Best orientation/offset with missing plant columns scored as zero recovery."""
    candidates = []
    for strand in ('+', '-'):
        matrix = pwm if strand == '+' else [list(reversed(row)) for row in reversed(pwm)]
        consensus = ''.join(BASES[max(range(4), key=lambda j: row[j])] for row in matrix)
        for offset in range(-len(matrix) + 1, len(planted)):
            pairs = [(i, i + offset) for i in range(len(matrix)) if 0 <= i + offset < len(planted)]
            matches = sum(consensus[i] == planted[j] for i, j in pairs)
            probability = sum(matrix[i][BASES.index(planted[j])] for i, j in pairs) / len(planted)
            candidates.append(dict(strand=strand, offset0=offset, overlappingColumns=len(pairs),
                                   consensusMatches=matches, plantedCoverage=len(pairs)/len(planted),
                                   consensusRecovery=matches/len(planted), probabilityRecovery=probability,
                                   exactFullConsensus=(offset == 0 and consensus == planted)))
    return max(candidates, key=lambda row: (row['consensusRecovery'], row['probabilityRecovery'], row['overlappingColumns']))


def benchmark_external(seed, count=100):
    rng = random.Random(seed)
    positive, negative = [], []
    for i in range(count):
        sequence = ''.join(rng.choice(BASES) for _ in range(100))
        strand = '+' if i % 2 == 0 else '-'
        sequence = sequence[:45] + (PLANT if strand == '+' else rc(PLANT)) + sequence[53:]
        positive.append(dict(id=f'plant-{i}', sequence=sequence, plantedOffset0=45, plantedStrand=strand))
        negative.append(dict(id=f'null-{i}', sequence=''.join(rng.choice(BASES) for _ in range(100))))
    return positive, negative


def run_pilot(args):
    if not 30 <= args.width <= 500 or not math.isfinite(args.timeout) or args.timeout <= 0 or not 0 <= args.seed <= 2**31 - 2:
        raise PilotError('width 30..500, positive timeout and bounded seed required')
    inputs = [args.fasta, args.tss, args.binary, args.source_archive, args.benchmark_foreground, args.benchmark_control]
    for path, expected in zip(inputs[2:], [BINARY_SHA256, ARCHIVE_SHA256, *BENCHMARK_SHA256]):
        require_pin(path, expected)
    rows = native_cohort(args.fasta, args.tss, args.width)
    partition = blocked_partition(rows, args.seed, args.max_discovery, args.max_evaluation)
    output = args.output.absolute()
    if output.exists() or output.is_symlink():
        raise PilotError(f'refusing to overwrite output {output}')
    # A staging directory is owned by this invocation; publication never replaces a destination.
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.streme-', dir=output.parent))
    published = False
    try:
        discovery = [row for row in rows if row['selected'] and row['partition'] == 'discovery']
        evaluation = [row for row in rows if row['selected'] and row['partition'] == 'evaluation']
        controls = [dict(id=row['id'], sequence=shuffle_order2(row['sequence'], int(digest(f"{args.seed}:{row['id']}"), 16))) for row in evaluation]
        null = [dict(id=row['id'], sequence=shuffle_order2(row['sequence'], int(digest(f"null:{args.seed}:{row['id']}"), 16))) for row in discovery]
        for name, records in [('discovery', discovery), ('evaluation', evaluation), ('evaluation-control', controls), ('null-discovery', null)]:
            (staging / f'{name}.fasta').write_bytes(fasta_bytes(records))
        (staging / 'cohort.json').write_text(json.dumps(dict(partition=partition, rows=rows), indent=2)+'\n')
        version = execute([str(args.binary), '--version'], 10).stdout.strip()
        if version != '5.5.9':
            raise PilotError('STREME runtime version mismatch')
        native = streme_run(args.binary, staging/'discovery.fasta', staging/'native', args.seed, args.timeout)
        repeat = streme_run(args.binary, staging/'discovery.fasta', staging/'repeat', args.seed, args.timeout)
        if native['motifs'] != repeat['motifs']:
            raise PilotError('native PWM repeat is not deterministic')
        null_run = streme_run(args.binary, staging/'null-discovery.fasta', staging/'null', args.seed, args.timeout)
        benchmark = streme_run(args.binary, args.benchmark_foreground, staging/'benchmark', args.seed, args.timeout,
                               args.benchmark_control, fixed_width=8)
        background = background_frequencies(discovery)
        external_plant, external_null = benchmark_external(args.seed + 1)
        for name, records in [('benchmark-evaluation', external_plant), ('benchmark-evaluation-control', external_null)]:
            (staging / f'{name}.fasta').write_bytes(fasta_bytes(records))
        benchmark_bg = background_frequencies(list(dict(id=k, sequence=v) for k, v in load_fasta(args.benchmark_control).items()))
        recovery = [dict(motif=motif['id'], **motif_recovery(motif['pwm'])) for motif in benchmark['motifs']]
        synthetic_scores = ranking_evaluation(external_plant, external_null, benchmark['motifs'], benchmark_bg)
        for motif, scores, similarity in zip(benchmark['motifs'], synthetic_scores, recovery):
            width = len(motif['pwm'])
            scores['bestSiteOverlapsPlant'] = sum(max(0, min(hit['offset0'] + width, 53) - max(hit['offset0'], 45)) > 0 for hit in scores['positive'])
            scores['meanPlantOverlapNt'] = sum(max(0, min(hit['offset0'] + width, 53) - max(hit['offset0'], 45)) for hit in scores['positive']) / len(external_plant)
            scores['alignmentOffsetAndStrandConsistent'] = sum(
                hit['strand'] == ('+' if row['plantedStrand'] == similarity['strand'] else '-') and
                hit['offset0'] == (45 + similarity['offset0'] if row['plantedStrand'] == '+' else 53 - similarity['offset0'] - width)
                for row, hit in zip(external_plant, scores['positive']))
        result = dict(schemaVersion=1, method='STREME', release=False,
                      interpretation='exploratory motif/window rankings; not p-values, site calls or biological accuracy',
                      coordinateContract='native one-based inclusive circular physical segments; oriented [-width,-1] excludes TSS',
                      partition=partition, parameters=dict(width=args.width, seed=args.seed, homologyWord=30, alignedIdentityThreshold=0.8,
                      internalHoldout=0.2, externalHoldout='evaluation FASTA never passed to STREME'),
                      controlContract='external/null Euler shuffle preserves per-window length, linear 1/2/3-mer counts and first/last 2 nt; native STREME --order 2 automatic shuffle',
                      scoreContract='both-strand maximum independent-column PWM log2 odds; pseudocount 1e-6 per base, discovery-only +1 mononucleotide background; AUC tie weight 0.5; descriptive, uncalibrated',
                      background=background, native=native, repeatPwmIdentical=True, null=null_run, benchmark=benchmark,
                      external=ranking_evaluation(evaluation, controls, native['motifs'], background),
                      nullExternal=ranking_evaluation(evaluation, controls, null_run['motifs'], background),
                      benchmarkRecovery=recovery, benchmarkExternal=synthetic_scores,
                      coverage=dict(anchors=len(rows), byStrand=dict(Counter(row['strand'] for row in rows)),
                                    byReplicon=dict(Counter(row['replicon'] for row in rows)), originCrossing=sum(row['wrapsOrigin'] for row in rows)),
                      controlsChanged=dict(evaluation=sum(a['sequence'] != b['sequence'] for a,b in zip(evaluation, controls)),
                                           nullDiscovery=sum(a['sequence'] != b['sequence'] for a,b in zip(discovery, null))),
                      provenance=dict(producerSha256=sha256_file(Path(__file__)), inputs={str(p): sha256_file(p) for p in inputs}, version=version,
                                      python=platform.python_version(), platform=platform.platform()),
                      limitations=['shared exact 30-mers or >=80% full-window ungapped identity on either strand block detectable similarity; divergent/gapped/shifted homology without a shared 30-mer can remain',
                                   'gTSS anchors lack experimentally delineated promoter boundaries or validated negative loci',
                                   'overlapping/locus/homology components are transitive; capped cohorts can omit large components',
                                   'one seed and one null training run; window-level AUC is not a biological false-positive rate',
                                   'offline independent-column odds differ from STREME order-2 Markov site scores',
                                   'planted recovery quantifies an artificial benchmark; it does not calibrate native UTEX motifs'])
        # Record executed argv with ephemeral paths as provenance, and retain replayable FASTAs.
        (staging/'result.json').write_text(json.dumps(result, indent=2, allow_nan=False)+'\n')
        manifest = {p.name: sha256_file(p) for p in sorted(staging.iterdir())}
        (staging/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
        # Exclusive mkdir closes the exists-check race; rollback only our reservation.
        output.mkdir()
        published = True
        for path in staging.iterdir():
            path.rename(output/path.name)
        staging.rmdir()
        return result
    except BaseException as error:
        failures = []
        for owned in [staging] + ([output] if published else []):
            try:
                if owned.exists():
                    shutil.rmtree(owned)
            except OSError as cleanup:
                failures.append(f'{owned}: {cleanup}')
        if failures:
            raise PilotError(f'{error}; cleanup failed: {"; ".join(failures)}') from error
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('fasta', 'tss', 'binary', 'source-archive', 'benchmark-foreground', 'benchmark-control', 'output'):
        parser.add_argument('--'+name, required=True, type=Path)
    parser.add_argument('--width', type=int, default=100)
    parser.add_argument('--seed', type=int, default=2973)
    parser.add_argument('--max-discovery', type=int, default=400)
    parser.add_argument('--max-evaluation', type=int, default=200)
    parser.add_argument('--timeout', type=float, default=120)
    args = parser.parse_args()
    try:
        result = run_pilot(args)
    except (PilotError, OSError, ValueError, KeyError) as error:
        parser.exit(1, f'STREME pilot: {error}\n')
    print(json.dumps(dict(coverage=result['coverage'], partition=result['partition'],
                         recovery=result['benchmarkRecovery'], output=str(args.output))))


if __name__ == '__main__':
    main()
