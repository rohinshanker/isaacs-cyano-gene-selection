#!/usr/bin/env python3
"""Build the ingest spec for the Fitness Browser's PCC 7942 RB-TnSeq compendium.

Source: the Fitness Browser (https://fit.genomics.lbl.gov/), Price et al.,
*Nature* 2018;557:503, organism `SynE` = *Synechococcus elongatus* PCC 7942.

The site answers an automated client with a bot check, so the owner saved the
organism's tables by hand into a private folder and an agent stages them into
`data/interim/expression/`, which is gitignored. The bytes are pinned by SHA-256
below, so the spec is reproducible from the same download even though the
retrieval was manual.

The compendium holds 129 experiments. A layer here is one **condition set**:
one distinct combination of the experiment table's `condition_1`,
`concentration_1` and `units_1`. Seventeen of those were run more than once, and
the plain-medium controls were run eighteen times; a repeated set becomes the
arithmetic mean of its experiments, which the ingest tool computes from the
columns listed here, and the layer says so in its own `samples` text. That is the
owner's decision of 2026-10-07, taken over one layer per experiment.

Every condition value is read from the experiment table and quoted from it. The
table records medium, temperature, vessel, aeration, shaking and the stressor,
and records **no** irradiance, light regime, CO2 or growth phase, so those axes
ship as `not reported` rather than being filled in from elsewhere.

Usage::

    tools/build_fitness_browser_spec.py            # write the spec
    tools/build_fitness_browser_spec.py --check    # fail if the spec is stale
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

INTERIM = Path("data/interim/expression")
FITNESS_TABLE = INTERIM / "fit_organism_SynE.tsv"
EXPERIMENT_TABLE = INTERIM / "exp_organism_SynE.txt"
SPEC_PATH = Path("data/expression/ingest/FITNESS_BROWSER_SynE.json")

#: Pinned bytes of the owner's 2026-10-07 download. A mismatch is a hard stop:
#: the compendium grows over time and a later download is a different dataset.
FITNESS_SHA256 = "4c822bd525a7d45a4f592b45bcc00ba55a5f5440b44eef57afebb511918760bf"
EXPERIMENT_SHA256 = "00ea2bdee7d7b5679120e58a7f718d4cb08621ed99e1b832ede061167343fda7"

ORGANISM_PAGE = "https://fit.genomics.lbl.gov/cgi-bin/org.cgi?orgId=SynE"
WHERE = "Fitness Browser experiment table exp_organism_SynE.txt, retrieved 2026-10-07"

#: The source's own experiment groups, mapped onto the condition-record
#: vocabulary in scripts/condition_record.py. `bg11` is the plain growth medium,
#: so it is the standard condition; varying the nitrogen source is neither a
#: stress nor an elevated condition, so it takes `other`.
GROUP_BY_EXP_GROUP = {
    "stress": "stress",
    "bg11": "standard",
    "nitrogen source": "other",
}

LAYER_ID_PREFIX = "FitnessBrowser_SynE"
METRIC_PREFIX = "fitSynE"


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle, delimiter="\t"))


def slug(text: str) -> str:
    """A compact token safe for a file name and for a metric key."""
    cleaned = re.sub(r"[^0-9A-Za-z]+", " ", text).strip()
    return re.sub(r"\s+", "_", cleaned)


def camel(text: str) -> str:
    """CamelCase for a metric key, which must match [A-Za-z][A-Za-z0-9]*."""
    parts = re.sub(r"[^0-9A-Za-z]+", " ", text).split()
    return "".join(part[:1].upper() + part[1:] for part in parts)


def condition_key(row: dict[str, str]) -> tuple[str, str, str]:
    return (row["condition_1"].strip(), row["concentration_1"].strip(),
            row["units_1"].strip())


def describe(key: tuple[str, str, str]) -> str:
    """Reader-facing name of one condition set."""
    condition, concentration, units = key
    if not condition:
        return "BG-11 with no added compound"
    if concentration and units:
        return f"{condition} at {concentration} {units}"
    if concentration:
        return f"{condition} at {concentration}"
    return condition


def unique(base: str, taken: set[str]) -> str:
    """Return `base`, or `base` with the smallest suffix that is free."""
    if base not in taken:
        taken.add(base)
        return base
    for suffix in range(2, 1000):
        candidate = f"{base}{suffix}"
        if candidate not in taken:
            taken.add(candidate)
            return candidate
    raise ValueError(f"cannot make {base} unique")


def medium_axis(media: str) -> dict[str, Any]:
    """The medium axis, which the experiment table always states."""
    nitrogen_altered = media.endswith("_noNitrogen")
    text = "BG-11 without nitrogen" if nitrogen_altered else "BG-11"
    return {
        "status": "reported",
        "base": "BG-11",
        "modified": nitrogen_altered,
        "conditioned": False,
        "nitrogenAltered": nitrogen_altered,
        "text": text,
        "quote": media,
        "where": WHERE,
    }


def conditions_for(rows: list[dict[str, str]]) -> dict[str, Any]:
    """The seven condition axes for one condition set.

    Every value comes from the experiment table. An axis the table does not
    record is `not reported`, never inferred: the Fitness Browser's table has no
    irradiance, light regime, CO2 or growth-phase column at all.
    """
    temperatures = sorted({row["temperature"].strip() for row in rows})
    vessels = sorted({row["vessel"].strip() for row in rows})
    aerobic = sorted({row["aerobic"].strip() for row in rows})
    shaking = sorted({row["shaking"].strip() for row in rows})
    media = sorted({row["media"].strip() for row in rows})
    if len(media) != 1:
        raise ValueError(f"one condition set spans several media: {media}")

    if len(temperatures) == 1 and temperatures[0]:
        temperature = {
            "status": "reported",
            "lo": float(temperatures[0]),
            "hi": float(temperatures[0]),
            "unit": "°C",
            "text": f"{temperatures[0]} °C",
            "quote": temperatures[0],
            "where": WHERE,
        }
    else:
        temperature = {
            "status": "conflicting" if len(temperatures) > 1 else "not reported",
            "lo": None, "hi": None, "unit": "°C",
            "text": "the experiment table gives "
                    + ("several temperatures for this condition set"
                       if len(temperatures) > 1 else "no temperature"),
            "quote": ", ".join(temperatures),
            "where": WHERE,
        }

    vessel_text = "; ".join(v for v in vessels if v) or "not stated"
    aeration = "; ".join(a for a in aerobic if a)
    agitation = "; ".join(s for s in shaking if s)
    format_text = ", ".join(part for part in (vessel_text, aeration, agitation) if part)

    return {
        "temperature": temperature,
        "lightIntensity": {
            "status": "not reported",
            "lo": None, "hi": None,
            "unit": "µmol photons m⁻² s⁻¹",
            "text": "the experiment table records no irradiance",
            "quote": "",
            "where": "",
        },
        "lightRegime": {
            "status": "not reported",
            "kind": None,
            "photoperiod": None,
            "spectrumClass": None,
            "entrained": False,
            "text": "the experiment table records no light regime",
            "quote": "",
            "where": "",
        },
        "co2": {
            "status": "not reported",
            "lo": None, "hi": None, "unit": "%",
            "text": "the experiment table records no CO2 concentration",
            "quote": "",
            "where": "",
        },
        "medium": medium_axis(media[0]),
        "format": {
            "status": "reported",
            "value": format_text,
            "text": format_text,
            "quote": f"{vessel_text} | {aeration} | {agitation}",
            "where": WHERE,
        },
        "phase": {
            "status": "not reported",
            "label": None,
            "od": None,
            "odNm": None,
            "text": "the experiment table records no growth phase or optical density",
            "quote": "",
            "where": "",
        },
    }


def study_conditions(experiments: list[dict[str, str]]) -> dict[str, Any]:
    """The umbrella record for the whole compendium.

    Every layer carries its own exact values; this one describes the span, which
    is why it cannot be the per-set builder. The compendium runs in BG-11
    throughout except for the nitrogen-source experiments, which use BG-11
    without nitrogen, so the medium is marked altered at this level and each
    layer states which of the two it used.
    """
    conditions = conditions_for([row for row in experiments
                                 if not row["media"].strip().endswith("_noNitrogen")])
    altered = sum(1 for row in experiments
                  if row["media"].strip().endswith("_noNitrogen"))
    conditions["medium"] = {
        "status": "reported",
        "base": "BG-11",
        "modified": True,
        "conditioned": False,
        "nitrogenAltered": True,
        "text": (f"BG-11, except {altered} nitrogen-source experiments in BG-11 "
                 "without nitrogen; each layer states which it used"),
        "quote": "BG11 | BG11_noNitrogen",
        "where": WHERE,
    }
    return conditions


def build_layers(experiments: list[dict[str, str]],
                 fitness_columns: set[str]) -> list[dict[str, Any]]:
    """One layer per distinct condition set, in a stable order."""
    grouped: dict[tuple[str, str, str], list[dict[str, str]]] = defaultdict(list)
    for row in experiments:
        grouped[condition_key(row)].append(row)

    layers: list[dict[str, Any]] = []
    ids: set[str] = set()
    keys: set[str] = set()
    for key in sorted(grouped, key=lambda k: (k[0] == "", k[0], _number(k[1]), k[2])):
        rows = sorted(grouped[key], key=lambda r: r["expName"])
        groups = {row["expGroup"].strip() for row in rows}
        if len(groups) != 1:
            raise ValueError(f"condition set {key} spans experiment groups {groups}")
        group = GROUP_BY_EXP_GROUP[groups.pop()]

        columns = [f"{row['expName']} {row['expDesc']}".strip() for row in rows]
        missing = [column for column in columns if column not in fitness_columns]
        if missing:
            raise ValueError(f"fitness table has no column {missing[0]!r}")

        name = describe(key)
        base = slug(name) or "control"
        layer_id = unique(f"{LAYER_ID_PREFIX}_{base}", ids)
        metric_key = unique(f"{METRIC_PREFIX}{camel(name)}", keys)

        experiment_names = ", ".join(row["expName"] for row in rows)
        if len(rows) == 1:
            samples = f"{experiment_names}; the experiment's published value"
        else:
            samples = (f"{experiment_names}; mean of {len(rows)} experiments run at "
                       "this condition set")

        layers.append({
            "id": layer_id,
            "metricKey": metric_key,
            "label": f"Fitness {name} (PCC 7942)",
            "conditionSet": name,
            "samples": samples,
            "columns": columns,
            "treatments": [key[0]] if key[0] else [],
            "group": group,
            "conditionTableRow": None,
            "conditions": conditions_for(rows),
        })
    return layers


def _number(text: str) -> float:
    try:
        return float(text)
    except ValueError:
        return float("inf")


def build_spec() -> dict[str, Any]:
    for path, expected in ((FITNESS_TABLE, FITNESS_SHA256),
                           (EXPERIMENT_TABLE, EXPERIMENT_SHA256)):
        if not path.is_file():
            raise SystemExit(
                f"{path} is missing. Stage the owner's Fitness Browser download into "
                f"{INTERIM}/ first; see docs/validation/AAA-next-steps.md item 1."
            )
        observed = sha256_of(path)
        if observed != expected:
            raise SystemExit(
                f"{path.name}: expected SHA-256 {expected}, got {observed}. The "
                "Fitness Browser grows over time, so a different download is a "
                "different dataset and must be re-pinned deliberately."
            )

    experiments = read_rows(EXPERIMENT_TABLE)
    with FITNESS_TABLE.open(encoding="utf-8", newline="") as handle:
        header = next(csv.reader(handle, delimiter="\t"))
    fitness_columns = set(header)
    layers = build_layers(experiments, fitness_columns)

    return {
        "dataType": "fitness",
        "platform": "RB-TnSeq",
        "strain": "PCC 7942",
        "basis": "transferred",
        "organism": "Synechococcus elongatus PCC 7942",
        "assay": "RB-TnSeq gene fitness",
        "signed": True,
        "licence": (
            "The Fitness Browser states no reuse licence on its help page. Admitted "
            "with citation under the owner's decision of 2026-10-06 that every source "
            "is permitted with citation; the resource and Price et al. 2018 are both "
            "cited, as the site asks."
        ),
        "provenanceDoc": "data/expression/INGESTED_SOURCES.md",
        "studyId": "FitnessBrowser_SynE",
        "archiveUrl": ORGANISM_PAGE,
        "citationId": "price-2018-fitness-browser",
        "citation": {
            "text": (
                "Price MN, Wetmore KM, Waters RJ, et al. Mutant phenotypes for "
                "thousands of bacterial genes of unknown function. Nature "
                "2018;557:503-509. Data from the Fitness Browser "
                "(https://fit.genomics.lbl.gov/), organism SynE."
            ),
            "url": "https://doi.org/10.1038/s41586-018-0124-0",
            "pmid": "29769716",
        },
        "file": {
            "name": "fit_organism_SynE.tsv",
            "url": ORGANISM_PAGE,
            "sha256": FITNESS_SHA256,
        },
        "reader": {
            "format": "tsv",
            "idColumn": "locusId",
            "idKind": "pcc7942_old",
            "idPattern": "^Synpcc7942_\\d+$",
        },
        "units": (
            "gene fitness (log2 ratio of barcode abundance at the end of the "
            "experiment to the Time0 sample, Wetmore et al. 2015), as published by "
            "the Fitness Browser"
        ),
        "normalization": "as-deposited",
        "conditionTableRow": None,
        "replicates": {
            "count": None,
            "text": (
                "one RB-TnSeq mutant library, SynE_ML6, across four experiment sets; "
                "the experiment table does not state whether experiments repeated at "
                "one condition set are biological or technical replicates"
            ),
            "where": WHERE,
        },
        "conditions": study_conditions(experiments),
        "caveat": (
            "Measured in a PCC 7942 RB-TnSeq library, not in UTEX 2973, as a signed "
            "gene fitness relative to the library at Time 0; a fitness value is never "
            "placed on an expression scale. The Fitness Browser's T-values and "
            "cofitness are not carried, and the experiment table records no "
            "irradiance, light regime, CO2 or growth phase."
        ),
        "layers": layers,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=SPEC_PATH)
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail when the written spec differs from a fresh build",
    )
    args = parser.parse_args(argv)

    spec = build_spec()
    text = json.dumps(spec, indent=2, ensure_ascii=False) + "\n"
    if args.check:
        if not args.out.is_file():
            print(f"FAIL {args.out} does not exist", file=sys.stderr)
            return 1
        if args.out.read_text(encoding="utf-8") != text:
            print(f"FAIL {args.out} is stale; rerun without --check", file=sys.stderr)
            return 1
        print(f"ok: {args.out} matches a fresh build ({len(spec['layers'])} layers)")
        return 0
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(text, encoding="utf-8")
    print(f"wrote {args.out} with {len(spec['layers'])} layers")
    return 0


if __name__ == "__main__":
    sys.exit(main())
