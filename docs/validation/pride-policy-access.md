# PRIDE data-policy access

The public [PRIDE data-policy page](https://www.ebi.ac.uk/pride/markdownpage/datapolicy)
loads its text with JavaScript. An empty HTML shell is not an access refusal.
An ordinary browser render needs no account or challenge. Wait for the article
heading and policy paragraphs, rather than saving the initial loading message.
The page's network requests identify its [public Markdown source](https://www.ebi.ac.uk/pride/markdown/datapolicy/content.md),
which also supports a direct, credential-free retrieval.

## Verified source receipt

Retrieved 2026-10-15 UTC (2026-10-14 America/New_York). The policy identifies its
version as 1.0, May 2022. Under General guidelines → A) General statements →
Dataset Licenses, both the rendered article and source contain this exact quote:

> The terms of the Creative Commons Public Domain (CC0) License apply to all PRIDE datasets submitted from June 2018.

The following sentences say submitters agreed during submission and direct
pre-June-2018 deposits to EBI terms of use. The reuse section asks users to credit
the original dataset or publication. Submission date is the policy boundary;
a publication year alone does not establish which terms apply to a deposit.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `datapolicy.source.md` (original HTTP response) | 7,092 | `c1eb2ef7372e0cb83f5a5e75c86da4c8c9f93ccbd2f9623a079ab3c7f42e477f` |
| `datapolicy.rendered.txt` (article text) | 6,993 | `c6589c84aaa7782bb244b24c7c49ec0be199c847044c55064e8797cd645d49f0` |

The rendered artifact is `article.innerText`, stripped at its outer edges,
encoded as UTF-8 with one trailing newline. The quote matched exactly once in
each saved artifact. Source response metadata: `Last-Modified: Wed, 14 Oct 2026
11:34:57 GMT`, `ETag: "6acf68e1-1bb4"`. These are observations, not immutable
versions. An API lookup of the linked GitHub source returned 404; no Git commit
is used as a policy version pin.

Private source copies and `receipt.json` are retained outside the repository at
`../private-literature/pride-policy-20261015/`, relative to the canonical checkout.
Do not commit the full policy text merely to preserve this receipt.

## Rechecking

Retrieve the public Markdown, compute its SHA-256, and re-match the quotation
above against its Dataset Licenses paragraph. For example:

```sh
curl --fail --location https://www.ebi.ac.uk/pride/markdown/datapolicy/content.md -o /tmp/pride-datapolicy.md
shasum -a 256 /tmp/pride-datapolicy.md
```

If bytes change, read the changed policy before recording new evidence. If the
Markdown route disappears, render the public page and inspect its actual source
request again. A login or challenge is a separate access dependency; this route
does not authorize bypassing one.

This resolves the historical ACC-02 retrieval finding. It does not establish
individual project metadata, apply the June 2018 terms to older deposits, change
any retained licence facts or the owner's distribution decisions, admit data,
or resolve GEO, NUPACK or BioCyc access. Keep project-level evidence and the
[source-ledger contract](source-ledger.md) alongside this policy receipt.
