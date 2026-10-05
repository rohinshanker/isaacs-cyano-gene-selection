# RET_claude-science-session__20261005 — Claude Science session return

**Read this before picking up scan ticket steps 3 or 6, or any work on dataset selection.**

```
requester:   owner
target:      mythos / fable
ticket:      docs/notes/tickets/O_cross-strain-data-scan__20260927.md (steps 3 and 6);
             proposed new ticket for a blocked-task register (E.5)
package:     E, data-driven comparability, grouped dataset selector, blocked-task register
scope:       new files in docs/notes/handoff/ only, listed in E.1. No code, data, site
             file, existing ticket, validation document, or index row was modified
acceptance:  the hard boundaries and results-block format in
             docs/validation/claude-science-handoff.md
status:      returned
opened:      20261005
updated:     20261005
```

Everything below is **evidence and recommendation**. No dataset is admitted, no pair is
judged comparable, no threshold is set and no ticket is recommended for closure. The contract
and ticket edits named here are for the in-repo agents to make after the owner confirms them.

## E.0 Order of work

1. **Package D intake first.** The package D return
   (`RET_claude-science-session__20261004.md`, `cyano_package_D_pairs_20261004.tsv`,
   SHA-256 `9a45d8384a23ecbf2ea2619043d5610a11d096912020878bd95df59f91ff799c`) has not been through intake.
   `docs/notes/tickets/INDEX.md:46-50,64`, the offload ticket (`:30`) and the scan ticket
   (`:604-605`) still describe it as unsent (register item MET-12). This return builds on
   package D but does not require its intake to be read.
2. Then this return.

## E.1 What was returned

| File | Content | Bytes | SHA-256 |
| --- | --- | --- | --- |
| [`cyano_dataset_selector_architecture_20261005.md`](cyano_dataset_selector_architecture_20261005.md) | Architecture: owner decisions, data model, statistics, grouping, interface, prerequisites, sequence, questions | 34600 | `9488ff1dfaf638431af2fdfe7acf56de94f36cd17b4dc4c22953a07d347cce98` |
| [`cyano_dataset_panel_mockup_20261005.html`](cyano_dataset_panel_mockup_20261005.html) | Static mockup: grouped dataset panel, compact condition scales, compare pane (package B values; open in a browser) | 67049 | `fd88e7e9f02acaa76251f2e9afee305c83b0648806f351038bc77f3b7dcce66c` |
| [`cyano_dataset_condition_records_20261005.json`](cyano_dataset_condition_records_20261005.json) | 63 hand-parsed condition records behind the mockup; example of the proposed structured schema | 55545 | `8d7e999409580bc7811ed719e75f94f42d94767a7811a1a7e0e87d5403dc7c3f` |
| [`cyano_comparability_methods_20261005.md`](cyano_comparability_methods_20261005.md) | Methods memo: survey, 10 pitfalls, metric set M1-M7, interface notes | 28080 | `e32fe81d6f97fbdf48c92ef91cb3bbcc1ac744ed1d6b0aa65b7a11e7283bbead` |
| [`cyano_comparability_methods_citations_20261005.tsv`](cyano_comparability_methods_citations_20261005.tsv) | 44 cited papers with identifiers, read depth and the claim each supports | 17124 | `96ea67e4feae8dd472d83f1ffb5db392e4c350b0b4825d0b5c5e99bd31580119` |
| [`cyano_comparability_pilot_20261005.md`](cyano_comparability_pilot_20261005.md) | Pilot calibration on seven PCC 7942 GEO tables: method, results, limits | 20007 | `65d0042e4aaebd089783d2191bfc717ec1fb5b3c7c2028c320f2811efe650970` |
| [`cyano_comparability_pilot_20261005.png`](cyano_comparability_pilot_20261005.png) | Pilot figure, panels a-e | 479119 | `29da5951f9a2e0b4e3c6b0bd22727244ea5506559d0e0ffd25daddc196b3c5e9` |
| [`cyano_comparability_pilot_auroc_20261005.tsv`](cyano_comparability_pilot_auroc_20261005.tsv) | Per-study and pooled AUROC by statistic | 5285 | `582f3ee8c7e257560876381f534930d0be65f128cd3d11dee77622e74b89170b` |
| [`cyano_comparability_pilot_response_20261005.tsv`](cyano_comparability_pilot_response_20261005.tsv) | Fold-change agreement by contrast pair | 7461 | `71768b07b24c67718fa87763ec292ecc41a02ea80f11dec7bcf1e00b14ec7223` |
| [`cyano_comparability_pilot_files_20261005.tsv`](cyano_comparability_pilot_files_20261005.tsv) | Downloaded GEO files: URL, bytes, SHA-256, retrieval date | 6026 | `d65f764f1b8062a923fd43fb37120bffa69b2c18f6ffd91f8af0475e4ab2681c` |
| [`cyano_comparability_pilot_samples_20261005.tsv`](cyano_comparability_pilot_samples_20261005.tsv) | Sample-to-condition assignment | 16940 | `90c9da480c0370d73244e07426d1289454bfc2b6fd0092730b3abe247658f3f3` |
| [`cyano_comparability_pilot_harmonisation_20261005.tsv`](cyano_comparability_pilot_harmonisation_20261005.tsv) | Identifier mapping summary | 952 | `51f497aa65b0a189bf4d0a85108af83d8b5e5dabbfa7480237b183eadaf39377` |
| [`cyano_comparability_pilot_pairs_20261005.tsv.gz`](cyano_comparability_pilot_pairs_20261005.tsv.gz) | 10,440 sample pairs with every statistic (gzip) | 151456 | `2e887169fa233af80467017f53dc60a1ad8bf77cc45440f63859ed967f12d787` |
| [`cyano_repo_integration_map_20261005.md`](cyano_repo_integration_map_20261005.md) | Read-only map of extension points, binding rules B1-B61, risks d.1-d.14 | 49110 | `86e78926ec9b18cbf6bbd8fb5390a1f9f18c029c2bdc1e19d59dcfa00891daa5` |
| [`cyano_blocked_task_register_20261005.md`](cyano_blocked_task_register_20261005.md) | Blocked-task register by remedy type, BioCyc terms and credential handling | 47736 | `05fddf294dfbda1ba77881f72953446d33b6849bac76909c9424cfbd2d5521ab` |
| [`cyano_blocked_task_register_20261005.tsv`](cyano_blocked_task_register_20261005.tsv) | Same register, 59 rows, 12 columns | 58593 | `29a60205ae869560e00bb5652f9e05052b2b9a3f56240c4686bd70c341aa47a3` |

Four parallel Claude Science tracks produced the methods memo, the pilot, the integration map
and the register. This session wrote the architecture, the mockup and the condition records,
and checked each track's declared deviations (E.7).

## E.2 The owner's instruction of 2026-10-04

It is quoted verbatim in section 1 of the architecture document. It is broken down there into
five decisions, D1-D5, each mapped to the clause it touches:

- **D1:** data may be compared to judge comparability (data-contract.md:142,
  future-data-roadmap.md:28-29).
- **D2:** many datasets toggle on at once (scan ticket step 6, :566-567).
- **D3:** an "Other" group.
- **D4:** compact condition scales, and optionally a viewer.
- **D5:** the final alignment call is human, and incomplete tasks are recorded.

The owner records these as decisions on AAA rows 13-14. The in-repo agents then make the edits
listed in the architecture document, table 1.1.

## E.3 Findings

**Methods** (44 papers; 29 read in full and 15 from abstracts):

- Agreement on condition response (within-study fold changes) is the strongest data-derived
  evidence of comparable biology.
- Level agreement means something only against each dataset's replicate band.
- Whole-distribution similarity after normalization mostly measures the normalization.
- All three cyanobacterial compendia found compare within-study contrasts.
- No numerical comparability threshold exists in the retrieved literature, so none is proposed.

**Pilot** (sandbox only; seven licence-permitted PCC 7942 GEO tables; GSE45762 excluded for
contradictory labels):

- Within a study, gene-wise Spearman separates replicates from different conditions:
  AUROC 0.942-0.975 in GSE104203, GSE222067 and GSE288532, 0.932 pooled; it leads the three
  statistics in 3 of 5 studies.
- Across studies, no pair reaches the replicate bound (0 of 7,812).
- Study-pair identity explains 34% of the cross-study variance in Spearman.
- Similar standard controls are not more concordant than other pairs (AUROC 0.462).
- Fold-change agreement was the only statistic that matched conditions across studies, on two
  contrast pairs, which is provisional.

**Consequence for the design:**

- Groups come from the condition record, not from level similarity, which would group by
  laboratory.
- Agreement statistics are shown against replicate bands, with no pass mark.
- Distribution comparison is kept as a units check. This is the one place where the design
  refines the instruction's wording (architecture §1.1, last paragraph). The owner may
  overrule it.

**Integration:**

- Five existing gaps block any multi-dataset view (architecture §7):
  - provenance attaches only to expression-recognised metrics;
  - three readers use only the legacy single source;
  - the registry is built once;
  - the contract's evidence bases are unread in `site/js`;
  - audit item A-01 is unresolved.
- 61 binding rules constrain the design, quoted with `file:line` in the integration map.

**Register** (59 items: 13 high, 22 medium, 24 low):

- No failure came from the sandbox allowlist.
- Five PDFs from a browser would unblock the most. Four need no institutional access.
- BioCyc needs an account, and no agent creates one. The preferred remedy is the owner
  exporting the wanted pages himself.
- Package D's 178 undecidable pairs are a metadata gap. GSE122841 alone is in 55 of them.

## E.4 Proposed placement in existing tickets

These are proposals. The in-repo agents decide wording and placement.

- **Scan ticket, step 3 ("Decide how datasets combine", :408-420).** Add architecture §3.2-3.3
  and §4 as the method for "Report the agreement statistic". This covers:
  - metrics M1-M5 shown against replicate bands, with M7 as a units check;
  - no composite score;
  - not-computable states;
  - pair judgements recorded by the lab (AAA row 14).

  Add owner question Q5 (uniform reprocessing) as a step-3 dependency.
- **Scan ticket, step 6 ("Dataset and condition selectors", :563-571).** Add architecture §5-6
  as the design. It answers the four open items:
  - placement: §6.1;
  - URL hash: §6.6;
  - interaction with the colour, axis and filter selectors: §6.2;
  - missing genes: §6.5.

  Replace the multi-select gate at :566-567 according to D2 once the owner confirms it.
- **Audit-fixes ticket** (`O_data-use-audit-fixes__20261004.md`). A-01 is a prerequisite of the
  agreement viewer (architecture §7.5). No change to the ticket is needed. A dependency note on
  step 6 is enough.
- **Prerequisites 1-4 of architecture §7.** These are either step-6 sub-steps or a new
  ticket; the in-repo agents choose.

## E.5 Proposed new ticket: blocked-task register

No existing ticket covers manual downloads, browsing sessions, credentials or the human review
the owner asked for. Proposed name: `O_blocked-task-register__20261005.md`. Proposed content:

- **Purpose.** Keep one list of every task that could not complete, with its cause, the source
  of the refusal, the human remedy, what it unblocks, and its priority. A later human review
  then resolves questions, supplies files, or provides workarounds.
- **Seed.** `cyano_blocked_task_register_20261005.tsv`, 59 rows, ids LIT, ACC, BIO, OWN, MET,
  AUD, LIC and NA.
- **Update rule.** Each Claude Science return and each intake adds rows for new blocks, and
  marks rows resolved with the resolving file or decision. Rows are never deleted.
- **Supplied files.** They stay outside the working tree, because the repository is public. The
  register suggests `~/Desktop/coding_stuff/ISAACS-LAB/private-literature/`, mounted read-only
  into a later Claude Science session. Values extracted from them return as addendum TSVs
  through intake.
- **Credentials.** Follow the "Safe credential handling" section of the register:
  - The owner exporting files himself is preferred.
  - If a session must authenticate, the secret goes into the Claude Science credential store.
    It is never typed into chat, a ticket or a file.
  - Nothing tied to a credential is written into the repository.
  - BioCyc terms must be read before any agent uses an individual account (BIO-01, BIO-03).
- **First review agenda.** These are the highest-leverage rows:
  - LIT-01 to LIT-03, LIT-05 and LIT-06 (five PDFs);
  - MET-12 (package D intake);
  - MET-05 (the turbidostat lamp);
  - OWN-11 and OWN-12 (selector defaults; the contract against the instruction);
  - OWN-01 (BioCyc Q2).

## E.6 Questions for the owner

These are the six questions in architecture §10:

1. Confirm or amend D1-D5.
2. The default shown set, and how conflicts are displayed.
3. Whether array and RNA-seq form one data type.
4. The group recipe, including named combinations such as "anoxic + cold".
5. Whether to reprocess uniformly from raw reads.
6. Whether distribution comparison may appear as a units check.

The register's owner-decision section lists the remaining open questions.

## E.7 Deviations declared by the tracks

- **Methods.** 15 of 44 sources were read from abstracts only. Some of these support key claims
  (ComBat, Lin's CCC, Bland-Altman, Irizarry 2005, MAQC 2006), and both files mark them. The
  per-gene-table count is a provisional keyword match.
- **Pilot.**
  - GSE45762 was excluded from every pair class.
  - GSE205444 was used as a three-replicate mean only.
  - The analysis is restricted to the 2,498 genes shared by the seven retained tables.
  - The AUROCs carry no confidence intervals.
  - Length correction used gene spans.
  - Fold changes were neither filtered nor shrunk.
  - All seven tables are PCC 7942; no UTEX 2973 locus was used.
- **Integration map.** `compare.js`, `side-panel.js`, `dataset.js` and `app.js` were read by
  targeted ranges, and about half of `progressive-loading.md` was read. Line numbers are
  working-tree numbers at HEAD `70bc590`, which had 49 uncommitted entries.
- **Register.** The ortholog table was read for its header only. Package D pair counts tied to
  unreadable papers are upper bounds. BioCyc's public pages were read on 2026-10-05 and are not
  recorded elsewhere in the repository.
- **This session.**
  - The mockup was not rendered in a browser. Its script was syntax-checked and run against a
    DOM stub.
  - The groups and treatment tags are this session's reading of package B labels, and are
    illustrative.
  - A first keyword-based tagging pass gave false positives and was replaced by hand
    assignment.

## E.8 Boundaries observed

- No admission, no lab decision, no licence decision, and no locus join.
- The pilot downloads are sandbox calibration. They are not candidates for the site, and no file
  from them is placed in `data/`.
- No existing file in the repository was edited. Every file in E.1 is new.
- No credential was requested, stored or used for any third-party service in this package.
- No ticket is recommended for closure.
