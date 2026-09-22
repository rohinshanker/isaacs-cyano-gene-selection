# GO IEA essentiality-context TypeSafe audit bundle

This bundle is the pinned evidence behind `site/data/go-iea-essentiality-v1.json`.
It is documented in
[`docs/validation/go-iea-essentiality-context.md`](../../../docs/validation/go-iea-essentiality-context.md).

| File | Contents |
| --- | --- |
| `rubric.json` | The frozen question wording and criteria, committed before inference. |
| `evaluation-set.json` | 46 predeclared labels, committed with the rubric before inference. |
| `results.jsonl` | One typed record per request. It holds the key, request SHA-256, rubric, model, answers, and tokens. |
| `evaluation-results.jsonl` | The typed answers for the evaluation set. |
| `run-log.json` | When each network stage ran, with its request and token totals. |
| `spot-check.json` | The seeded sample, its draw thresholds, and the blinded reviewer labels. |
| `summary.json` | The generated file hashes, counts, calibration, evaluation, and spot-check scores. |

Request bodies are not stored. Each is rebuilt from pinned inputs and the rubric,
and its SHA-256 must equal the recorded one. No API key or authorization header
is present. `tools/build_go_iea_essentiality.py --check` verifies the whole
bundle and the site file offline.
