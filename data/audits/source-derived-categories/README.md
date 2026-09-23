# Source-derived function-category TypeSafe audit bundle

This bundle is the pinned evidence behind `site/data/source-derived-categories-v1.json`.
It is documented in
[`docs/validation/source-derived-categories.md`](../../../docs/validation/source-derived-categories.md).

| File | Contents |
| --- | --- |
| `rubric.json` | The frozen question wording and the eleven category definitions, committed before inference. |
| `evaluation-set.json` | 63 predeclared labels on real loci and the draft threshold, committed with the rubric before inference. |
| `results.jsonl` | One typed record per request: key, request SHA-256, rubric, model, answer, and tokens. |
| `evaluation-results.jsonl` | The typed answers for the evaluation set. |
| `run-log.json` | When each network stage ran, with its request and token totals. |
| `spot-check.json` | The seeded sample, its draw threshold, and the blinded reviewer labels. |
| `summary.json` | The generated file hashes, counts, calibration, evaluation, and spot-check scores. |

Request bodies are not stored. Each is rebuilt from pinned inputs and the rubric,
and its SHA-256 must equal the recorded one. No API key or authorization header
is present. `tools/build_source_derived_categories.py --check` verifies the whole
bundle and the site file offline.
