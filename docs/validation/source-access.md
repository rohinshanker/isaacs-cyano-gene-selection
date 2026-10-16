# Source access and account boundaries

- Purpose: Distinguish missing credentials from missing evidence, service entitlement and client-rendered content.
- Scope: BioCyc, KEGG, NUPACK and the GEO/PRIDE sources used by this repository.
- Last verified: 2026-10-16

## BioCyc

The owner confirmed an existing BioCyc account with Yale access and a Keychain
password on 2026-10-16. The same day's authorization permits agent use of the
owner's `biocyc-login` Keychain item through documented BioCyc web services,
replacing the owner-present-browser restriction for this account. Keep secrets
and session state outside Git and tool output. Before a new Keychain/security
prompt, disclose the exact action and reason; never bypass a denied or pending
approval. Reuse completed artifacts and coordinate through the retrieval owner.

The public [Individual Subscription License Terms](https://biocyc.org/subscription-terms.txt),
section 3.1(b), list “Use of the BioCyc Web Services to access BioCyc databases.”
Section 3.3 separately restricts crawling/scraping. Yale's institutional
agreement was not inspected; this public document is not proof of the terms or
entitlement attached to the owner's institutional access. The public
[download page](https://biocyc.org/download.shtml) distinguishes programmatic
access from licensed flat-file downloads and treats EcoCyc differently from
subscription databases. EcoCyc success therefore does not verify UTEX
`GCF_000817325`, PCC 7942 `SYNEL`, or bulk-file entitlement.

The [subscription FAQ](https://biocyc.org/subscription-faq.shtml) explains that
institutional users still need individual accounts and may need their
institution's VPN/proxy off campus. Check the database and route before treating
failure as a missing password or suggesting a purchase. Affiliation alone does
not establish granted entitlement.

Record requested/returned organism, release, genome/replicon identity, retrieval
time, source URL and payload checksum. Reject login/denial HTML masquerading as
HTTP 200/XML and the known E. coli fallback for an invalid organism ID. Assembly
and gene joins follow [biocyc-annotations.md](biocyc-annotations.md); credentials
cannot establish them. Public terms checks do not admit records or test private
access.

## KEGG

The [website policy](https://www.genome.jp/kegg/legal.html) and
[API policy](https://www.kegg.jp/kegg/rest/) are public. The latter states:
“KEGG API at rest.kegg.jp is made available only for academic use by academic
users.” It specifies at most three calls per second. Service-provider and bulk
FTP arrangements are separate from public academic access. No new login is
needed to read these terms; verify the intended route before new retrieval and
retain the [source-ledger](source-ledger.md) admission boundary.

The 2026-10-16 policy bytes match the 2026-10-05 E. coli dossier's hashes. An old
claim that terms have never been quoted is not a live blocker.

## NUPACK and calculator accounts

The [current installation guide](https://docs.nupack.org/start/) links to
`https://www.nupack.org/downloads/register`, now redirecting to
`https://www.nupack.org/download/overview`. Its **Go to Standard Academic License**
button opens the public [agreement](https://www.nupack.org/download/license).
A raw HTTP reader sees an application shell; ordinary JavaScript rendering
supplies the text without sign-in. The older `/downloads` route produced a blank
view in this check.

The agreement dated June 9, 2026 requires login and an active subscription for
acceptance, and separately limits redistribution, web/GUI use and AI-assisted
code derivation. No agreement was accepted and no software downloaded. These are
current terms, not verified legacy NUPACK 2.0 terms. A current account does not
establish availability of the old runtime or numerical equivalence of a replacement.

The active [calculator reconstruction project](https://github.com/rohinshanker/regulatory-site-prediction-reconstruction)
uses a separate RNAstructure-backed RBS profile in `wave1/rbs-runtime` work
(inspected at `a27a76f358e5094772ab0a67b546aed6aa5c7986`); it does not require a
NUPACK login. Release and validation remain that project's responsibility.
De Novo DNA hosted access is already established in the calculator sessions.
Browser access, paid/API entitlement, private model source and verified output
are distinct capabilities. Request credentials only for a concrete missing
capability; never duplicate another session's paid jobs.

## Sources that need no additional login

- GEO's [disclaimer](https://www.ncbi.nlm.nih.gov/geo/info/disclaimer.html) and
  [FAQ](https://www.ncbi.nlm.nih.gov/geo/info/faq.html) returned browser challenges
  on 2026-10-16. Stop at the challenge. The parent
  [NCBI policy](https://www.ncbi.nlm.nih.gov/home/about/policies/) remains the
  existing evidence route; no current feature requires those two pages. An
  owner-saved copy would supplement evidence, not unblock a login.
- PRIDE has a public render and Markdown route, verified in
  [pride-policy-access.md](pride-policy-access.md).
- GSE225426/GSE311172 already have admitted layers under the source ledger's
  2026-10-06 decision. Remaining condition/population-identity questions require
  depositor evidence, not a login or another permission email.
- The bounded [tRNA viewer](trna-annotation-validation.md#first-version-viewer-scope-and-future-scoring)
  needs no new GtRNAdb artifact. Missing database terms do not establish an
  account gate. Verify any future artifact separately; no current dependency
  does not mean a licence grant was found.
- Public deployment equality is a [release check](release-gate.md#publish-and-smoke-test).

## Rechecking evidence

[Dated receipts](../notes/handoff/source_access_checks_20261016.json) record public
URLs, retrieval times, raw-byte hashes (rendered UTF-8 text for NUPACK), locations
and short quotations mechanically matched after the stated whitespace/entity
normalization. Keep raw pages outside the repository. An HTTP 200 challenge is
a challenge, never the requested content. Do not retain cookies, credentials,
account details or authenticated screenshots in these receipts. Re-fetch and
re-match the needed claim when terms, routes or releases change; never silently
replace a historical hash.
