# Recovering and verifying literature evidence

Use an ordinary publisher or repository article page first. Access varies by
client and date: a working article page does not imply its PDF or supplement
is accessible. Stop at a challenge, paywall or account requirement; do not
change the client identity or solve a challenge. Owner-supplied files and
permitted public deposits are independent source routes.

Keep complete papers, supplements and extracted text outside this public
repository. Commit only the evidence needed to locate and reproduce a claim:
source identity, exact file hash, retrieval date, document/section/table locator,
minimal quotation and its interpretation limits. A search result, abstract or
successful HTTP response alone is not a full-text read.

## Package B/C intake and reproducible inputs

The [B/C addendum](../notes/handoff/cyano_package_BC_addendum_20261006.md)
contains 15 amendments to package B rows 1, 2, 3, 4, 7, 8, 16, 21, 46, 47, 48,
51, 53, 54 and 75. The GSE51112 ingest spec and four published records cite the recovered Table S7C
for replication; regenerating them must not restore the original access-failure
provenance. The artifact, strain, assay and table identities must match the
original rows. Its 70 quoted segments use ten source documents, including
workbooks and supplementary methods. The
[source manifest](../notes/handoff/cyano_package_BC_sources_20261014.json)
pins each private file, archive member and reading-order extract. The 2026-10-06
addendum checksum remains unchanged.

Reproduce the checks below from the repository root. They read the private
library, extract into a temporary directory, verify source and text hashes, and
call the existing quote checker. PDF extraction uses `pdftotext` without
`-layout`; workbook rows retain nonempty cells in column order. Never regenerate
an expected hash merely to accept different content or a changed extraction.

```sh
.venv/bin/python - /Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/private-literature <<'PY'
import hashlib
import io
import json
import subprocess
import sys
import tempfile
import zipfile
from html.parser import HTMLParser
from pathlib import Path
import xml.etree.ElementTree as ET

import openpyxl

sys.path.insert(0, "tools")
from check_addendum_quotes import check_file

class PageText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.skip = [], 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip -= 1
    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)

handoff = Path("docs/notes/handoff")
manifest = json.loads((handoff / "cyano_package_BC_sources_20261014.json").read_text())
addendum = handoff / manifest["addendum"]
digest = lambda raw: hashlib.sha256(raw).hexdigest()
assert digest(addendum.read_bytes()) == manifest["addendum_sha256"]
with tempfile.TemporaryDirectory() as directory:
    target = Path(directory)
    for source in manifest["sources"]:
        path = Path(sys.argv[1]) / source["private_path"]
        raw = path.read_bytes()
        member = source.get("member")
        if member:
            assert digest(raw) == source["container_sha256"], path
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                raw = archive.read(member)
        assert digest(raw) == source["source_sha256"], source["document"]
        suffix = Path(member or path.name).suffix
        output = target / (source["document"] + ".txt")
        if suffix == ".pdf":
            pdf = target / (source["document"] + ".pdf")
            pdf.write_bytes(raw)
            subprocess.run(["pdftotext", str(pdf), str(output)], check=True)
        elif suffix == ".xlsx":
            book = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
            lines = []
            for sheet in book:
                lines.append(sheet.title)
                for row in sheet.iter_rows(values_only=True):
                    values = [str(value) for value in row if value is not None]
                    if values:
                        lines.append(" | ".join(values))
            book.close()
            output.write_text("\n".join(lines) + "\n", encoding="utf-8")
        elif suffix == ".docx":
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                document = ET.fromstring(archive.read("word/document.xml"))
            paragraphs = document.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p")
            output.write_text("\n".join("".join(p.itertext()) for p in paragraphs) + "\n", encoding="utf-8")
        elif suffix == ".html":
            parser = PageText()
            parser.feed(raw.decode("utf-8"))
            output.write_text(" ".join(parser.parts), encoding="utf-8")
        else:
            raise ValueError(f"Unsupported source format: {suffix}")
        assert digest(output.read_bytes()) == source["text_sha256"], output.name
    findings = check_file(addendum, target)
    assert len(findings) == manifest["expected_quotations"]
    assert all(f.ok for f in findings), [f for f in findings if not f.ok]
    print(f"{len(findings)} quotations matched; all source and extraction pins verified")
PY
```

A quote match verifies wording. Read the stated section and its surrounding
methods to establish scope. In particular, `not reported` means the relevant
source was read and did not state the value for the relevant sampling scope.
A routine-growth value can remain in the explanatory text while the sampling
field is `not reported`; the shipped schema has no `partial` status. The recovery
inventory records that remaining scope gap as `partial`. `not retrieved` means the source
was unavailable. Neither is a measurement, zero, or comparability pass.

## Decisions and downstream boundaries

The intake preserved the source values and replication statements without
performing a locus join or granting admission. Seven formerly undetermined
ledger entries were resolved from the papers: GSE103462, GSE103463, GSE103644,
GSE103704, GSE105774, GSE102914 and GSE18902. Their earlier distribution decisions
were superseded by the owner's citation-only policy; use the
[current source ledger](source-ledger.md), not the old recommendation cells.

The [19-pair re-score](../notes/handoff/cyano_package_D_rescore_20261006.tsv)
is a frozen application of the thresholds then in force to the newly extracted
PXD036717 conditions. It contains 15 changes from undecidable to not comparable,
one unchanged not-comparable pair and three unchanged undecidable pairs.
It is not the current comparability decision or a lab judgement. Use the
[current metadata recovery contract](condition-metadata-recovery.md) and its
pinned current artifacts for subsequent comparisons. Missing sampling phase,
light identity, temperature or gas conditions remain missing when a paper is
silent; closing source-recovery work does not settle those lab/depositor gaps.

## Methods-paper coverage

The [methods evidence contract](comparability-methods-evidence.md) preserves
four owner-saved PMC sources, 12 anchored excerpts and their interpretation
limits. The methods memo and citation table contain 44 sources: 33 full text
and 11 explicitly abstract only. Retain the abstract-only labels in both
artifacts. Those eleven references supply only the limited claims recorded in
their citation rows; they do not establish full-text methods verification or
new source admission. Do not silently remove the labels when retiring a ticket.

## Remaining primary-source checks

The [primary-source receipts](../notes/handoff/cyano_literature_source_checks_20261014.json)
pin Guerreiro 2014, Wang 2016, Rubin 2015 and Adomako 2022 article pages and
17 short anchors. The corresponding full pages remain in the private library.
Read each anchored section as well as matching the excerpt. These excerpts locate
claims; they do not replace the experimental context around them.

```sh
.venv/bin/python - /Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/private-literature <<'PY'
import hashlib
import json
import sys
import tempfile
import csv
from html.parser import HTMLParser
from pathlib import Path

import openpyxl

sys.path.insert(0, "tools")
from check_addendum_quotes import normalise, check_file

class PageText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.scopes, self.locations = [], [], {}
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("section", "p", "div", "figure"):
            anchor = dict(attrs).get("id")
            self.scopes.append(anchor)
            if anchor:
                self.locations[anchor] = []
        if tag in ("script", "style"):
            self.skip += 1
    def handle_endtag(self, tag):
        if tag in ("section", "p", "div", "figure"):
            self.scopes.pop()
        if tag in ("script", "style"):
            self.skip -= 1
    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)
            for anchor in self.scopes:
                if anchor:
                    self.locations[anchor].append(data)

evidence = json.loads(Path("docs/notes/handoff/cyano_literature_source_checks_20261014.json").read_text())
count = 0
texts = {}
for source in evidence["sources"]:
    raw = (Path(sys.argv[1]) / source["private_path"]).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == source["source_sha256"]
    parser = PageText()
    parser.feed(raw.decode("utf-8"))
    text = " ".join(parser.parts)
    texts[source["document"]] = text
    assert hashlib.sha256(text.encode()).hexdigest() == source["text_sha256"]
    for excerpt in source["quotations"]:
        passage = " ".join(parser.locations[excerpt["anchor"]])
        assert normalise(excerpt["quote"]) in normalise(passage), excerpt
        count += 1
handoff = Path("docs/notes/handoff")
addendum = handoff / evidence["package_b_addendum"]["path"]
assert hashlib.sha256(addendum.read_bytes()).hexdigest() == evidence["package_b_addendum"]["sha256"]
with tempfile.TemporaryDirectory() as directory:
    for name, text in texts.items():
        (Path(directory) / (name + ".txt")).write_text(text)
    checks = check_file(addendum, Path(directory))
    assert len(checks) == evidence["package_b_addendum"]["expected_quotations"]
    assert all(check.ok for check in checks)
with addendum.open() as stream:
    revised = list(csv.DictReader(stream, delimiter="\t"))
with (handoff / "cyano_package_B_conditions_20261003.tsv").open() as stream:
    original = list(csv.DictReader(stream, delimiter="\t"))[57]
assert len(revised) == 1
for field in ("artifact", "strain", "assay", "per_gene_table"):
    assert revised[0][field] == original[field]
workbook = evidence["essentiality_workbook"]
path = Path(workbook["path"])
assert hashlib.sha256(path.read_bytes()).hexdigest() == workbook["sha256"]
book = openpyxl.load_workbook(path, read_only=True, data_only=True)
header = next(book[workbook["sheet"]].values)
assert set(workbook["columns"]) <= set(header)
book.close()
print(f"{count} anchored excerpts and {len(checks)} addendum quotes matched; pins and identities verified")
PY
```

The [PXD000510 intake](../notes/handoff/cyano_pxd000510_condition_addendum_20261014.json)
separates routine growth from sampling. The sampling culture is liquid and the
light/dark schedule is 12:12. Routine temperature, irradiance, aeration, medium
and pre-sampling dilution do not become numeric sampling values. White light
has no established lamp class. Five time channels plus a pooled reference in a
TMT sixplex do not establish independent culture replication. The reference
combines all time points, so identification counts are not exclusive to a layer's
named time window. Keep these limits in both the ingest spec and published source
records; replay all affected pairs using the condition-recovery contract.

The Wang page's copyright-information block contains the generic PMC notice;
no article-specific reuse grant was located on that PMC page. The publisher
page was not assessed. The owner's citation policy already
governs the ledger. A successful article read or a generic PMC link is not a
reuse licence.

Rubin/Adomako primary text supports the [essentiality evidence boundary](pcc-essentiality.md):
PCC 7942 fitness categories under the tested conditions, supplied through
Adomako's attributed pangenome workbook. The workbook's own Data Set S1 legend
states CC BY 4.0. Original Rubin Dataset S3 parity and UTEX knockout equivalence
are not established by this re-read.

## Recovery scope and remaining limitations

The blocked-task register keeps its original observations alongside dated
intake dispositions. Use those dispositions and these artifacts, not the original
access failures, to determine whether a paper still needs recovery.

| Register item | Accepted evidence and boundary |
| --- | --- |
| LIT-01, LIT-02, LIT-03, LIT-06, LIT-07 | The B/C addendum and pinned private sources cover Puszyńska, Markson, Vijayan, Santos-Merino and Vicente. Cell Reports files were supplied by the owner; the two subscription papers came through the owner's library access. |
| LIT-04 | PXD000510 primary-method intake, current pair replay and four published condition records. Sampling uncertainty remains explicit. |
| LIT-05 | [PXD027430 evidence](../notes/handoff/cyano_pxd027430_condition_addendum_20261007.json) includes the previously optional Singh supplement; its sampling-scope limitations remain in the [recovery contract](condition-metadata-recovery.md). |
| LIT-08 | Wang article read; no article-specific reuse grant located. No ledger decision waits on it. |
| LIT-09 | Per-paper ordinary article-page, publisher-rendered or owner-file routes replace the earlier access failures. No PDF challenge was solved. |
| AUD-03 | Rubin/Adomako primary-source check above; no original-S3 parity or new cross-strain biological equivalence claimed. |
| MET-05 | The supplied Markson/Vijayan methods do not name the turbidostat lamp. Owner J1 remains a separate judgement, not a recovered source value. |

GSE103606 is a SuperSeries, not another admitted layer. Its frozen package B rows
5 and 6 retain the original access-failure wording; the Puszyńska paper was since
read through LIT-01. No current pair or shipped layer uses those rows. The five
RNA-seq SubSeries were ingested separately; the two recovered array sources remain
in the [array-reader queue](../notes/tickets/O_array-expression-reader__20261007.md).
GSE50920/GSE50922 flask-temperature and other source-silent details remain in the
[depositor correspondence scope](../notes/tickets/O_depositor-condition-correspondence__20261007.md).
The Guerreiro supplement remains optional and unsupplied. The eleven abstract-only
methods references remain labelled; none supplies a condition cell or a pending
ledger decision. These limitations do not imply that a paper is still unreadable.
