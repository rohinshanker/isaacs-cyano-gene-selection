"""Pure metric functions for the UTEX 2973 feature pipeline.

The functions in this module are intentionally independent of file parsing so their
numerical conventions can be tested on small, hand-computed examples.
"""

from __future__ import annotations

import collections
import math
from typing import Iterable, Mapping, Sequence

from Bio.Data import CodonTable


BASES = "TCAG"
CODONS = tuple(a + b + c for a in BASES for b in BASES for c in BASES)
SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
CODON_TO_SYMBOL = dict(zip(CODONS, SYMBOLS, strict=True))
SYMBOL_TO_CODON = dict(zip(SYMBOLS, CODONS, strict=True))
TABLE = CodonTable.unambiguous_dna_by_id[11]
AA_BY_CODON = {**TABLE.forward_table, **{c: "*" for c in TABLE.stop_codons}}
SENSE_CODONS = tuple(c for c in CODONS if c not in TABLE.stop_codons)
RSCU_ORDER = tuple(c for c in SENSE_CODONS if AA_BY_CODON[c] not in {"M", "W"})
SYNONYMS = {
    aa: tuple(c for c in SENSE_CODONS if AA_BY_CODON[c] == aa)
    for aa in sorted(set(TABLE.forward_table.values()))
}


def split_codons(sequence: str, remove_stop: bool = True) -> list[str]:
    """Splits an uppercase DNA sequence into codons."""
    codons = [sequence[i : i + 3] for i in range(0, len(sequence), 3)]
    if remove_stop and codons and codons[-1] in TABLE.stop_codons:
        codons.pop()
    return codons


def composition(sequence: str) -> dict[str, float | int]:
    """Returns length and whole-sequence/codon-position composition."""
    codons = split_codons(sequence)
    coding = "".join(codons)

    def fraction(chars: Iterable[str], accepted: set[str]) -> float:
        values = list(chars)
        return sum(char in accepted for char in values) / len(values) if values else 0.0

    thirds = [codon[2] for codon in codons]
    return {
        # Contract length includes the terminal stop; lengthCodons does not.
        "lengthNt": len(sequence),
        "lengthCodons": len(codons),
        "gc": fraction(coding, {"G", "C"}),
        "gc1": fraction((c[0] for c in codons), {"G", "C"}),
        "gc2": fraction((c[1] for c in codons), {"G", "C"}),
        "gc3": fraction(thirds, {"G", "C"}),
        "a3": fraction(thirds, {"A"}),
        "t3": fraction(thirds, {"T"}),
        "g3": fraction(thirds, {"G"}),
        "c3": fraction(thirds, {"C"}),
    }


def rscu(sequence: str) -> list[float]:
    """Returns 59 RSCU values; absent amino-acid families are all zero."""
    counts = collections.Counter(split_codons(sequence))
    values = {}
    for family in SYNONYMS.values():
        total = sum(counts[codon] for codon in family)
        for codon in family:
            values[codon] = counts[codon] * len(family) / total if total else 0.0
    return [values[codon] for codon in RSCU_ORDER]


def _family_homozygosity(counts: Mapping[str, int], family: Sequence[str]) -> float | None:
    """Returns Wright's unbiased F statistic for a synonymous family."""
    n = sum(counts.get(codon, 0) for codon in family)
    if not n:
        return None
    if n == 1:
        return 1.0
    sum_squared = sum((counts.get(codon, 0) / n) ** 2 for codon in family)
    return max((n * sum_squared - 1.0) / (n - 1.0), 1.0 / len(family))


def effective_number_of_codons(sequence: str) -> float:
    """Computes Wright's ENC, omitting absent amino acids within each class.

    A degeneracy class with no represented amino acid contributes its neutral
    maximum (F=1/k). This avoids NaN while preserving the 20..61 ENC range.
    """
    counts = collections.Counter(split_codons(sequence))
    class_sizes = {2: 9, 3: 1, 4: 5, 6: 3}
    result = 2.0  # Met and Trp.
    for degeneracy, number_of_families in class_sizes.items():
        estimates = [
            _family_homozygosity(counts, family)
            for family in SYNONYMS.values()
            if len(family) == degeneracy
        ]
        represented = [value for value in estimates if value is not None]
        mean_f = sum(represented) / len(represented) if represented else 1.0 / degeneracy
        result += number_of_families / mean_f
    return min(61.0, max(20.0, result))


def expected_enc(gc3: float) -> float:
    """Returns the standard Wright neutral-curve ENC at the supplied GC3."""
    denominator = gc3**2 + (1.0 - gc3) ** 2
    return 2.0 + gc3 + 29.0 / denominator


def cai_weights(reference_sequences: Iterable[str]) -> dict[str, float]:
    """Builds Sharp-Li relative adaptiveness weights with a 0.5 pseudocount."""
    counts = collections.Counter(
        codon for sequence in reference_sequences for codon in split_codons(sequence)
    )
    weights = {}
    for family in SYNONYMS.values():
        adjusted = {codon: counts[codon] if counts[codon] else 0.5 for codon in family}
        maximum = max(adjusted.values())
        weights.update({codon: value / maximum for codon, value in adjusted.items()})
    return weights


def codon_adaptation_index(sequence: str, weights: Mapping[str, float]) -> float:
    """Returns CAI, excluding the non-degenerate Met and Trp codons."""
    codons = [c for c in split_codons(sequence) if AA_BY_CODON[c] not in {"M", "W"}]
    if not codons:
        return 1.0
    return math.exp(sum(math.log(weights[codon]) for codon in codons) / len(codons))


def trna_adaptiveness(
    codon: str,
    anticodon_counts: Mapping[str, int],
    s_values: Mapping[str, float],
) -> float:
    """Returns absolute dos-Reis adaptiveness for one codon.

    Anticodons are stored 5' to 3'. Exact Watson-Crick pairing and the bacterial
    G:U/U:G wobble pairs are included. ``s_values`` are selective constraints,
    so a pairing contributes ``copies * (1 - s)``.
    """
    complements = {"A": "T", "T": "A", "C": "G", "G": "C"}
    total = 0.0
    for anticodon, copies in anticodon_counts.items():
        if len(anticodon) != 3:
            continue
        if complements[anticodon[2]] != codon[0] or complements[anticodon[1]] != codon[1]:
            continue
        if anticodon[0] in complements and complements[anticodon[0]] == codon[2]:
            total += copies
        else:
            key = f"{anticodon[0]}:{codon[2]}"
            if key in s_values:
                total += copies * (1.0 - s_values[key])
    return total


def tai_weights(
    anticodon_counts: Mapping[str, int], s_values: Mapping[str, float]
) -> dict[str, float]:
    """Builds relative tAI weights, using 0.01 for unavailable isoacceptors."""
    absolute = {
        codon: trna_adaptiveness(codon, anticodon_counts, s_values)
        for codon in SENSE_CODONS
    }
    maximum = max(absolute.values(), default=1.0) or 1.0
    return {codon: max(value / maximum, 0.01) for codon, value in absolute.items()}


def trna_adaptation_index(sequence: str, weights: Mapping[str, float]) -> float:
    """Returns the geometric mean relative tRNA adaptiveness."""
    codons = split_codons(sequence)
    if not codons:
        return 1.0
    return math.exp(sum(math.log(weights[codon]) for codon in codons) / len(codons))


def rare_codon_metrics(
    sequence: str,
    frequencies: Mapping[str, float],
    tai: Mapping[str, float],
    threshold: float = 0.1,
    local_window: int = 9,
) -> dict[str, float | int]:
    """Returns target-independent rare-codon and local-tAI features."""
    codons = split_codons(sequence)
    rare = [frequencies.get(codon, 0.0) < threshold for codon in codons]
    longest = current = 0
    for value in rare:
        current = current + 1 if value else 0
        longest = max(longest, current)
    local = []
    if codons:
        width = min(local_window, len(codons))
        for start in range(len(codons) - width + 1):
            local.append(sum(tai[c] for c in codons[start : start + width]) / width)
    count = sum(rare)
    return {
        "rareFraction": count / len(codons) if codons else 0.0,
        "rareCount": count,
        "longestRareRun": longest,
        "rampRareCount": sum(rare[:50]),
        "minLocalTai": min(local) if local else 0.0,
    }


def local_gc(sequence: str, window: int = 30) -> dict[str, float]:
    """Returns min/max sliding-window GC and GC in the first window."""
    sequence = sequence.upper()
    if not sequence:
        return {"minLocalGc": 0.0, "maxLocalGc": 0.0, "gc5prime": 0.0}
    width = min(window, len(sequence))
    values = [
        sum(base in "GC" for base in sequence[start : start + width]) / width
        for start in range(len(sequence) - width + 1)
    ]
    return {"minLocalGc": min(values), "maxLocalGc": max(values), "gc5prime": values[0]}


def pack_codons(sequence: str) -> str:
    """Packs the stop-trimmed sequence using the contract's TCAG alphabet."""
    return "".join(CODON_TO_SYMBOL[codon] for codon in split_codons(sequence))


def unpack_codons(packed: str) -> str:
    """Decodes a packed codon string (without adding a stop codon)."""
    return "".join(SYMBOL_TO_CODON[symbol] for symbol in packed)
