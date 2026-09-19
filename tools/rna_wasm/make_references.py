"""Generate independently mutated genomic-window references with Python ViennaRNA."""
import json
import random
import sys
from pathlib import Path

import RNA
from Bio.Seq import Seq

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from feature_metrics import pack_codons
from rna_context import folding_context

SCHEMES = [{}, {"TCG": "AGC", "TCA": "AGT", "TAG": "TAA"}, {"GTG": "GTC", "TTG": "CTG", "TAG": "TGA"}]


def generate():
    assert RNA.__version__ == "2.7.2"
    cases = []
    for strand in ["+", "-"]:
        for kind in ["ordinary", "boundary", "short-overlap", "joined"]:
            dna = "GTG" + "TCGTCAGTGTTGGCG" * (1 if kind == "short-overlap" else 6) + "TAG"
            start = (270 if strand == "+" else 200) if kind == "boundary" else 51
            positions = list(range(start - 1, start - 1 + len(dna)))
            segments = None
            if kind == "joined":
                positions = positions[:12] + [value + 2 for value in positions[12:]]
                segments = [[start, start + 11], [start + 14, positions[-1] + 1]]
            end = positions[-1] + 1
            if strand == "-":
                positions.reverse()
            rng = random.Random(2973)
            genome = [rng.choice("ACGT") for _ in range(300)]
            for position, base in zip(positions, dna, strict=True):
                genome[position % 300] = str(Seq(base).complement()) if strand == "-" else base
            genome = "".join(genome)
            annotation = {"id": f"{strand}-{kind}", "start": start, "end": end, "strand": strand, "cdsSegments": segments}
            gene = {**annotation, "codons": pack_codons(dna), "terminalStop": dna[-3:],
                    "rnaContext": folding_context(annotation, genome, dna)}
            for scheme in SCHEMES:
                codons = [dna[i:i + 3] for i in range(0, len(dna), 3)]
                recoded = "".join(codon if i == 0 else scheme.get(codon, codon) for i, codon in enumerate(codons))
                # Independent oracle: edit the complete synthetic genome in place,
                # then extract the oriented window, without the context decoder.
                edited_genome = list(genome)
                for position, base in zip(positions, recoded, strict=True):
                    edited_genome[position % 300] = str(Seq(base).complement()) if strand == "-" else base
                origin = start - 1 if strand == "+" else end - 1
                windows = []
                for source in [genome, "".join(edited_genome)]:
                    window = "".join(source[(origin + (offset if strand == "+" else -offset)) % 300] for offset in range(-30, 60))
                    windows.append(str(Seq(window).complement()) if strand == "-" else window)
                values = {"start": dict(zip(["wild", "recoded"], windows)),
                          "first100": {"wild": dna[:100], "recoded": recoded[:100]}}
                for value in values.values():
                    for key in ["wild", "recoded"]:
                        value[key] = value[key].replace("T", "U")
                        value[key + "Mfe"] = RNA.fold(value[key])[1]
                cases.append({"gene": gene, "map": scheme, "windows": values})
    return {"engine": "ViennaRNA 2.7.2", "toleranceKcalMol": 0.00001, "cases": cases}


if __name__ == "__main__":
    output = ROOT / "tests/fixtures/rna-folding.json"
    output.write_text(json.dumps(generate(), indent=2) + "\n")
