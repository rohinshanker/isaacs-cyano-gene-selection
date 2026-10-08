#!/usr/bin/env bash
# Downloads one configured genome of record and verifies every file against
# NCBI's MD5 manifest. Exits non-zero if any file is missing or fails its checksum.
#
# Accessions are pinned deliberately in config/organisms.json and are never
# derived from a search at build time. See docs/validation/genome-provenance.md.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ORGANISM="utex2973"
if [[ "${1:-}" == "--organism" ]]; then
  [[ $# -ge 2 ]] || { echo "error: --organism requires an id" >&2; exit 2; }
  ORGANISM="$2"
  shift 2
fi

IFS=$'\t' read -r ORGANISM ACC FTP_DIRECTORY EXPECTED_ORGANISM EXPECTED_STRAIN EXPECTED_TAXID DEFAULT_DEST < <(
  python3 "$ROOT/scripts/organisms.py" "$ORGANISM"
)
BASE="https://ftp.ncbi.nlm.nih.gov/genomes/all/${FTP_DIRECTORY}"
DEST="${1:-$DEFAULT_DEST}"

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

python3 - "$DEST" "$ACC" "$EXPECTED_ORGANISM" "$EXPECTED_STRAIN" "$EXPECTED_TAXID" <<'PY'
import hashlib, os, sys

dest = sys.argv[1]
accession = sys.argv[2]
expected_organism = sys.argv[3]
expected_strain = sys.argv[4]
expected_taxid = sys.argv[5]
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

report = os.path.join(dest, f"{accession}_assembly_report.txt")
organism = ""
infraspecific = ""
taxid = ""
for line in open(report, encoding="utf-8"):
    if line.startswith("# Organism name:"):
        organism = line.split(":", 1)[1].strip()
    elif line.startswith("# Infraspecific name:"):
        infraspecific = line.split(":", 1)[1].strip()
    elif line.startswith("# Taxid:"):
        taxid = line.split(":", 1)[1].strip()

# A correct checksum only proves the file downloaded intact, not that it is the
# right organism. Check identity explicitly.
if expected_organism not in organism or expected_strain not in (organism + " " + infraspecific):
    failures.append(f"wrong organism: {organism!r}")
if taxid != expected_taxid:
    failures.append(f"wrong taxid: {taxid!r}")

print(f"verified {verified} files; organism: {organism}; taxid: {taxid}")
if failures:
    print("FAILURES: " + ", ".join(failures), file=sys.stderr)
    sys.exit(1)
PY
