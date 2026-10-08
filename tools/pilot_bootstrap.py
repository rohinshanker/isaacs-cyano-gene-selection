#!/usr/bin/env python3
"""Confidence intervals for the comparability pilot's AUROC statistics.

The pilot (Claude Science package E, returned 2026-10-05) reported AUROCs with
no uncertainty, so a reader could not tell 0.94 from 0.90. Its archive of code
was never delivered, so this recomputes the published numbers from the returned
pairs file first and only then adds intervals: an interval around a number this
tool could not reproduce would be worse than none.

**Why the interval resamples samples and not pairs.** The 10,440 pairs are not
independent observations. They are built from 145 samples, so one sample appears
in many pairs and a bootstrap over pairs would treat the same culture as fresh
evidence dozens of times and report an interval far too narrow. This resamples
the samples, which are the independent unit, and carries each pair with the
multiplicity its two endpoints were drawn at. That is the ordinary cluster
bootstrap for paired data.

**Statistic orientation.** `spearman` is a similarity, so a replicate pair scores
high. `ks_d` and `wasserstein` are distances, so a replicate pair scores low and
the AUROC is taken the other way round. Getting this backwards reproduces every
distance row as one minus its published value, which is how it was caught.

Usage::

    tools/pilot_bootstrap.py                 # recompute, bootstrap, write the table
    tools/pilot_bootstrap.py --check         # recompute only, write nothing
    tools/pilot_bootstrap.py --resamples 200 # fewer draws, for a quick pass
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import random
import sys
from collections import Counter
from pathlib import Path
from typing import Callable, Iterable, Mapping

ROOT = Path(__file__).resolve().parents[1]
HANDOFF = ROOT / "docs/notes/handoff"
PAIRS = HANDOFF / "cyano_comparability_pilot_pairs_20261005.tsv.gz"
PUBLISHED = HANDOFF / "cyano_comparability_pilot_auroc_20261005.tsv"
OUT = HANDOFF / "cyano_comparability_pilot_intervals_20261007.tsv"

#: Pinned at intake of package E, 2026-10-05, and re-verified here.
PAIRS_SHA256 = "2e887169fa233af80467017f53dc60a1ad8bf77cc45440f63859ed967f12d787"

#: Whether a larger value means the two samples are more alike. Spearman is a
#: correlation; the other two are distances.
HIGHER_IS_MORE_SIMILAR = {"spearman": True, "ks_d": False, "wasserstein": False}

#: Reproduction tolerance. The published values carry four decimals.
TOLERANCE = 5e-4

DEFAULT_RESAMPLES = 2000
SEED = 20261005


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_pairs(path: Path = PAIRS) -> list[dict[str, str]]:
    with gzip.open(path, "rt", newline="") as handle:
        return list(csv.DictReader(handle, delimiter="\t"))


def read_published(path: Path = PUBLISHED) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle, delimiter="\t"))


def weighted_auroc(
    positives: Iterable[tuple[float, float]],
    negatives: Iterable[tuple[float, float]],
) -> float:
    """P(a positive outranks a negative), ties counted at a half, with weights.

    Each input is `(value, weight)`. Weights are the multiplicities a cluster
    bootstrap produces; with every weight at one this is the ordinary AUROC.
    """
    pos = [(v, w) for v, w in positives if w > 0]
    neg = [(v, w) for v, w in negatives if w > 0]
    total_pos = sum(w for _, w in pos)
    total_neg = sum(w for _, w in neg)
    if not pos or not neg or total_pos <= 0 or total_neg <= 0:
        return float("nan")
    merged = sorted(
        [(v, w, True) for v, w in pos] + [(v, w, False) for v, w in neg],
        key=lambda item: item[0],
    )
    below = 0.0      # negative weight strictly below the current tied block
    wins = 0.0
    index = 0
    while index < len(merged):
        stop = index
        while stop < len(merged) and merged[stop][0] == merged[index][0]:
            stop += 1
        block = merged[index:stop]
        pos_here = sum(w for _, w, is_pos in block if is_pos)
        neg_here = sum(w for _, w, is_pos in block if not is_pos)
        wins += pos_here * (below + neg_here / 2)
        below += neg_here
        index = stop
    return wins / (total_pos * total_neg)


def selector_for(key: str) -> Callable[[dict[str, str]], bool]:
    """The published rows name either one subclass or a whole class.

    A key ending `_all` names the class, so `ii_all` is every within-study pair
    and `iii_all` every cross-study one. Reading only `ii_all` as a class silently
    emptied the `iii_all` comparisons and produced an interval of nothing.
    """
    if key.endswith("_all"):
        want = key[: -len("_all")]
        return lambda row: row["pair_class"] == want
    return lambda row: row["pair_subclass"] == key


def oriented(value: float, statistic: str) -> float:
    return value if HIGHER_IS_MORE_SIMILAR[statistic] else 1.0 - value


def point_auroc(
    rows: list[dict[str, str]], positive: str, negative: str, statistic: str,
    weights: Mapping[str, float] | None = None,
) -> float:
    """One AUROC over the pairs, optionally weighted by sample multiplicity."""
    want_pos, want_neg = selector_for(positive), selector_for(negative)
    pos: list[tuple[float, float]] = []
    neg: list[tuple[float, float]] = []
    for row in rows:
        raw = row.get(statistic, "")
        if raw in ("", "NA"):
            continue
        if weights is None:
            weight = 1.0
        else:
            # A pair survives a draw only if both of its samples did, and it
            # counts once per combination of their copies.
            weight = weights.get(row["sample_a"], 0.0) * weights.get(row["sample_b"], 0.0)
            if weight <= 0:
                continue
        value = float(raw)
        if want_pos(row):
            pos.append((value, weight))
        elif want_neg(row):
            neg.append((value, weight))
    return oriented(weighted_auroc(pos, neg), statistic)


def samples_behind(rows: list[dict[str, str]], key: str) -> set[str]:
    """The distinct samples a class is built from: its real independent n."""
    want = selector_for(key)
    out: set[str] = set()
    for row in rows:
        if want(row):
            out.add(row["sample_a"])
            out.add(row["sample_b"])
    return out


def bootstrap(
    rows: list[dict[str, str]], positive: str, negative: str, statistic: str,
    samples: list[str], resamples: int, rng: random.Random,
) -> list[float]:
    """Cluster bootstrap over samples, returning the AUROC of each draw."""
    draws: list[float] = []
    for _ in range(resamples):
        counts = Counter(rng.choices(samples, k=len(samples)))
        value = point_auroc(rows, positive, negative, statistic, weights=counts)
        if value == value:  # drop a draw that left a class empty
            draws.append(value)
    return draws


def percentile(values: list[float], fraction: float) -> float:
    """Linear-interpolated percentile of an already meaningful sample."""
    if not values:
        return float("nan")
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = fraction * (len(ordered) - 1)
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--resamples", type=int, default=DEFAULT_RESAMPLES)
    parser.add_argument("--check", action="store_true",
                        help="recompute the published values and write nothing")
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args(argv)

    if not PAIRS.is_file():
        raise SystemExit(f"{PAIRS} is missing")
    observed = sha256_of(PAIRS)
    if observed != PAIRS_SHA256:
        raise SystemExit(
            f"{PAIRS.name}: expected SHA-256 {PAIRS_SHA256}, got {observed}. "
            "The intervals describe the returned file, not a different one."
        )
    rows = read_pairs()
    published = [row for row in read_published() if row["scope"] == "pooled"]
    print(f"pairs: {len(rows)}  published pooled rows: {len(published)}")

    worst = 0.0
    failures = 0
    for row in published:
        got = point_auroc(rows, row["positive"], row["negative"], row["statistic"])
        difference = abs(got - float(row["auroc"]))
        worst = max(worst, difference)
        if difference > TOLERANCE:
            failures += 1
            print(f"  MISMATCH {row['positive']} vs {row['negative']} "
                  f"{row['statistic']}: {got:.4f} against {row['auroc']}")
    print(f"recomputed every published pooled AUROC; worst difference {worst:.5f}")
    if failures:
        print("refusing to report intervals around numbers that do not reproduce",
              file=sys.stderr)
        return 1
    if args.check:
        return 0

    samples = sorted({row["sample_a"] for row in rows} | {row["sample_b"] for row in rows})
    rng = random.Random(SEED)
    print(f"bootstrapping {args.resamples} resamples over {len(samples)} samples")

    out_rows = []
    for row in published:
        positive, negative, statistic = row["positive"], row["negative"], row["statistic"]
        point = point_auroc(rows, positive, negative, statistic)
        draws = bootstrap(rows, positive, negative, statistic, samples,
                          args.resamples, rng)
        low, high = percentile(draws, 0.025), percentile(draws, 0.975)
        pos_samples = samples_behind(rows, positive)
        neg_samples = samples_behind(rows, negative)
        out_rows.append({
            "positive": positive,
            "negative": negative,
            "statistic": statistic,
            "published_auroc": row["auroc"],
            "recomputed_auroc": f"{point:.4f}",
            "ci_low": f"{low:.4f}",
            "ci_high": f"{high:.4f}",
            "ci_width": f"{high - low:.4f}",
            "n_pairs_positive": row["n_pos"],
            "n_pairs_negative": row["n_neg"],
            "n_samples_positive": str(len(pos_samples)),
            "n_samples_negative": str(len(neg_samples)),
            "resamples_used": str(len(draws)),
        })
        print(f"  {statistic:<12} {positive} vs {negative:<26} "
              f"{point:.4f}  [{low:.4f}, {high:.4f}]  "
              f"from {len(pos_samples)} and {len(neg_samples)} samples")

    with args.out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(out_rows[0]), delimiter="\t",
                                lineterminator="\n")
        writer.writeheader()
        writer.writerows(out_rows)
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
