"""Hand-feed the wall of fame (fame.html): stuff holders made, credited.

    python site/scripts/add-fame.py <file> --by <handle> [--post <x status url>] [--caption "..."] [--alt "..."] [--push]
    python site/scripts/add-fame.py --remove <id> [--push]
    python site/scripts/add-fame.py --list

<file> is the holder's png/jpg/webp, gif or mp4 (save it from their post). It is copied to assets/fame/<handle>-<n>.<ext>
with a 480px webp thumb (gifs become a looping mp4, clips get a poster) and added to the top of assets/fame.json.
Captions and alt text follow the site rule: no prices, percentages or other coins (same check as sync-content.py).
Then share-pages.py runs, so the entry's "post it" link shows a card of the piece. --push commits and pushes
assets/fame/, assets/fame.json and s/ only.
"""
from argparse import ArgumentParser
from datetime import datetime, timezone
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from shutil import copy2
import json
import re
import subprocess
import sys

from PIL import Image

SITE = Path(__file__).resolve().parents[1]
FAME = SITE / 'assets' / 'fame'
MANIFEST = SITE / 'assets' / 'fame.json'
PUBLISHED = ['assets/fame', 'assets/fame.json', 's']
HANDLE = re.compile(r'^[A-Za-z0-9_]{1,15}$')
IMAGES = {'.png', '.jpg', '.jpeg', '.webp'}

_spec = spec_from_file_location('sync_content', SITE / 'scripts' / 'sync-content.py')
sync = module_from_spec(_spec)
_spec.loader.exec_module(sync)


def load() -> dict:
    return json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.is_file() else {'entries': []}


def save(manifest: dict) -> None:
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def rel(path: Path) -> str:
    return path.relative_to(SITE).as_posix()


def add(args) -> str:
    source = Path(args.file).resolve()
    handle = args.by.lstrip('@')
    if not source.is_file():
        raise SystemExit(f'no such file: {source}')
    if not HANDLE.match(handle):
        raise SystemExit(f'not an x handle: {args.by}')
    post = (args.post or '').strip()
    if post and not re.match(rf'^https://(x|twitter)\.com/{re.escape(handle)}/status/\d+', post, re.I):
        raise SystemExit(f'--post should be https://x.com/{handle}/status/<id>')
    caption = ' '.join((args.caption or '').split()).lower()
    alt = ' '.join((args.alt or '').split()) or f'a duk made by @{handle}'
    for text in (caption, alt):
        if sync.OFF_RULE.search(text):
            raise SystemExit(f'breaks the content rule (prices, %, other coins): {text!r}')
    manifest = load()
    taken = {entry['id'] for entry in manifest['entries']}
    number = 1
    while f'{handle.lower()}-{number}' in taken:
        number += 1
    entry_id = f'{handle.lower()}-{number}'
    ext = source.suffix.lower()
    FAME.mkdir(parents=True, exist_ok=True)
    thumb = FAME / 'thumbs' / f'{entry_id}.webp'
    entry = {'id': entry_id}
    if ext in IMAGES:
        target = FAME / f'{entry_id}{ext}'
        copy2(source, target)
        with Image.open(target) as image:
            width, height = image.size
        entry.update(kind='image', src=rel(target), thumb=sync.thumbnail(target, thumb))
    elif ext == '.gif':
        target = FAME / f'{entry_id}.mp4'
        if not sync.gif_to_mp4(source, target):
            raise SystemExit('ffmpeg could not turn the gif into an mp4')
        with Image.open(source) as image:
            width, height = image.size
        entry.update(kind='gif', src=rel(target), thumb=sync.thumbnail(source, thumb))
    elif ext == '.mp4':
        target = FAME / f'{entry_id}.mp4'
        copy2(source, target)
        info = sync.probe(target)
        width, height = info['width'] or 720, info['height'] or 720
        poster = sync.video_poster(target, thumb, 1.5)
        if not poster:
            raise SystemExit('ffmpeg could not read the clip')
        entry.update(kind='video', src=rel(target), thumb=poster)
    else:
        raise SystemExit(f'use png, jpg, webp, gif or mp4 (got {ext})')
    entry.update(width=width, height=height, by=handle, post=post, caption=caption, alt=alt,
                 added=datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    manifest['entries'].insert(0, entry)
    save(manifest)
    return f'wall of fame: @{handle} ({entry_id})'


def remove(entry_id: str) -> str:
    manifest = load()
    entry = next((item for item in manifest['entries'] if item['id'] == entry_id), None)
    if not entry:
        raise SystemExit(f'no entry {entry_id}')
    manifest['entries'].remove(entry)
    for key in ('src', 'thumb'):
        (SITE / entry[key]).unlink(missing_ok=True)
    save(manifest)
    return f'wall of fame: removed {entry_id}'


def main() -> None:
    parser = ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('file', nargs='?')
    parser.add_argument('--by')
    parser.add_argument('--post')
    parser.add_argument('--caption')
    parser.add_argument('--alt')
    parser.add_argument('--remove')
    parser.add_argument('--list', action='store_true')
    parser.add_argument('--push', action='store_true')
    args = parser.parse_args()
    if args.list:
        for entry in load()['entries']:
            print(f"{entry['id']:<24} @{entry['by']:<16} {entry['kind']:<6} {entry['caption']}")
        return
    if args.remove:
        summary = remove(args.remove)
    elif args.file and args.by:
        summary = add(args)
    else:
        parser.error('give a file and --by, or --remove <id>, or --list')
    subprocess.run([sys.executable, str(SITE / 'scripts' / 'share-pages.py')], check=True)
    print(summary)
    if args.push:
        sync.push(summary, PUBLISHED)


if __name__ == '__main__':
    main()
