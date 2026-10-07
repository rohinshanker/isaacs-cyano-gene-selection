#!/usr/bin/env python3
"""Loads and validates the repository's organism build configurations."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config/organisms.json"
REQUIRED_FIELDS = {
    "accession",
    "assemblyPrefix",
    "ftpDirectory",
    "expectedTotalLength",
    "organismIdentity",
    "strainIdentity",
    "taxid",
    "umapSeed",
    "caiReferenceRule",
    "caiReferenceMethod",
    "caiReferenceDescription",
    "expressionDirectory",
    # May be null: an organism whose expression is entirely optional joined
    # layers has no single abundance field, so it names no primary metric.
    "primaryExpressionMetric",
    "trnaSpecialCases",
    "optionalLayers",
    "rawDirectory",
    "outputDirectory",
    "geneCountRange",
    "expectedGeneCount",
    "expectedCdsRecords",
    "expectedTerminalStops",
    "expectedSpliced",
    "expectedExceptions",
}
KNOWN_OPTIONAL_LAYERS = {"annotation", "expression", "tss"}
KNOWN_TRNA_SPECIAL_CASES = {
    "excludedFromDecodingPool",
    "inosineAtWobble",
    "lysidine",
    "verifiedSpeciesTable",
}
LYSIDINE_FIELDS = {"aminoAcid", "genomicAnticodon", "effectiveAnticodon"}


@dataclass(frozen=True)
class OrganismConfig:
    """One fully validated organism build configuration."""

    organism_id: str
    values: Mapping[str, Any]

    def __getattr__(self, name: str) -> Any:
        if name == "values":
            raise AttributeError(name)
        try:
            return self.values[name]
        except KeyError as error:
            raise AttributeError(name) from error

    def path(self, field: str) -> Path:
        """Returns a repository-relative configured path as an absolute path."""
        return ROOT / self.values[field]

    def has_layer(self, layer: str) -> bool:
        """Returns whether the organism publishes an optional evidence layer."""
        return layer in self.optionalLayers


def _load_document(path: Path = CONFIG_PATH) -> dict[str, Any]:
    """Loads the canonical JSON configuration document."""
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Cannot load organism configuration {path}: {error}") from error
    if not isinstance(document, dict) or not isinstance(document.get("organisms"), dict):
        raise ValueError(f"Organism configuration {path} must contain an organisms object")
    return document


def _validate(organism_id: str, values: Any) -> OrganismConfig:
    """Validates one declarative record and returns its immutable wrapper."""
    if not isinstance(values, dict):
        raise ValueError(f"Organism configuration {organism_id!r} must be an object")
    missing = sorted(REQUIRED_FIELDS - values.keys())
    if missing:
        raise ValueError(
            f"Organism configuration {organism_id!r} is missing: {', '.join(missing)}"
        )
    if not isinstance(values["geneCountRange"], list) or len(values["geneCountRange"]) != 2:
        raise ValueError(f"Organism configuration {organism_id!r} has invalid geneCountRange")
    special_cases = values["trnaSpecialCases"]
    if not isinstance(special_cases, dict):
        raise ValueError(
            f"Organism configuration {organism_id!r} has invalid trnaSpecialCases"
        )
    unknown_special_cases = sorted(set(special_cases) - KNOWN_TRNA_SPECIAL_CASES)
    if unknown_special_cases:
        raise ValueError(
            f"Organism configuration {organism_id!r} has unknown trnaSpecialCases: "
            f"{', '.join(unknown_special_cases)}"
        )
    excluded = special_cases.get("excludedFromDecodingPool", [])
    if not isinstance(excluded, list):
        raise ValueError(
            f"Organism configuration {organism_id!r} has invalid "
            "trnaSpecialCases.excludedFromDecodingPool"
        )
    if not all(isinstance(amino_acid, str) for amino_acid in excluded):
        raise ValueError(
            f"Organism configuration {organism_id!r} has non-string "
            "trnaSpecialCases.excludedFromDecodingPool entry"
        )
    if not all(amino_acid for amino_acid in excluded):
        raise ValueError(
            f"Organism configuration {organism_id!r} has empty "
            "trnaSpecialCases.excludedFromDecodingPool entry"
        )
    inosine = special_cases.get("inosineAtWobble")
    if inosine is not None and not isinstance(inosine, bool):
        raise ValueError(
            f"Organism configuration {organism_id!r} has invalid "
            "trnaSpecialCases.inosineAtWobble"
        )
    lysidine = special_cases.get("lysidine")
    if lysidine is not None:
        if not isinstance(lysidine, dict):
            raise ValueError(
                f"Organism configuration {organism_id!r} has invalid "
                "trnaSpecialCases.lysidine"
            )
        missing_lysidine = sorted(LYSIDINE_FIELDS - lysidine.keys())
        unknown_lysidine = sorted(set(lysidine) - LYSIDINE_FIELDS)
        if missing_lysidine or unknown_lysidine:
            details = []
            if missing_lysidine:
                details.append(f"missing {', '.join(missing_lysidine)}")
            if unknown_lysidine:
                details.append(f"unknown {', '.join(unknown_lysidine)}")
            raise ValueError(
                f"Organism configuration {organism_id!r} has invalid "
                f"trnaSpecialCases.lysidine fields: {'; '.join(details)}"
            )
        if not all(isinstance(value, str) and value for value in lysidine.values()):
            raise ValueError(
                f"Organism configuration {organism_id!r} has invalid "
                "trnaSpecialCases.lysidine value"
            )
    verified_table = special_cases.get("verifiedSpeciesTable")
    if verified_table is not None and not (
        isinstance(verified_table, str) and verified_table
    ):
        raise ValueError(
            f"Organism configuration {organism_id!r} has invalid "
            "trnaSpecialCases.verifiedSpeciesTable"
        )
    layers = values["optionalLayers"]
    if not isinstance(layers, list) or set(layers) - KNOWN_OPTIONAL_LAYERS:
        raise ValueError(f"Organism configuration {organism_id!r} has invalid optionalLayers")
    known_cai_rules = {
        "ribosomal-and-housekeeping-product-match-v1",
        "ecoli-translation-machinery-product-match-v1",
    }
    if values["caiReferenceRule"] not in known_cai_rules:
        raise ValueError(
            f"Organism configuration {organism_id!r} has an unknown CAI reference rule"
        )
    return OrganismConfig(organism_id, values)


def get_organism(organism_id: str | None = None) -> OrganismConfig:
    """Returns a configured organism, defaulting to the established UTEX release."""
    document = _load_document()
    selected = organism_id or document.get("defaultOrganism")
    if selected not in document["organisms"]:
        choices = ", ".join(sorted(document["organisms"]))
        raise ValueError(f"Unknown organism id {selected!r}; choose one of: {choices}")
    return _validate(selected, document["organisms"][selected])


def main(argv: list[str] | None = None) -> int:
    """Prints tab-separated values consumed by the portable Bash fetcher."""
    parser = argparse.ArgumentParser()
    parser.add_argument("organism", nargs="?")
    args = parser.parse_args(argv)
    try:
        config = get_organism(args.organism)
    except ValueError as error:
        parser.error(str(error))
    fields = (
        config.organism_id,
        config.assemblyPrefix,
        config.ftpDirectory,
        config.organismIdentity,
        config.strainIdentity,
        str(config.taxid),
        str(config.path("rawDirectory")),
    )
    print("\t".join(fields))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
