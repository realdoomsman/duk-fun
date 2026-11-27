"""The newest instagram/tiktok posts for the home page: python site/scripts/social.py -> site/assets/social.json.

Reads social/post-log.jsonl (DukSocials appends one line per post: ts, platform, kind, id, media, caption, url).
Keeps the newest posts that have their own link (stories only link the profile, so they're left out), skips any
whose caption or media name breaks the content rule, and gives each a 400px-wide webp of its first picture or a
frame of its reel (assets/social/<id>.webp). sync-content.py runs it every pass. Writes only on change.
"""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import json
import re

from PIL import Image

SITE = Path(__file__).resolve().parents[1]
PROJECT = SITE.parent
LOG = PROJECT / 'social' / 'post-log.jsonl'
OUT = SITE / 'assets' / 'social.json'
THUMBS = SITE / 'assets' / 'social'
KEEP = 8
WIDTH = 400
POST_URL = re.compile(r'^https://(www\.)?(instagram\.com/(p|reel|reels)/|tiktok\.com/@[\w.]+/video/)[\w/-]+$')

_spec = spec_from_file_location('sync_content', SITE / 'scripts' / 'sync-content.py')
sync = module_from_spec(_spec)
_spec.loader.exec_module(sync)


def words(caption: str) -> str:
    """The first paragraph, without hashtags or a trailing $duk (the tile says where it's from)."""
    first = re.split(r'\n\s*\n', caption or '')[0]
    first = re.sub(r'(^|\s)#\w+', ' ', first)
    return re.sub(r'\s*\$duk\s*$', '', ' '.join(first.split()), flags=re.IGNORECASE)


def picture(source: Path, target: Path) -> tuple[int, int] | None:
    if source.suffix.lower() in ('.mp4', '.mov', '.webm'):
        frame = target.with_suffix('.frame.png')
        if sync.stale(target, source):
            target.parent.mkdir(parents=True, exist_ok=True)
            result = sync.run('-ss', '1.5', '-i', str(source), '-frames:v', '1', str(frame))
            if result.returncode or not frame.is_file():
                result = sync.run('-i', str(source), '-frames:v', '1', str(frame))
            if result.returncode or not frame.is_file():
                return None
            shrink(frame, target)
            frame.unlink()
    elif sync.stale(target, source):
        target.parent.mkdir(parents=True, exist_ok=True)
        shrink(source, target)
    with Image.open(target) as image:
        return image.size


def shrink(source: Path, target: Path) -> None:
    with Image.open(source) as image:
        frame = image.convert('RGB')
        frame = frame.resize((WIDTH, round(frame.height * WIDTH / frame.width)), Image.LANCZOS)
        frame.save(target, 'WEBP', quality=74, method=6)


def posts() -> list:
    lines = []
    for line in LOG.read_text(encoding='utf-8').splitlines() if LOG.is_file() else []:
        try:
            entry = json.loads(line)
        except ValueError:
            continue  # blank, or a line still being written: the next run reads it.
        if isinstance(entry, dict):
            lines.append(entry)
    newest, seen = [], set()
    for entry in sorted(lines, key=lambda entry: entry.get('ts') or '', reverse=True):
        url = entry.get('url') or ''
        if entry.get('platform') not in ('instagram', 'tiktok') or not POST_URL.match(url) or url in seen:
            continue
        media = entry.get('media')
        first = media[0] if isinstance(media, list) and media else media
        text = words(entry.get('caption') or '')
        if not isinstance(first, str) or sync.OFF_RULE.search(f'{text} {Path(first).stem}'.replace('_', ' ')):
            continue
        source = PROJECT / first
        slug = re.sub(r'[^\w-]', '-', entry.get('id') or Path(first).stem)
        size = picture(source, THUMBS / f'{slug}.webp') if source.is_file() else None
        if not size:
            continue
        seen.add(url)
        newest.append({'id': slug, 'platform': entry['platform'], 'kind': entry.get('kind') or 'post', 'url': url,
                       'caption': text or 'just duk.', 'ts': entry.get('ts'), 'thumb': f'assets/social/{slug}.webp',
                       'width': size[0], 'height': size[1]})
        if len(newest) == KEEP:
            break
    return newest


def main() -> None:
    kept = posts()
    for stale in THUMBS.glob('*.webp') if THUMBS.is_dir() else []:
        if stale.stem not in {post['id'] for post in kept}:
            stale.unlink()
    text = json.dumps({'posts': kept}, indent=2, ensure_ascii=False) + '\n'
    if OUT.is_file() and OUT.read_text(encoding='utf-8') == text:
        print(f'social.json: no change ({len(kept)} posts)')
        return
    OUT.write_text(text, encoding='utf-8', newline='\n')
    print(f'social.json: {len(kept)} posts (written)')


if __name__ == '__main__':
    main()
