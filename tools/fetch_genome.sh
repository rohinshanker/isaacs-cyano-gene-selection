#!/usr/bin/env bash
# Downloads the genome of record into data/raw and verifies every file against
# NCBI's MD5 manifest. Exits non-zero if any file is missing or fails its checksum.
#
# The accession is pinned deliberately. GCF_000817745.x differs by three digits
# and is a different organism, so this must never be derived from memory or from
# a search at build time. See docs/validation/genome-provenance.md.

set -euo pipefail

ACC="GCF_000817325.1_ASM81732v1"
BASE="https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/817/325/${ACC}"
DEST="${1:-data/raw}"

FILES=(
  genomic.fna.gz
  genomic.gff.gz
  protein.faa.gz
  cds_from_genomic.fna.gz
  translated_cds.faa.gz
  rna_from_genomic.fna.gz
  feature_table.txt.gz
  genomic.gbff.gz
)

mkdir -p "$DEST"
curl -sSL --fail --max-time 120 -o "${DEST}/md5checksums.txt" "${BASE}/md5checksums.txt"
curl -sSL --fail --max-time 120 -o "${DEST}/${ACC}_assembly_report.txt" \
  "${BASE}/${ACC}_assembly_report.txt"

for f in "${FILES[@]}"; do
  curl -sSL --fail --max-time 600 -o "${DEST}/${ACC}_${f}" "${BASE}/${ACC}_${f}"
done

python3 - "$DEST" <<'PY'
import hashlib, os, sys

dest = sys.argv[1]
failures = []
verified = 0
for line in open(os.path.join(dest, "md5checksums.txt"), encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    expected, path = line.split(None, 1)
    target = os.path.join(dest, path.lstrip("./"))
    if not os.path.exists(target):
        continue
    digest = hashlib.md5()
    with open(target, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    if digest.hexdigest() == expected:
        verified += 1
    else:
        failures.append(os.path.basename(target))

report = os.path.join(dest, "GCF_000817325.1_ASM81732v1_assembly_report.txt")
organism = ""
for line in open(report, encoding="utf-8"):
    if line.startswith("# Organism name:"):
        organism = line.split(":", 1)[1].strip()
        break

# A correct checksum only proves the file downloaded intact, not that it is the
# right organism. Check identity explicitly.
if "UTEX 2973" not in organism:
    failures.append(f"wrong organism: {organism!r}")

print(f"verified {verified} files; organism: {organism}")
if failures:
    print("FAILURES: " + ", ".join(failures), file=sys.stderr)
    sys.exit(1)
PY
