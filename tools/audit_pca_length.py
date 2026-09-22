#!/usr/bin/env python3
"""Reproduce the native codon PCA length-sensitivity audit."""

from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

import numpy as np
from scipy.stats import pearsonr, spearmanr
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts import feature_metrics as fm  # noqa: E402


def rscu_for_codons(codons: list[str]) -> np.ndarray:
    """Apply the pipeline's absent-family convention to translated sense codons."""
    counts = collections.Counter(codons)
    values = {}
    for family in fm.SYNONYMS.values():
        total = sum(counts[codon] for codon in family)
        for codon in family:
            values[codon] = counts[codon] * len(family) / total if total else 0.0
    return np.asarray([values[codon] for codon in fm.RSCU_ORDER], dtype=float)


def translated_packed_codons(packed: str) -> list[str]:
    """Decode a site's sense codons with the pipeline's initiator convention."""
    codons = [fm.SYMBOL_TO_CODON[symbol] for symbol in packed]
    if codons:
        codons[0] = "ATG"
    return codons


def correlation(values: np.ndarray, scores: np.ndarray) -> dict[str, float]:
    """Report linear and rank association with one fixed PCA component."""
    return {
        "pearson": float(pearsonr(values, scores).statistic),
        "spearman": float(spearmanr(values, scores).statistic),
    }


def audit(data_dir: Path, seed: int = 2973, replicates: int = 20) -> dict[str, object]:
    """Compare published axes, length strata, refits, and a paired sampling null."""
    with (data_dir / "genes.json").open(encoding="utf-8") as handle:
        genes = json.load(handle)
    with (data_dir / "meta.json").open(encoding="utf-8") as handle:
        meta = json.load(handle)
    with (data_dir / "codon_pca.json").open(encoding="utf-8") as handle:
        published = json.load(handle)
    if meta["rscuOrder"] != list(fm.RSCU_ORDER):
        raise ValueError("site RSCU order differs from the pipeline convention")
    x = np.asarray([gene["rscu"] for gene in genes], dtype=float)
    length = np.asarray([gene["lengthNt"] for gene in genes], dtype=float)
    scores = np.asarray([gene["codonPca"][:2] for gene in genes], dtype=float)
    if x.shape != (len(genes), 59) or not np.isfinite(x).all():
        raise ValueError("all genes must have 59 finite RSCU values")
    zero = (x == 0).sum(axis=1)
    family_indices = [
        [fm.RSCU_ORDER.index(codon) for codon in family if codon in fm.RSCU_ORDER]
        for family in fm.SYNONYMS.values()
    ]
    family_indices = [indices for indices in family_indices if indices]
    absent = np.asarray([
        sum(np.all(row[indices] == 0) for indices in family_indices)
        for row in x
    ])

    scaler = StandardScaler().fit(x)
    fitted = PCA(n_components=6, random_state=seed).fit(scaler.transform(x))
    loading = np.asarray([row["pc"] for row in published["loadings"]]).T
    signs = np.where(np.sum(fitted.components_[:2] * loading[:2], axis=1) >= 0, 1, -1)
    recomputed = fitted.transform(scaler.transform(x))[:, :2] * signs
    max_score_difference = float(np.max(np.abs(recomputed - scores)))
    if max_score_difference > 1e-4:
        raise ValueError("refit scores do not reproduce the published coordinates")

    strata = {}
    for label, mask in (
        ("atMost300Nt", length <= 300),
        ("301To900Nt", (length > 300) & (length <= 900)),
        ("over900Nt", length > 900),
    ):
        strata[label] = {
            "count": int(mask.sum()),
            "medianLengthNt": float(np.median(length[mask])),
            "medianZeroRscu": float(np.median(zero[mask])),
            "meanAbsentFamilies": float(np.mean(absent[mask])),
            "meanPc2": float(np.mean(scores[mask, 1])),
            "sdPc2": float(np.std(scores[mask, 1])),
        }

    refits = {}
    for cutoff in (300, 600, 900):
        mask = length > cutoff
        result = PCA(n_components=6, random_state=seed).fit(
            StandardScaler().fit_transform(x[mask])
        )
        refits[str(cutoff)] = {
            "count": int(mask.sum()),
            "explainedPc1Pc2": result.explained_variance_ratio_[:2].tolist(),
            "loadingCosinePc1Pc2": [
                float(abs(np.dot(result.components_[i], loading[i]))) for i in range(2)
            ],
        }

    # Long genes provide their own matched codon-use control. Draw 75 sense
    # codons without replacement to match the short stratum's median 225 nt.
    # Project each simulated sequence onto the published full-data axes; never
    # refit on simulations. Variation within a long gene then isolates the
    # sparsity effect from between-gene biological and annotation differences.
    rng = np.random.default_rng(seed)
    long_indices = np.flatnonzero(length > 900)
    mean_pc2_shift = np.empty(len(long_indices), dtype=float)
    mean_zero_increase = np.empty(len(long_indices), dtype=float)
    for position, index in enumerate(long_indices):
        codons = translated_packed_codons(genes[index]["codons"])
        if len(codons) < 75:
            raise ValueError(f"long gene {genes[index]['id']} has fewer than 75 codons")
        pc2_shifts = []
        zero_increases = []
        for _ in range(replicates):
            sampled = [codons[j] for j in rng.choice(len(codons), size=75, replace=False)]
            vector = rscu_for_codons(sampled)
            projected = ((vector - scaler.mean_) / scaler.scale_) @ fitted.components_[:2].T
            pc2_shifts.append(projected[1] * signs[1] - scores[index, 1])
            zero_increases.append(int(np.count_nonzero(vector == 0)) - int(zero[index]))
        mean_pc2_shift[position] = np.mean(pc2_shifts)
        mean_zero_increase[position] = np.mean(zero_increases)
    # Resample genes, not repeated draws, so the interval respects pairing.
    mean_shift_bootstrap = np.asarray([
        np.mean(rng.choice(mean_pc2_shift, size=len(mean_pc2_shift), replace=True))
        for _ in range(1000)
    ])
    return {
        "dataset": str(data_dir),
        "genes": len(genes),
        "seed": seed,
        "replicatesPerLongGene": replicates,
        "publishedExplainedPc1Pc2": published["explainedVariance"][:2],
        "maxPublishedScoreDifference": max_score_difference,
        "associations": {
            name: {
                "pc1": correlation(values, scores[:, 0]),
                "pc2": correlation(values, scores[:, 1]),
            }
            for name, values in (
                ("lengthNt", length), ("zeroRscuCount", zero),
                ("absentFamilyCount", absent),
            )
        },
        "strata": strata,
        "refitsAboveLengthNt": refits,
        "withinGeneSampling75Codons": {
            "longGenes": len(long_indices),
            "meanPc2Shift": float(np.mean(mean_pc2_shift)),
            "geneBootstrap95PercentCi": np.quantile(
                mean_shift_bootstrap, [0.025, 0.975]
            ).tolist(),
            "meanZeroRscuIncrease": float(np.mean(mean_zero_increase)),
            "simulatedLongGeneMeanPc2": float(
                np.mean(scores[long_indices, 1] + mean_pc2_shift)
            ),
            "observedShortGeneMeanPc2": strata["atMost300Nt"]["meanPc2"],
        },
    }


def main() -> None:
    """Print the deterministic audit as JSON."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=ROOT / "site/data")
    parser.add_argument("--seed", type=int, default=2973)
    parser.add_argument("--replicates", type=int, default=20)
    args = parser.parse_args()
    if args.replicates < 1:
        parser.error("--replicates must be positive")
    print(json.dumps(audit(args.data_dir, args.seed, args.replicates), indent=2))


if __name__ == "__main__":
    main()
