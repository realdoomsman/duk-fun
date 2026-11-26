"""Run `python site/copy-assets.py` from the project, or `python copy-assets.py` here.
Copies the latest approved paint art. The published site needs no build step.
"""
from pathlib import Path
from shutil import copy2
import json

SITE = Path(__file__).resolve().parent
PROJECT = SITE.parent
ASSETS = SITE / 'assets'
ASSETS.mkdir(exist_ok=True)
MEMES = ASSETS / 'memes'
MEMES.mkdir(exist_ok=True)

SPRITES = (
    'stand.png', 'ducking.png', 'hit.png', 'obj_candles.png', 'obj_rent.png',
    'obj_liq.png', 'obj_ex.png', 'obj_alarm.png', 'obj_kol.png', 'obj_rug.png',
    'logo.png', 'banner-1500x500.png', 'og-1200x630.png',
)
missing = []
for name in SPRITES:
    source = PROJECT / 'brand' / 'paint' / name
    if source.is_file():
        copy2(source, ASSETS / name)
        print(f'copied assets/{name}')
    else:
        missing.append(name)
for name in ('duk.png', 'pfp.png'):
    source = PROJECT / 'style2' / 'paint' / name
    if source.is_file():
        copy2(source, MEMES / name)
        print(f'copied assets/memes/{name}')
    else:
        missing.append(f'memes/{name}')
manifest = PROJECT / 'memes' / 'manifest.json'
if manifest.is_file():
    pack = json.loads(manifest.read_text(encoding='utf-8'))
    for meme in pack:
        source = PROJECT / 'memes' / meme['file']
        if not source.is_file():
            missing.append(f"memes/{meme['file']}")
            continue
        target = MEMES / meme['file']
        target.parent.mkdir(parents=True, exist_ok=True)
        copy2(source, target)
        print(f"copied assets/memes/{meme['file']}")
    if not missing:
        copy2(manifest, MEMES / 'manifest.json')
if missing:
    print('awaiting art: ' + ', '.join(missing))
    raise SystemExit(1)
