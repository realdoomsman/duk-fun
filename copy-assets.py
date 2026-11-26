"""Run `python site/copy-assets.py` from the project, or `python copy-assets.py` here.

Copies the latest approved paint art into site/assets and writes assets/media.json,
the index every page reads to render whatever memes, sticker packs and videos exist.
Collection folders publish only once they have a manifest.json (the artist's "done" signal),
and every published folder is rebuilt from scratch so cut or renamed files don't linger.
The published site needs no build step; re-run this whenever new art lands.
"""
from pathlib import Path
from shutil import copy2, rmtree
import json

SITE = Path(__file__).resolve().parent
PROJECT = SITE.parent
ASSETS = SITE / 'assets'
MEMES = ASSETS / 'memes'
STICKERS = ASSETS / 'stickers'
VIDEOS = ASSETS / 'videos'
REBUILT = ('memes', 'memes2', 'memes3', 'comics', 'gifs', 'kit', 'replies', 'stickers', 'videos')
ASSETS.mkdir(exist_ok=True)
for name in REBUILT:
    rmtree(ASSETS / name, ignore_errors=True)
for folder in (MEMES, STICKERS, VIDEOS):
    folder.mkdir()

SPRITES = (
    'stand.png', 'ducking.png', 'hit.png', 'obj_candles.png', 'obj_rent.png',
    'obj_liq.png', 'obj_ex.png', 'obj_alarm.png', 'obj_kol.png', 'obj_rug.png',
    'logo.png', 'banner-1500x500.png', 'og-1200x630.png',
)
TAGS = {'reaction', 'dodge', 'pool', 'cult', 'market', 'life', 'season'}
# Pack folder -> display name. Packs are published as plain downloads.
PACKS = {
    'react': 'reactions',
    'daily': 'daily',
    'trench': 'trench',
    'motion_a': 'motion, part one',
    'motion_b': 'motion, part two',
}
STICKER_TYPES = {'.png': 'png', '.webp': 'webp', '.webm': 'webm'}


missing = []
media = {
    'memes': [], 'comics': [], 'gifs': [], 'kit': {}, 'stickerPacks': [],
    'videos': {'trailer': None, 'clips': []}, 'poolSprite': None, 'replyLines': [],
}


def publish(source: Path, target: Path) -> str:
    target.parent.mkdir(parents=True, exist_ok=True)
    copy2(source, target)
    return target.relative_to(SITE).as_posix()


def label(path: Path) -> str:
    """'07_whale_sold' -> 'whale sold.' for folders that arrive without a manifest."""
    stem = path.stem
    if stem[:2].isdigit() and '_' in stem:
        stem = stem.split('_', 1)[1]
    return stem.replace('_', ' ').replace('-', ' ') + '.'


def collection(folder_name: str) -> list:
    """Publish PROJECT/<folder> to assets/<folder> from its manifest.json [{file,title|caption,alt,tag}].
    A folder without a manifest is still being made and is skipped."""
    folder = PROJECT / folder_name
    manifest = folder / 'manifest.json'
    if not manifest.is_file():
        return []
    listed = json.loads(manifest.read_text(encoding='utf-8'))
    entries = listed.get('files', []) if isinstance(listed, dict) else listed
    published = []
    for entry in entries:
        source = folder / entry['file']
        if not source.is_file():
            missing.append(f"{folder_name}/{entry['file']}")
            continue
        title = entry.get('title') or entry.get('caption') or label(source)
        tag = entry.get('tag')
        published.append({
            'file': entry['file'],
            'src': publish(source, ASSETS / folder_name / entry['file']),
            'title': title,
            'alt': entry.get('alt') or title,
            'tag': tag if isinstance(tag, str) and tag else None,
        })
    return published


for name in SPRITES:
    source = PROJECT / 'brand' / 'paint' / name
    if source.is_file():
        publish(source, ASSETS / name)
    else:
        missing.append(f'brand/paint/{name}')
floating = PROJECT / 'brand' / 'paint' / 'float.png'
if floating.is_file():
    media['poolSprite'] = publish(floating, ASSETS / 'float.png')

for name in ('duk.png', 'pfp.png'):
    source = PROJECT / 'style2' / 'paint' / name
    if source.is_file():
        publish(source, MEMES / name)
    else:
        missing.append(f'style2/paint/{name}')

# The archive is one list: memes/, memes2/ (101-150, quote cards), memes3/ (151-180, 'season').
for folder_name in ('memes', 'memes2', 'memes3'):
    for meme in collection(folder_name):
        if meme['tag'] not in TAGS:
            meme['tag'] = None
        media['memes'].append(meme)
media['comics'] = collection('comics')

# Reaction gifs arrive as mp4 + gif pairs; one entry per stem.
gifs = {}
for item in collection('gifs'):
    stem = item['src'].rsplit('.', 1)[0]
    entry = gifs.setdefault(stem, {'title': item['title'], 'alt': item['alt'], 'tag': item['tag'], 'mp4': None, 'gif': None, 'poster': None})
    suffix = item['src'].rsplit('.', 1)[-1].lower()
    if suffix in ('mp4', 'webm'):
        entry['mp4'] = item['src']
    elif suffix == 'gif':
        entry['gif'] = item['src']
    else:
        entry['poster'] = item['src']
for stem, entry in gifs.items():
    # A manifest that lists only one format still gets its sibling published.
    for suffix in ('mp4', 'gif'):
        if entry[suffix] is None:
            sibling = PROJECT / (stem.removeprefix('assets/') + f'.{suffix}')
            if sibling.is_file():
                entry[suffix] = publish(sibling, SITE / f'{stem}.{suffix}')
# gifs/stickers/<a|b><NN_name>.mp4/.gif (tag 'sticker') are the iPhone-safe exports of the motion
# packs' webm stickers; they're attached to those stickers instead of listed as reaction gifs.
sticker_exports = {Path(stem).name: entry for stem, entry in gifs.items() if entry['tag'] == 'sticker'}
media['gifs'] = [entry for entry in gifs.values() if entry['tag'] != 'sticker' and (entry['mp4'] or entry['gif'])]

# The kit is grouped by its first folder: templates/, pfp/, wallpapers/, banners/.
for item in collection('kit'):
    group = item['file'].split('/', 1)[0] if '/' in item['file'] else 'extras'
    media['kit'].setdefault(group, []).append(item)

# Reply pack: 1200x675 reply images plus the suggested lines from lines.md.
replies = collection('replies')
if replies:
    media['kit']['replies'] = replies
lines = PROJECT / 'replies' / 'lines.md'
if lines.is_file() and (PROJECT / 'replies' / 'manifest.json').is_file():
    publish(lines, ASSETS / 'replies' / 'lines.md')
    media['replyLines'] = [line.lstrip('-*0123456789. ').strip() for line in lines.read_text(encoding='utf-8').splitlines()
                           if line.strip() and not line.lstrip().startswith('#')]


def emoji_map(folder: Path) -> dict:
    mapping = {}
    listing = folder / 'emojis.txt'
    if listing.is_file():
        for line in listing.read_text(encoding='utf-8').splitlines():
            parts = line.split(maxsplit=1)
            if len(parts) == 2:
                mapping[parts[0]] = parts[1].strip()
    return mapping


def sticker_pack(folder: Path, pack_id: str, name: str):
    emojis = emoji_map(folder)
    pack = {'id': pack_id, 'name': name, 'kind': 'static', 'icon': None, 'contact': None, 'items': []}
    for source in sorted(folder.iterdir()):
        kind = STICKER_TYPES.get(source.suffix.lower())
        lower = source.name.lower()
        if not source.is_file():
            continue
        target = STICKERS / pack_id / source.name
        if 'contact' in lower:
            pack['contact'] = publish(source, target)
        elif lower.startswith('icon'):
            pack['icon'] = publish(source, target)
        elif kind and source.name[:2].isdigit():
            if kind == 'webm':
                pack['kind'] = 'animated'
            label = source.stem.split('_', 1)[-1].replace('_', ' ')
            item = {'src': publish(source, target), 'alt': f'{label}.', 'emoji': emojis.get(source.name), 'type': kind}
            if kind == 'webm':
                # x and iPhone safari can't use alpha webm; prefer the exported mp4/gif for this sticker.
                export = sticker_exports.get(pack_id.removeprefix('motion_') + source.stem, {})
                for format_name in ('mp4', 'gif'):
                    sibling = source.with_suffix(f'.{format_name}')
                    item[format_name] = export.get(format_name) or (
                        publish(sibling, target.with_suffix(f'.{format_name}')) if sibling.is_file() else None)
            pack['items'].append(item)
    if pack['items']:
        media['stickerPacks'].append(pack)


new_packs = PROJECT / 'stickers2'
if new_packs.is_dir():
    known = [new_packs / name for name in PACKS if (new_packs / name).is_dir()]
    extra = sorted(path for path in new_packs.iterdir()
                   if path.is_dir() and path.name not in PACKS and not path.name.startswith('_'))
    for folder in known + extra:
        sticker_pack(folder, folder.name, PACKS.get(folder.name, folder.name.replace('_', ' ')))


durations = {}
video_manifest = PROJECT / 'videos' / 'manifest.json'
if video_manifest.is_file():
    for entry in json.loads(video_manifest.read_text(encoding='utf-8')).get('files', []):
        durations[Path(entry['file']).name] = entry.get('duration')
thumbnails = PROJECT / 'videos' / 'thumbnails'
trailer = PROJECT / 'videos' / 'duk-trailer.mp4'
if trailer.is_file():
    poster = next((PROJECT / 'videos' / f'duk-trailer-poster.{suffix}' for suffix in ('jpg', 'png')
                   if (PROJECT / 'videos' / f'duk-trailer-poster.{suffix}').is_file()), None)
    media['videos']['trailer'] = {
        'src': publish(trailer, VIDEOS / trailer.name),
        'poster': publish(poster, VIDEOS / poster.name) if poster else None,
        'title': 'duk. the trailer.',
        'duration': durations.get(trailer.name),
        'frames': [publish(frame, VIDEOS / 'frames' / frame.name)
                   for frame in sorted(thumbnails.glob('trailer-*.png'))] if thumbnails.is_dir() else [],
    }
clips = PROJECT / 'videos' / 'clips'
if clips.is_dir():
    for clip in sorted(clips.glob('*.mp4')):
        poster = thumbnails / f'{clip.stem}.png'
        media['videos']['clips'].append({
            'src': publish(clip, VIDEOS / 'clips' / clip.name),
            'poster': publish(poster, VIDEOS / 'clips' / poster.name) if poster.is_file() else None,
            'title': clip.stem.split('_', 1)[-1].replace('_', ' ') + '.',
            'duration': durations.get(clip.name),
        })

(ASSETS / 'media.json').write_text(json.dumps(media, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
sticker_count = sum(len(pack['items']) for pack in media['stickerPacks'])
kit_count = sum(len(items) for items in media['kit'].values())
print(f"media.json: {len(media['memes'])} memes, {len(media['comics'])} comics, {len(media['gifs'])} gifs, "
      f"{kit_count} kit files, {len(media['stickerPacks'])} sticker packs ({sticker_count} stickers), "
      f"trailer {'ready' if media['videos']['trailer'] else 'missing'}, {len(media['videos']['clips'])} clips, "
      f"pool sprite {'ready' if media['poolSprite'] else 'missing'}")
if missing:
    print('awaiting art: ' + ', '.join(missing))
    raise SystemExit(1)
