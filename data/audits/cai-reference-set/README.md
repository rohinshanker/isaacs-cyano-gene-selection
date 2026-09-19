# CAI reference-set TypeSafe audit bundle

This directory retains the compact evidence used by
[`docs/validation/cai-reference-set.md`](../../../docs/validation/cai-reference-set.md).
It is an audit record, not an input to the published CAI calculation and not an
authorization to change the reference set.

- `rubric.json` is the frozen nine-label Choice contract.
- `evaluation-set.json` is the 28-case set labeled before inference.
- `results.jsonl` contains one typed result per product annotation, including
  probabilities, confidence, returned model, and the held-back deterministic
  membership joined only after inference.
- `summary.json` records coverage, service use, label counts, evaluation, and
  comparison totals.
- `disagreements.tsv` and `manual-disagreement-review.json` preserve every
  membership difference and its rubric review.
- `manifest.json` pins the model, dates, counts, and content hashes.

The 2,715 raw request and response HTTP envelopes are omitted because they add
about 23 MB while duplicating the blinded candidate fields, rubric, model, typed
answers, and probabilities retained here. No API key or authorization header is
present in this bundle. `tests/readiness/test_cai_audit.py` verifies the hashes,
schema, counts, evaluation labels, published 71-locus membership, and complete
disagreement inventory without network access.
