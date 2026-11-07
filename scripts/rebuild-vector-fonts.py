#!/usr/bin/env python3
"""Optional maintainer tool: pip install fonttools[woff]. App/build use generated assets."""
from pathlib import Path
import json, hashlib, tempfile, argparse
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.merge import Merger
from fontTools import subset
import fontTools
root = Path(__file__).resolve().parents[1]
out = root / 'addons/track-planner/src/assets/pdf-fonts'
parser = argparse.ArgumentParser()
parser.add_argument('--fallback', default='/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf')
parser.add_argument('--weight', type=int)
args = parser.parse_args()
out.mkdir(parents=True, exist_ok=True)
sources = sorted((root / 'node_modules/@fontsource-variable/inter/files').glob('*-wght-normal.woff2'))
coverage = set().union(*(TTFont(p).getBestCmap().keys() for p in sources))
fallback = out / 'fallback-symbols.ttf'
if not fallback.exists():
    f = TTFont(args.fallback)
    opts = subset.Options()
    opts.recalc_timestamp = False
    s = subset.Subsetter(options=opts)
    s.populate(unicodes=set(range(8448, 10240)) - coverage & set(f.getBestCmap()))
    s.subset(f)
    f.flavor = None
    f.recalcTimestamp = False
    for id, val in [(1, 'CarreraPlannerSymbols'), (2, 'Regular'), (4, 'CarreraPlannerSymbols'), (6, 'CarreraPlannerSymbols'), (16, 'CarreraPlannerSymbols'), (17, 'Regular')]:
        f['name'].setName(val, id, 3, 1, 1033)
    f.save(fallback)
f = TTFont(fallback)
for rec in f['name'].names:
    if rec.nameID in [1, 4, 6, 16]:
        rec.string = 'CarreraPlannerSymbols'.encode(rec.getEncoding())
    elif rec.nameID in [2, 17]:
        rec.string = 'Regular'.encode(rec.getEncoding())
f.recalcTimestamp = False
f.save(fallback)
weights = [args.weight] if args.weight else list(range(100, 1000, 100))
for weight in weights:
    with tempfile.TemporaryDirectory() as tmp:
        inputs = []
        for i, p in enumerate(sources):
            f = instantiateVariableFont(TTFont(p), {'wght': weight}, inplace=True)
            f.flavor = None
            f.recalcTimestamp = False
            target = Path(tmp) / f'{i}.ttf'
            f.save(target)
            inputs.append(str(target))
        merged = Merger().merge([*inputs, str(fallback)])
        merged.flavor = None
        merged.recalcTimestamp = False
        family = f'CarreraPlanner{weight}'
        for id, val in [(1, family), (2, 'Regular'), (4, family), (6, family), (16, family), (17, 'Regular')]:
            merged['name'].setName(val, id, 3, 1, 1033)
        for rec in merged['name'].names:
            if rec.nameID in [1, 4, 6, 16]:
                rec.string = family.encode(rec.getEncoding())
            elif rec.nameID in [2, 17]:
                rec.string = 'Regular'.encode(rec.getEncoding())
        merged['OS/2'].usWeightClass = weight
        merged.save(out / f'{family}.ttf')
        print(family, len(merged.getBestCmap()), (out / f'{family}.ttf').stat().st_size)
manifest = {'fontTools': fontTools.__version__, 'sources': {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}, 'fallbackSource': 'Liberation Sans Regular, OFL-1.1; missing symbol subset; supplied in fallback-symbols.ttf', 'generated': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.glob('*.ttf'))}}
(out / 'FONT-PROVENANCE.json').write_text(json.dumps(manifest, indent=2) + '\n')
