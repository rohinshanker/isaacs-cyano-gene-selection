# O_folding-compute-backend__20260930 — Open

- **Scope:** Assess Yale Bouchet as a future website compute backend for RNA and
  protein folding algorithms, with a lab Mac mini and the owner's Jetson Orin Nano
  as fallback resources. Define feasibility, workload routing, and integration
  requirements before implementation.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-10-09

## Current State

Owner direction, 2026-10-09: rough regulatory predictions may use models and
evidence from other organisms. The [shared method assessment](A_regulatory-methods-shortlist__20261008.md#cross-organism-transfer-assessment-2026-10-09)
owns new ViennaRNA local-structure/accessibility and IntaRNA interaction uses.
Recompute on native UTEX RNA and retain windows, temperature, parameters and
sequence identity; donor structures/interactions are supporting hypotheses, not
transferred UTEX activity. Existing browser folding works, but the new regulatory
uses remain unevaluated. Start with bounded local feasibility before requesting
cluster resources; this adds no Bouchet login, deployment or model run. S10/S11
in the shared assessment record the primary-source capabilities and receipts.

**Owner update, 2026-10-07:** "yale bouchet cluster is available to me, but i
have not yet decided on whether to use a spinup or OOD, nor have i setup local
agents/workspace there".

Personal Bouchet access is therefore available by owner attestation. The
Spinup/OOD choice and cluster agent/workspace setup remain open. Neither route
is selected or assessed as equivalent here; no agent login, allocation/quota,
automated submission route or website-service permission has been verified.
The lab Mac mini and owner's Jetson Orin Nano are candidate fallbacks, with exact
hardware, availability, software compatibility, and connectivity unverified.
This update records availability; no cluster login, job submission, software
installation or deployment has been performed.

Preliminary official reference:
[YCRC Bouchet documentation](https://docs.ycrc.yale.edu/clusters/bouchet/), consulted
2026-09-30. It describes account-based SSH/Open OnDemand access and scheduled
CPU/GPU jobs. It does not establish permission or a supported route for this
website to submit jobs or host a public-facing service. Confirm those separately
before depending on that architecture; recheck current limits when activated.

The project already runs local, on-demand RNA folding in a browser worker under
[rna-folding.md](../../validation/rna-folding.md). This assessment should identify
which heavier workloads benefit from remote compute and how to preserve the
existing local path. The intended RNA/protein algorithms remain undecided. Inputs
come from the pinned UTEX 2973 RefSeq assembly `GCF_000817325.1` (taxid 1350461,
Complete).

**Architecture is a visible constraint before any benchmark runs.** At least one
tool a sibling ticket depends on ships as an x86-64 Linux binary needing
recompilation for arm64: the TransTermHP bundled with
[iDOG](O_idog-promoter-prediction__20260930.md), whose README says so. The
2026-09-30 return further states that both fallback devices are arm64; that is the
return's unverified statement — intake could not check it, because this ticket
records no Mac mini model and the Jetson module page served no CPU text. Determine
each device's architecture under D2 rather than inheriting the claim.

## Claude Science claims

None asserted for this infrastructure assessment. Algorithm validity, comparative
accuracy, model/data licences, and biological interpretation require bounded
claims or research packages under the
[Claude Science handoff](../../validation/claude-science-handoff.md) when concrete
methods are selected. Yale access/service policy is an operational dependency to
confirm through official documentation or the account owner/YCRC; it is not
settled by scientific inference. Gate only the dependent method or host.

## Dependencies and assessment

| Id | Prerequisite | Dependent step |
| --- | --- | --- |
| D1a | Personal Bouchet access: available per owner, 2026-10-07; not independently exercised | Access availability is no longer the owner question |
| D1b | Spinup/OOD choice, cluster agent/workspace setup, allocation/quotas, agent access and verified allowed automation/network/service-use routes remain open | Run cluster benchmarks, submit jobs and select a deployment topology |
| D2 | Exact Mac mini/Jetson specifications, ownership permission, availability, OS/runtime, and connectivity | Establish each fallback's supported workloads |
| D3 | Selected algorithms, code/model/data licences, inputs, and representative workload sizes | Estimate resources and benchmark methods on candidate hosts |
| D4 | Audience, latency, privacy, availability, and budget decisions below | Define service and job lifecycle contracts |
| D5 | Approved architecture and measured compatibility/performance | Implement a bounded backend integration |

When activated, compare scheduled cluster execution with a separately hosted
website API that submits/polls jobs through an approved route. Consider an
outbound worker/pull-queue design for lab devices where appropriate. These are
architecture candidates, not selected services or permission to expose a machine.
Do not assume cluster login nodes can host the website or execute folding jobs.

Next preparation can define a reproducible workspace/bootstrap plan and the
information to collect for each access route without logging in. Execution on
Bouchet waits on D1b. The raw-read reprocessing pilot is executing locally under
[its own active ticket](A_raw-read-pilot-execution__20261007.md); a future move
of that work to Bouchet would share the setup dependency, not this ticket's
folding-method choices. No unverified fallback-device specification fills a
Bouchet setup gap.

Return a workload/host matrix covering algorithm/version, CPU/GPU requirements,
memory and model storage, supported runtime and architecture, queue wait, execution
time, installation/licence constraints, and measured success/failure cases.
Separate small RNA folds, larger RNA structure work, and protein structure work.
Do not assume CUDA-dependent code runs on a Mac mini or that a protein model fits
the Jetson. Verify compatibility and capacity per workload.

Define a minimal job contract: exact input sequence and dataset/scheme identity,
algorithm/model version and parameters, idempotent submission, queued/running/
completed/failed/cancelled states, progress where actually available, result
storage and retention, deterministic cache keys, quotas, timeouts, and restart
recovery. Keep account secrets out of the browser; accept constrained job inputs
rather than browser-supplied shell commands. Capture resource and provenance
information with every result.

Fallback policy must be explicit: host unavailability or excessive queue delay
does not automatically authorize duplicate execution. Track job ownership and
confirm cancellation/termination before replacement. Do not silently substitute
a different algorithm, model, parameter set, or scientific interpretation when
moving work between hosts. Unsupported jobs should state their limitation.

Preserve the RNA contract's exact sequences, recoding/start/stop rules, cache
identity, and stale-result/cancellation behavior. Moving computation remotely
requires a deliberate update to the current statement that no sequence leaves
the browser and clear user-facing disclosure of the selected compute destination.
Benchmark equivalent local/remote calculations before claiming equivalence.

Related: the [pinned gene's sequence close-up](../../validation/gene-sequence-closeup.md)
may inspect inputs/results. Other prediction tickets may later use this job
interface only after compatibility is demonstrated. They are not prerequisites
for backend feasibility, nor does this ticket authorize their scientific adoption.

## Clarifying questions for later

1. Which RNA and protein algorithms are intended, and for what outputs: energies,
   secondary structure, 3D structures, original/recoded comparisons, or other tasks?
2. Are jobs short sequence windows, full genes/proteins, batches of selected genes,
   or genome-scale studies? What input sizes and request volume are expected?
3. Is the website compute feature private to you/the lab or available to external
   visitors? Who may submit jobs, and whose allocation pays for cluster work?
4. Personal Bouchet access is available, answered 2026-10-07. Which Spinup/OOD
   route will be used, how will the cluster agents/workspace be set up, what
   allocation/quotas and automated submission mechanism are available, and what
   do YCRC rules allow for a website-connected research service?
5. What Mac mini model, RAM, storage, and availability are available? What Jetson
   RAM/storage, software stack, and power/network availability can be relied on?
   Record each device's CPU architecture explicitly, since the x86-only binary
   above makes it a gating answer rather than a detail.
   Q8's earlier premise that Bouchet access is unavailable is superseded by the
   2026-10-07 update. No fallback-first benchmarking decision was supplied; the
   remaining cluster prerequisite is its route/workspace setup under D1b.
6. What waiting time is acceptable? Should fallback be manually selected or
   automatic under explicit queue-delay, outage, and capacity rules?
7. May sequences and results leave the browser and move among these hosts? What
   retention, access control, and data-transfer restrictions apply?
8. Should existing browser RNA folding remain the default for small jobs, with
   remote computation offered for selected heavier jobs?
9. Is an always-on API/job store already available, or should the assessment include
   where to host it and its operating cost and maintenance burden?

## Acceptance criteria

- A sourced access/deployment feasibility assessment and measured workload/host
  matrix distinguish supported, unsupported, and not-yet-tested cases.
- Recommend a minimal architecture and explicit fallback policy, with job states,
  reproducibility, cancellation, caching, credentials, limits, and result retention.
- Record what access, data, software, hardware, and owner decisions still gate each
  host/workload combination; do not describe future access as working integration.
- Any later implementation ships tests for every added path, including queue delay,
  host outage, retries, duplicate prevention, cancellation, and stale results.

## Verification

The 2026-10-09 transfer-planning note, source links and open status were checked
by `cyano-regulatory-sites`; current passing repository gates are recorded in
[the shared assessment](A_regulatory-methods-shortlist__20261008.md#verification).
No infrastructure, model run or UI changed.

Documentation update verified 2026-10-07: the 32-ticket filename/H1/status,
main-queue membership and local-link checks passed; `git diff --check` was clean.
Required gates on the isolated docs worktree: `npm test` 1,116 passed;
`.venv/bin/python -m pytest -q` 494 passed, 1 skipped, 36 subtests;
`.venv/bin/python tools/validate_contract.py` 116 passed, 0 failed, 1 declared
skip. This pass changed no application code, release data or browser UI;
implementation-specific validation remains separate.

Ticket creation verified 2026-09-30: fields, links, dependencies, questions, and
index entry checked; `git diff --check` passed. Repository gates passed:
`npm test` (659 tests), pytest (332 passed, 1 skipped, 24 subtests passed), and
contract validation (96 passed, 0 failed, 1 declared skip). No host or algorithm
benchmark has run.

Future implementation: finite representative host benchmarks and end-to-end jobs;
`npm test`, `.venv/bin/python -m pytest -q`, and
`.venv/bin/python tools/validate_contract.py`. Any visible job/results UI requires
the UI render/inspect/repair skill and mobile, tablet, and desktop validation.
Before any step requiring new credentials, administrator privileges, or device
permissions, disclose the exact action and reason and wait for the owner's decision.

## Cleanup

On resolution, rename the ticket/H1 to resolved and record final validation.
Distill reusable backend, workload-routing, provenance, and recovery guidance into
`docs/validation/`, update its index, then delete the resolved ticket and remove
its live queue entries. Do not retain task narration or credentials in documents.
