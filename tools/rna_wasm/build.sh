#!/usr/bin/env bash
# Build the shipped engine from the official archive, never a third-party binary.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
emcc --version | head -1 | grep -F '4.0.15' >/dev/null
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/cyano-rna-build.XXXXXX")
cd "$build_dir"
curl --fail --location --retry 2 'https://www.tbi.univie.ac.at/RNA/download/sourcecode/2_7_x/ViennaRNA-2.7.2.tar.gz' -o source.tar.gz
actual=$(shasum -a 256 source.tar.gz | cut -d ' ' -f1)
test "$actual" = '1ab5f4a4f76fc85a2243546088e45f5d85f2d7a56cc656e969b005cce9bfab5f'
tar -xzf source.tar.gz
cd ViennaRNA-2.7.2
emconfigure ./configure --host=wasm32-unknown-emscripten \
  --disable-openmp --disable-pthreads --disable-simd --disable-vectorize \
  --disable-lto --disable-mpfr --disable-naview --without-svm --without-gsl \
  --without-swig --without-perl --without-python --without-doc --without-cla \
  --without-check --without-kinfold --without-forester --without-rnalocmin \
  --without-rnaxplorer CFLAGS=-O2 CXXFLAGS=-O2
emmake make -C src/ViennaRNA -j8
emcc "$root/tools/rna_wasm/fold.c" -Isrc src/ViennaRNA/.libs/libRNA.a -O2 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node -sFILESYSTEM=0 \
  -sALLOW_MEMORY_GROWTH=1 -sEXPORTED_FUNCTIONS='["_fold_mfe","_fold_structure"]' \
  -sEXPORTED_RUNTIME_METHODS='["ccall"]' -o "$root/site/vendor/viennarna/vienna.js"
shasum -a 256 "$root/site/vendor/viennarna/vienna.js" "$root/site/vendor/viennarna/vienna.wasm"
printf 'Auditable source and build retained at %s\n' "$build_dir"
