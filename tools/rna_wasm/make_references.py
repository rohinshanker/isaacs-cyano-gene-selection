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
        for kind in ["ordinary", "boundary", "short", "joined", "overlap"]:
            dna = "GTG" + "TCGTCAGTGTTGGCG" * (1 if kind == "short" else 6) + "TAG"
            if kind == "overlap":
                dna = "GTGCTAGCT" + "TCGTCAGTGTTGGCG" * 5 + "TAG"
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
            neighbor_positions = []
            if kind == "overlap":
                # A real second CDS: 23 upstream bases followed by seven shared
                # bases. Its TAG stop overlaps the selected gene's CTA/GCT pair.
                direction = 1 if strand == "+" else -1
                neighbor_positions = [positions[0] + direction * offset for offset in range(-23, 7)]
                neighbor_dna = "ATG" + "TCG" * 6 + "GC" + dna[:7]
                assert neighbor_dna.endswith("TAG") and "*" not in str(Seq(neighbor_dna[:-3]).translate())
                for position, base in zip(neighbor_positions[:23], neighbor_dna[:23], strict=True):
                    genome[position % 300] = str(Seq(base).complement()) if strand == "-" else base
            genome = "".join(genome)
            annotation = {"id": f"{strand}-{kind}", "start": start, "end": end, "strand": strand, "cdsSegments": segments}
            gene = {**annotation, "codons": pack_codons(dna), "terminalStop": dna[-3:],
                    "rnaContext": folding_context(annotation, genome, dna)}
            schemes = SCHEMES + ([{"CTA": "CTG", "TCG": "AGC", "TAG": "TAA"}] if kind == "overlap" else [])
            for scheme in schemes:
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
                case = {"gene": gene, "map": scheme, "windows": values}
                if neighbor_positions:
                    neighbor_recoded = "".join(edited_genome[position % 300] for position in neighbor_positions)
                    if strand == "-":
                        neighbor_recoded = str(Seq(neighbor_recoded).complement())
                    case["neighbor"] = {
                        "id": f"{strand}-upstream-neighbor", "strand": strand,
                        "start": min(neighbor_positions) + 1, "end": max(neighbor_positions) + 1,
                        "sequence": neighbor_dna, "afterSelectedGeneRecoding": neighbor_recoded,
                        "sharedNt": 7,
                    }
                cases.append(case)
    return {"engine": "ViennaRNA 2.7.2", "toleranceKcalMol": 0.00001, "cases": cases}


if __name__ == "__main__":
    output = ROOT / "tests/fixtures/rna-folding.json"
    output.write_text(json.dumps(generate(), indent=2) + "\n")
