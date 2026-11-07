These static, renamed Inter fonts retain captured weight variants in vector PDF
exports. Missing arrow/symbol glyphs are supplied by the included Liberation Sans
subset. See LICENSE.txt and FONT-PROVENANCE.json for licenses and source hashes.

The application and normal builds use these supplied files directly. To rebuild
as a maintainer, install `fonttools[woff]==4.68.0` in a separate Python environment,
run `npm ci`, then `python scripts/rebuild-vector-fonts.py` from the repository
root. The supplied fallback-symbols.ttf avoids requiring a system font. The
optional `--fallback` parameter is used only when creating that subset anew.
