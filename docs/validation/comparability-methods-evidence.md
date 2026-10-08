# Comparability methods evidence

The [methods memo](../notes/handoff/cyano_comparability_methods_20261005.md)
and its [citation table](../notes/handoff/cyano_comparability_methods_citations_20261005.tsv)
must agree on which sources were read in full. A full-text mark requires a body
passage supporting the attributed claim, its location, source-file SHA-256 and
verification date. A quote match verifies wording; reading the surrounding
methods and limitations determines what that wording supports.

The [four-paper evidence file](../notes/handoff/cyano_comparability_methods_fulltext_20261007.json)
pins owner-saved PMC HTML by filename and checksum. The articles and extracted
texts stay in `ISAACS-LAB/private-literature/pmc/`, outside the repository.
The citation inventory contains 44 papers: 33 full text and 11 abstract only.
An inaccessible live article does not invalidate the pinned owner-supplied copy.
Never bypass a challenge or infer a full-text read from an abstract.

Keep these interpretation limits when reusing the evidence:

- MAQC's standardized RNA and strong A/B contrast support technical
  reproducibility; the reported consistency is not a threshold for weak
  biological contrasts or cyanobacterial baseline equivalence.
- Lin's broad-tissue species clustering is scoped to the leading components;
  tissue selection and later components change the pattern. Retain the memo's
  separately cited reanalysis and confounding warning.
- Reese's gPCA needs specified batch labels. Independent phenotype/batch
  simulations and CNV examples do not establish an RNA-seq comparability
  cutoff. A study-label association cannot identify its technical cause when
  study and condition coincide.
- Evans distinguishes mRNA/cell from mRNA/transcriptome and constant total
  expression from balanced expression assumptions. A majority of unchanged
  genes is not a universal normalization requirement. Controls also need
  validated assumptions.

## Reproduce the pins and quote matches

From the repository root, run this with the private `pmc` directory as its
argument. It extracts text only inside `<article>`, excluding script/style data,
and matches every excerpt with the existing addendum checker. Whitespace and
Unicode normalization follow `tools/check_addendum_quotes.py`; an altered word
fails. The temporary extracts are removed after the check.

```sh
python3 - /Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/private-literature/pmc <<'PY'
import csv
import hashlib
import json
import re
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, "tools")
from check_addendum_quotes import check_quote, load_texts, normalise

class ArticleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.active, self.skip, self.parts = False, 0, []
        self.scopes, self.locations = [], {}

    def handle_starttag(self, tag, attrs):
        if tag == "article":
            self.active = True
        if self.active:
            if tag in ("section", "p"):
                anchor = dict(attrs).get("id")
                self.scopes.append(anchor)
                if anchor:
                    self.locations[anchor] = []
            if tag in ("script", "style"):
                self.skip += 1
            if tag in ("p", "section", "h1", "h2", "h3", "li", "tr", "div", "br"):
                self.parts.append("\n")

    def handle_endtag(self, tag):
        if self.active:
            if tag in ("section", "p"):
                self.scopes.pop()
            if tag in ("script", "style"):
                self.skip -= 1
            if tag in ("p", "section", "h1", "h2", "h3", "li", "tr", "div"):
                self.parts.append("\n")
        if tag == "article":
            self.active = False

    def handle_data(self, data):
        if self.active and not self.skip:
            self.parts.append(data)
            for anchor in self.scopes:
                if anchor:
                    self.locations[anchor].append(data)

handoff = Path("docs/notes/handoff")
evidence = json.loads((handoff / "cyano_comparability_methods_fulltext_20261007.json").read_text())
sources = evidence["sources"]
assert len(sources) == 4 and len({row["pmcid"] for row in sources}) == 4
with tempfile.TemporaryDirectory() as directory:
    for row in sources:
        raw = (Path(sys.argv[1]) / row["source_file"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == row["source_sha256"], row["pmcid"]
        parser = ArticleText()
        parser.feed(raw.decode("utf-8"))
        text = "\n".join(" ".join(line.split()) for line in "".join(parser.parts).splitlines() if line.strip()) + "\n"
        assert row["pmcid"] in text and row["doi"] in text
        assert hashlib.sha256(text.encode()).hexdigest() == row["text_sha256"], row["pmcid"]
        for excerpt in row["excerpts"]:
            anchor = re.search(r"#([A-Za-z0-9.]+)", excerpt["location"]).group(1)
            located = "".join(parser.locations[anchor])
            assert normalise(excerpt["quote"]) in normalise(located), excerpt
        (Path(directory) / (row["pmcid"] + ".txt")).write_text(text, encoding="utf-8")
    texts = load_texts(Path(directory))
    findings = [check_quote(q["location"], q["quote"], texts, row=n, column="quote")
                for n, row in enumerate(sources, 1) for q in row["excerpts"]]
    assert findings and all(f.ok for f in findings), [f for f in findings if not f.ok]
    print(f"{len(findings)} quotations matched at their anchors; four HTML/text pins verified")
with (handoff / evidence["citations"]).open(newline="") as handle:
    rows = list(csv.DictReader(handle, delimiter="\t"))
full = sum(row["retrieved_via"].startswith("Full text read:") for row in rows)
abstract = sum(row["retrieved_via"].startswith("ABSTRACT ONLY:") for row in rows)
assert (len(rows), full, abstract) == (44, 33, 11)
for source in sources:
    cited = [row for row in rows if source["pmcid"] in row["doi_or_pmid"]]
    assert len(cited) == 1 and cited[0]["retrieved_via"].startswith("Full text read:")
print(f"{len(rows)} citations: {full} full text, {abstract} abstract only")
PY
```

Read the cited sections around the matched text as well: an anchored quote match
does not establish an interpretation. Recheck both the prose and citation table
when a later interpretation changes; evidence remains separate from admission,
licence decisions, identifier joins and lab judgements.
