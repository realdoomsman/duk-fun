"""Publish the fresh drops to the site: memes4/ + comics2/ (DukFactory), videos/clips2/ + gifs2/ (DukVideo).

    python site/scripts/sync-content.py          copy new files, write site/assets/content.json
    python site/scripts/sync-content.py --push   ...then commit and push those paths if anything changed

Pages read content.json through window.dukMedia() in app.js, which puts these items ahead of media.json
(copy-assets.py). Captions and alt text come from the producers' logs (x/queue-factory.jsonl,
work/clips2/shipped.json); anything unlisted gets a label from its filename. Memes and comics get a
480px webp thumbnail for the grids, gifs get an mp4 twin and a webp poster, clips get a webp poster.
Files touched in the last two minutes are skipped as possibly half-written; the next run picks them up.
"""
from datetime import datetime, timezone
from pathlib import Path
from shutil import copy2
import json
import re
import subprocess
import sys
import time

from PIL import Image

SITE = Path(__file__).resolve().parents[1]
PROJECT = SITE.parent
ASSETS = SITE / 'assets'
MANIFEST = ASSETS / 'content.json'
THUMB = 480
SETTLE_SECONDS = 120
IMAGES = {'.png', '.jpg', '.jpeg', '.webp'}
# source folder -> published folder. Never inside a folder copy-assets.py rebuilds (memes, gifs, videos, ...).
FOLDERS = {
    'memes4': ASSETS / 'memes4',
    'comics2': ASSETS / 'comics2',
    'gifs2': ASSETS / 'gifs2',
    'videos/clips2': ASSETS / 'clips2',
}
PUBLISHED = [MANIFEST.relative_to(SITE).as_posix()] + [path.relative_to(SITE).as_posix() for path in FOLDERS.values()]
# Content rule: no prices, dollar amounts, percentages, leverage multipliers, other coins. Listed files and items
# whose caption/topic/alt/title trip OFF_RULE (or that the producer marked retracted) are never published.
BLOCKLIST = PROJECT / 'work' / 'state' / 'content-blocklist.txt'
OFF_RULE = re.compile(r'bitcoin|\bbtc\b|\beth\b|\$\d|\d+ ?%|\d+k\b|\d+x\b', re.IGNORECASE)


def ffmpeg() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return 'ffmpeg'


FFMPEG = ffmpeg()


def run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', *args], capture_output=True, text=True)


def metadata() -> dict:
    """media path ('memes4/001_x.png') -> {caption, topic, alt, created} from the producers' logs."""
    found = {}
    queue = PROJECT / 'x' / 'queue-factory.jsonl'
    if queue.is_file():
        for line in queue.read_text(encoding='utf-8').splitlines():
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(entry, dict) and entry.get('media'):
                found[entry['media']] = entry
    shipped = PROJECT / 'work' / 'clips2' / 'shipped.json'
    if shipped.is_file():
        try:
            for entry in json.loads(shipped.read_text(encoding='utf-8')):
                if isinstance(entry, dict) and entry.get('media'):
                    found[entry['media']] = entry
        except json.JSONDecodeError:
            pass
    # Fixed re-renders are re-queued as '<id>-v2' (x/queue-video.jsonl). Latest line per base id wins, so a
    # corrected caption/topic replaces the original's wherever that base id has a -vN line.
    latest = {}
    queue = PROJECT / 'x' / 'queue-video.jsonl'
    if queue.is_file():
        for line in queue.read_text(encoding='utf-8').splitlines():
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(entry, dict) and entry.get('media') and entry.get('id'):
                latest[re.sub(r'-v\d+$', '', str(entry['id']))] = entry
    for base, entry in latest.items():
        if entry['id'] != base:
            old = found.get(entry['media'], {})
            found[entry['media']] = {**old, **entry, 'created': old.get('created') or entry.get('created')}
    return found


def label(path: Path) -> str:
    """'003_this_time_different' / 'duk4_006_bounce_comic' -> 'this time different.'"""
    words = [word for word in re.split(r'[_\-]+', path.stem) if word and not re.fullmatch(r'(duk\d*|\d+)', word)]
    return ' '.join(words) + '.'


def caption(entry: dict, path: Path) -> str:
    text = ' '.join(line.strip() for line in str(entry.get('caption') or '').splitlines() if line.strip())
    return text.lower() if text else label(path)


def alt_text(entry: dict, title: str) -> str:
    """Producer alt, else 'duk reacting to <topic>'; topics are research notes, so one that names a coin or a
    number the content rule bans (allowlisted items) falls back to the caption."""
    if entry.get('alt') and not OFF_RULE.search(str(entry['alt'])):
        return str(entry['alt'])
    if entry.get('topic') and not OFF_RULE.search(str(entry['topic'])):
        return f"duk reacting to {entry['topic']}. {title}"
    return title


def created(entry: dict, path: Path) -> str:
    stamp = entry.get('created')
    if isinstance(stamp, str) and stamp:
        return stamp
    return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def stale(target: Path, source: Path) -> bool:
    return not target.is_file() or target.stat().st_mtime < source.stat().st_mtime


def publish(source: Path, target: Path) -> str:
    if not target.is_file() or target.stat().st_size != source.stat().st_size or stale(target, source):
        target.parent.mkdir(parents=True, exist_ok=True)
        copy2(source, target)
    return target.relative_to(SITE).as_posix()


def thumbnail(source: Path, target: Path) -> str:
    if stale(target, source):
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            image.seek(0)
            frame = image.convert('RGBA' if image.mode in ('RGBA', 'LA', 'P') else 'RGB')
            frame.thumbnail((THUMB, THUMB), Image.LANCZOS)
            frame.save(target, 'WEBP', quality=72, method=6)
    return target.relative_to(SITE).as_posix()


def video_poster(source: Path, target: Path, at: float) -> str | None:
    if stale(target, source):
        frame = target.with_suffix('.frame.png')
        result = run('-ss', f'{at}', '-i', str(source), '-frames:v', '1', str(frame))
        if result.returncode or not frame.is_file():
            result = run('-i', str(source), '-frames:v', '1', str(frame))
        if result.returncode or not frame.is_file():
            return None
        thumbnail(frame, target)
        frame.unlink()
    return target.relative_to(SITE).as_posix()


def probe(source: Path) -> dict:
    """Duration and size from ffmpeg's banner (imageio-ffmpeg ships no ffprobe)."""
    info = subprocess.run([FFMPEG, '-hide_banner', '-i', str(source)], capture_output=True, text=True).stderr
    result = {'duration': None, 'width': None, 'height': None}
    duration = re.search(r'Duration: (\d+):(\d+):([\d.]+)', info)
    if duration:
        hours, minutes, seconds = duration.groups()
        result['duration'] = round(int(hours) * 3600 + int(minutes) * 60 + float(seconds), 2)
    size = re.search(r'Video: .*?, (\d{2,5})x(\d{2,5})', info)
    if size:
        result['width'], result['height'] = int(size.group(1)), int(size.group(2))
    return result


def gif_to_mp4(source: Path, target: Path) -> str | None:
    if stale(target, source):
        target.parent.mkdir(parents=True, exist_ok=True)
        result = run('-i', str(source), '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-c:v', 'libx264',
                     '-crf', '26', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', str(target))
        if result.returncode or not target.is_file():
            target.unlink(missing_ok=True)
            return None
    return target.relative_to(SITE).as_posix()


def ready(path: Path) -> bool:
    return path.is_file() and not path.name.startswith(('_', '.')) and time.time() - path.stat().st_mtime > SETTLE_SECONDS


def blocklist() -> tuple[set, set]:
    """(blocked, allowed) names from work/state/content-blocklist.txt: one filename (or stem, or 'folder/name')
    per line; 'allow <name>' lets an item through OFF_RULE when only its research topic tripped it. '#' comments."""
    if not BLOCKLIST.is_file():
        return set(), set()
    blocked, allowed = set(), set()
    for line in BLOCKLIST.read_text(encoding='utf-8').splitlines():
        line = line.split('#', 1)[0].strip().replace('\\', '/')
        if line.startswith('allow '):
            allowed.add(line[6:].strip())
        elif line:
            blocked.add(line)
    return blocked, allowed


def sync() -> tuple[dict, set, list]:
    meta = metadata()
    names, allowed = blocklist()
    keep = set()
    blocked = []
    content = {'memes': [], 'comics': [], 'gifs': [], 'clips': []}

    def off_rule(rel: str, entry: dict, title: str) -> bool:
        path = Path(rel)
        ids = {rel, path.name, path.stem}
        text = ' '.join(str(entry.get(key) or '') for key in ('caption', 'topic', 'alt')) + ' ' + title
        if ids & names or entry.get('retracted') or (OFF_RULE.search(text) and not ids & allowed):
            blocked.append(rel)
            return True
        return False

    for folder, kind in (('memes4', 'memes'), ('comics2', 'comics')):
        source_dir = PROJECT / folder
        if not source_dir.is_dir():
            continue
        for source in sorted(source_dir.iterdir()):
            if source.suffix.lower() not in IMAGES or not ready(source) or source.stem in ('sheet', 'contact-sheet'):
                continue
            entry = meta.get(f'{folder}/{source.name}', {})
            title = caption(entry, source)
            if off_rule(f'{folder}/{source.name}', entry, title):
                continue
            target = FOLDERS[folder] / source.name
            thumb = FOLDERS[folder] / 'thumbs' / f'{source.stem}.webp'
            content[kind].append({
                'file': source.name,
                'src': publish(source, target),
                'thumb': thumbnail(source, thumb),
                'title': title,
                'alt': alt_text(entry, title),
                'tag': 'market' if kind == 'memes' else None,
                'created': created(entry, source),
            })
            keep.update({target, thumb})

    gif_dir = PROJECT / 'gifs2'
    if gif_dir.is_dir():
        stems = {}
        for source in sorted(gif_dir.iterdir()):
            if source.suffix.lower() in ('.gif', '.mp4') and ready(source):
                stems.setdefault(source.stem, {})[source.suffix.lower()[1:]] = source
        for stem, files in stems.items():
            out = FOLDERS['gifs2']
            gif = files.get('gif')
            entry = meta.get(f'gifs2/{gif.name}' if gif else f'gifs2/{stem}.mp4', {})
            any_file = gif or files['mp4']
            title = caption(entry, any_file)
            if off_rule(f'gifs2/{any_file.name}', entry, title):
                continue
            item = {'title': title, 'alt': alt_text(entry, title), 'tag': 'reaction',
                    'mp4': None, 'gif': None, 'poster': None, 'created': created(entry, any_file)}
            if gif:
                item['gif'] = publish(gif, out / gif.name)
                keep.add(out / gif.name)
            if files.get('mp4'):
                item['mp4'] = publish(files['mp4'], out / f'{stem}.mp4')
            elif gif:
                item['mp4'] = gif_to_mp4(gif, out / f'{stem}.mp4')
            keep.add(out / f'{stem}.mp4')
            poster = out / 'posters' / f'{stem}.webp'
            item['poster'] = thumbnail(gif, poster) if gif else video_poster(files['mp4'], poster, 0)
            keep.add(poster)
            content['gifs'].append(item)

    clip_dir = PROJECT / 'videos' / 'clips2'
    if clip_dir.is_dir():
        for source in sorted(clip_dir.glob('*.mp4')):
            if not ready(source):
                continue
            entry = meta.get(f'videos/clips2/{source.name}', {})
            title = caption(entry, source)
            if off_rule(f'videos/clips2/{source.name}', entry, title):
                continue
            out = FOLDERS['videos/clips2']
            info = probe(source)
            poster = out / f'{source.stem}.webp'
            at = min(1.5, (info['duration'] or 2) / 3)
            content['clips'].append({
                'src': publish(source, out / source.name),
                'poster': video_poster(source, poster, at),
                'title': title,
                'alt': alt_text(entry, title),
                'created': created(entry, source),
                **info,
            })
            keep.update({out / source.name, poster})

    for items in content.values():
        items.sort(key=lambda item: (item['created'], item.get('src') or item.get('gif') or item.get('mp4')), reverse=True)
    return content, keep, blocked


def prune(keep: set) -> list:
    """Drop published files whose source is gone (cut or renamed upstream)."""
    removed = []
    for folder in FOLDERS.values():
        if folder.is_dir():
            for path in folder.rglob('*'):
                if path.is_file() and path not in keep:
                    path.unlink()
                    removed.append(path.relative_to(SITE).as_posix())
    return removed


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(['git', '-C', str(SITE), *args], capture_output=True, text=True)


def push(summary: str) -> None:
    if (SITE / '.git' / 'rebase-merge').exists() or (SITE / '.git' / 'rebase-apply').exists():
        raise SystemExit('a rebase is in progress in site/; skipping this push')
    paths = [path for path in PUBLISHED if (SITE / path).exists() or git('ls-files', '--', path).stdout.strip()]
    git('add', '-A', '--', *paths)
    if not git('diff', '--cached', '--quiet', '--', *paths).returncode:
        print('nothing new to push')
        return
    # Commit only the synced paths, whatever else is staged or edited in the worktree.
    result = git('commit', '-m', f'content: {summary}', '--', *paths)
    if result.returncode:
        raise SystemExit(f'commit failed: {result.stderr or result.stdout}')
    # Push straight away; only a rejected push (the remote moved) pulls, and only into a clean worktree: stashing
    # someone's edits or a copy-assets.py rebuild mid-way and popping it back can lose files.
    if git('push').returncode:
        if git('status', '--porcelain').stdout.strip():
            raise SystemExit('remote is ahead and the worktree is busy; the commit stays local for the next run')
        result = git('pull', '--rebase')
        if result.returncode:
            # Leave the worktree as it was; the commit stays local and goes out with the next run.
            git('rebase', '--abort')
            raise SystemExit(f'pull failed, rebase aborted: {result.stderr or result.stdout}')
        result = git('push')
        if result.returncode:
            raise SystemExit(f'push failed: {result.stderr or result.stdout}')
    print(f'pushed: {summary}')


def main() -> None:
    content, keep, blocked = sync()
    removed = prune(keep)
    previous = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.is_file() else {}
    changed = {key: previous.get(key) for key in content} != content
    if changed:
        stamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        MANIFEST.write_text(json.dumps({'updated': stamp, **content}, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    missing = [item.get('src') or item.get('gif') for kind in ('memes', 'comics', 'clips') for item in content[kind] if not item.get('src')]
    missing += [item['title'] for item in content['gifs'] if not (item['mp4'] or item['gif'])]
    if missing:
        raise SystemExit(f'broken entries: {missing}')
    summary = ', '.join(f'{len(items)} {kind}' for kind, items in content.items())
    print(f"content.json: {summary}{' (updated)' if changed else ' (no change)'}"
          + (f"; pruned {len(removed)} files" if removed else '')
          + (f"; blocked {len(blocked)}: {' '.join(blocked)}" if blocked else ''))
    if '--push' in sys.argv:
        push(summary)


if __name__ == '__main__':
    main()
