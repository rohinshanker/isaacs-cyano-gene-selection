# Staged expression sources, not loaded by the build

This directory is for documented candidate sources that are not selected for a build.
Files here are inert: `scripts/build_features.py` reads only the tables explicitly named
by `data/expression/sources.json`.

To select a staged source, move its table and provenance document into
`data/expression/`, add a complete manifest entry with its SHA-256 checksum, and rebuild.
Do not use staging to bypass the manifest or its checksum validation.

## Currently staged

No sources are currently staged.
