"""Lossless, minimal genomic context for local recoded-RNA folding."""

from Bio.Seq import Seq


def folding_context(annotation: dict, genome: str, cds: str) -> dict:
    """Map an oriented circular genomic -30:+60 window onto CDS nucleotides.

    Ordinary genes need only 30 upstream bases. Exceptional windows retain the
    90 genomic bases and a nucleotide map (-1 means outside this gene's CDS).
    Overlapping neighbors do not change the mapping: only this CDS is recoded.
    """
    size = len(genome)
    segments = annotation.get("cdsSegments") or [
        [annotation["start"], annotation["end"]]
    ]
    positions = [position - 1 for lo, hi in segments for position in range(lo, hi + 1)]
    minus = annotation["strand"] == "-"
    if minus:
        positions.reverse()
    genomic_cds = "".join(genome[position % size] for position in positions)
    if minus:
        genomic_cds = str(Seq(genomic_cds).complement())
    if genomic_cds != cds:
        raise ValueError(f"CDS coordinates do not reproduce {annotation.get('id', 'gene')}")
    offset_by_position = {position % size: offset for offset, position in enumerate(positions)}
    if len(offset_by_position) != len(positions):
        raise ValueError("Repeated CDS genomic positions cannot be independently recoded")
    anchor = annotation["end"] - 1 if minus else annotation["start"] - 1
    window_positions = [(anchor + (-offset if minus else offset)) % size
                        for offset in range(-30, 60)]
    window = "".join(genome[position] for position in window_positions)
    if minus:
        window = str(Seq(window).complement())
    offsets = [offset_by_position.get(position, -1) for position in window_positions]
    if offsets == [-1] * 30 + list(range(60)) and window[30:] == cds[:60]:
        return {"upstream": window[:30]}
    return {"sequence": window, "cdsOffsets": offsets}


def restore_start_window(context: dict, cds: str) -> str:
    """Restore the wild-type or recoded genomic window from contracted context."""
    if "upstream" in context:
        return context["upstream"] + cds[:60]
    return "".join(cds[offset] if offset >= 0 else base
                   for base, offset in zip(context["sequence"], context["cdsOffsets"], strict=True))
