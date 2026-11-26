"""Share pages: python site/scripts/share-pages.py -> site/s/<slug>.html + site/s/img/<slug>.jpg

One tiny page per meme (archive), clip (watch), reaction gif (stickers), comic strip, wall of fame entry and recorded duk of
the day with its own 1200x630 card, so a link posted on x shows that piece instead of the generic page card. People who open
the link land on memes.html#<folder/file>, watch.html#clip-<file>, stickers.html#gif-<file>, comics.html#strip-<file>,
fame.html#fame-<id> or daily.html#day-<date>. The slug is the asset path under assets/ without its extension, '/' and
anything outside [A-Za-z0-9_-] turned into '-' (window.dukSharePage in app.js builds the same slug for every post link);
a duk of the day is s/daily-<date>.html.

Reads assets/media.json, assets/content.json, assets/fame.json, assets/daily.json and the memes in assets/config.js; run
after copy-assets.py, sync-content.py and add-fame.py (all call it). Cards are only redrawn when the art or caption changes;
pages and cards for items that left the site are removed.
"""
from datetime import datetime
from html import escape
from io import BytesIO
import hashlib
from pathlib import Path
import json
import re
import subprocess

from PIL import Image, ImageDraw, ImageFont

SITE = Path(__file__).resolve().parents[1]
ASSETS = SITE / 'assets'
OUT = SITE / 's'
CARDS = OUT / 'img'
ORIGIN = 'https://duk.fun/'
W, H = 1200, 630
BLUE, INK, ORANGE, CREAM = (0, 162, 232), (17, 17, 17), (255, 127, 39), (255, 249, 231)
FONTS = Path('C:/Windows/Fonts')
ART_BOX = (560, 36, 600, 558)  # x, y, w, h
TEXT_W = 460
CARD_VERSION = 4  # bump when card() changes: every card is redrawn on the next run
FRAME_AT = 1.5  # seconds into a clip for its card (sync-content.py posters use the same moment)


def ffmpeg() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return 'ffmpeg'


def open_art(path: Path) -> Image.Image:
    """Still art as RGB; a clip gives its full-size frame at FRAME_AT (the published posters are only 480px)."""
    if path.suffix.lower() in ('.mp4', '.webm'):
        frame = subprocess.run([ffmpeg(), '-hide_banner', '-loglevel', 'error', '-ss', str(FRAME_AT), '-i', str(path),
                                '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True, check=True)
        return Image.open(BytesIO(frame.stdout)).convert('RGB')
    with Image.open(path) as source:
        return source.convert('RGB')


def slug(src: str) -> str:
    rel = re.sub(r'^assets/', '', src)
    return re.sub(r'[^\w-]', '-', re.sub(r'\.[^./]+$', '', rel).replace('/', '-'), flags=re.ASCII)


def stem_id(prefix: str, src: str) -> str:
    """media.js stemId(): '<prefix>-<file name without extension>'."""
    return f"{prefix}-{re.sub(r'[^\w-]+', '-', re.sub(r'\.[^.]+$', '', src.split('/')[-1]), flags=re.ASCII)}"


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


def wrap(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont, width: int) -> list:
    lines, line = [], ''
    for word in text.split():
        candidate = f'{line} {word}'.strip()
        if line and draw.textlength(candidate, font=face) > width:
            lines.append(line)
            line = word
        else:
            line = candidate
    return lines + [line] if line else lines


def fit(draw: ImageDraw.ImageDraw, text: str, width: int, height: int, largest: int, smallest: int) -> tuple:
    """Biggest bold size (stepping by 4) whose wrapped lines fit the box -> (font, size, lines)."""
    size = largest
    while True:
        face = font('comicbd.ttf', size)
        lines = wrap(draw, text, face, width)
        if len(lines) * size * 1.2 <= height or size - 4 < smallest:
            return face, size, lines[:max(1, int(height // (size * 1.2)))]
        size -= 4


def card(art_path: Path, caption: str, video: bool) -> Image.Image:
    """Square-ish art: caption left, art right. Wide art (strips, 16:9 clips): caption + tag on top, art below."""
    image = Image.new('RGB', (W, H), BLUE)
    art = open_art(art_path)
    wide = art.width / art.height >= 1.5
    x, y, w, h = (36, 136, W - 72, H - 160) if wide else ART_BOX
    # Fill the box; small art (480px gif posters) may grow up to 2x.
    scale = min((w - 12) / art.width, (h - 12) / art.height, 2.0)
    if scale != 1:
        art = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    framed = Image.new('RGB', (art.width + 12, art.height + 12), INK)
    framed.paste(art, (6, 6))
    left, top = x + (w - framed.width) // 2, y + (h - framed.height) // 2
    image.paste(framed, (left, top))
    draw = ImageDraw.Draw(image)
    if video:
        # Play badge in the art's bottom-left corner, clear of his face.
        cx, cy, r = left + 64, top + framed.height - 64, 44
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=CREAM, outline=INK, width=6)
        draw.polygon([(cx - 13, cy - 23), (cx - 13, cy + 23), (cx + 25, cy)], fill=INK)
    caption = re.sub(r'\s*\$duk\s*$', '', caption, flags=re.I) or 'just duk.'
    tag = font('comicbd.ttf', 34)
    label = 'duk.fun  /  $DUK'
    width = draw.textlength(label, font=tag)
    if wide:
        draw.text((40, 30), 'duk.', font=font('comicbd.ttf', 56), fill=CREAM, stroke_width=4, stroke_fill=INK)
        tag_x = W - 40 - width - 40
        face, size, lines = fit(draw, caption, int(tag_x - 200 - 24), 100, 48, 26)
        for i, line in enumerate(lines):
            draw.text((200, 32 + i * size * 1.2), line, font=face, fill=INK)
        draw.rounded_rectangle((tag_x, 36, tag_x + width + 40, 100), radius=6, fill=ORANGE, outline=INK, width=4)
        draw.text((tag_x + 20, 44), label, font=tag, fill=INK)
        return image
    draw.text((56, 40), 'duk.', font=font('comicbd.ttf', 56), fill=CREAM, stroke_width=4, stroke_fill=INK)
    face, size, lines = fit(draw, caption, TEXT_W, 330, 64, 34)
    for i, line in enumerate(lines):
        draw.text((56, 140 + i * size * 1.2), line, font=face, fill=INK)
    draw.rounded_rectangle((48, 520, 48 + width + 40, 584), radius=6, fill=ORANGE, outline=INK, width=4)
    draw.text((68, 528), label, font=tag, fill=INK)
    return image


def page(name: str, title: str, alt: str, target: str, version: str) -> str:
    t, a = escape(title), escape(alt)
    image = f'{ORIGIN}s/img/{name}.jpg?v={version}'
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{t} / duk.</title>
  <meta name="robots" content="noindex">
  <meta name="duk-card" content="{CARD_VERSION}">
  <meta name="description" content="{a}">
  <meta property="og:title" content="{t}">
  <meta property="og:description" content="just duk. $DUK">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{ORIGIN}s/{name}.html">
  <meta property="og:image" content="{image}">
  <meta property="og:image:width" content="{W}">
  <meta property="og:image:height" content="{H}">
  <meta property="og:image:alt" content="{a}">
  <meta property="og:site_name" content="duk.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{t}">
  <meta name="twitter:description" content="just duk. $DUK">
  <meta name="twitter:image" content="{image}">
  <meta name="twitter:image:alt" content="{a}">
  <meta name="twitter:site" content="@justdukfun">
  <meta http-equiv="refresh" content="0; url=../{escape(target)}">
  <script>location.replace({json.dumps('../' + target)});</script>
</head>
<body><p><a href="../{escape(target)}">{t}</a></p></body>
</html>
'''


def items() -> list:
    """(slug, caption, alt, art path, moving, target) for every meme, clip, reaction gif and comic the site shows."""
    media = json.loads((ASSETS / 'media.json').read_text(encoding='utf-8'))
    content_file = ASSETS / 'content.json'
    fresh = json.loads(content_file.read_text(encoding='utf-8')) if content_file.is_file() else {}
    config = (ASSETS / 'config.js').read_text(encoding='utf-8')
    block = re.search(r'memes:\s*\[(.*?)\]', config, re.S)
    config_memes = [{'src': src, 'title': title, 'alt': alt} for src, title, alt in re.findall(
        r"src:\s*'([^']+)',\s*title:\s*'([^']*)',\s*alt:\s*'([^']*)'", block.group(1) if block else '')]
    found, seen = [], set()

    def add(src: str, entry: dict, art: str, moving: bool, target: str) -> None:
        if not src or src in seen or not art or not (SITE / art).is_file():
            return
        seen.add(src)
        title = str(entry.get('title') or 'just duk.').strip()
        found.append((slug(src), title, str(entry.get('alt') or title).strip(), SITE / art, moving, target))

    for entry in config_memes + list(fresh.get('memes', [])) + list(media.get('memes', [])):
        src = entry.get('src') or ''
        add(src, entry, src, False, f"memes.html#{re.sub(r'^assets/', '', src)}")
    for entry in list(fresh.get('clips', [])) + list((media.get('videos') or {}).get('clips', [])):
        src = entry.get('src') or ''
        add(src, entry, src, True, f"watch.html#{stem_id('clip', src)}")
    for entry in list(fresh.get('gifs', [])) + list(media.get('gifs', [])):
        src = entry.get('gif') or entry.get('mp4') or ''
        add(src, entry, entry.get('poster') or entry.get('gif'), True, f"stickers.html#{stem_id('gif', src)}")
    for entry in list(media.get('comics', [])) + list(fresh.get('comics', [])):
        src = entry.get('src') or ''
        # collections.js strip id: 'strip-' + file name lowercased, extension dropped, [^a-z0-9]+ -> '-'.
        name = re.sub(r'\.[a-z0-9]+$', '', str(entry.get('file') or src.split('/')[-1]).strip().lower())
        add(src, entry, src, False, f"comics.html#strip-{re.sub(r'[^a-z0-9]+', '-', name).strip('-')}")
    # Wall of fame (scripts/add-fame.py): credited on the card; fame.js builds the same 'fame-<id>' anchor.
    fame_file = ASSETS / 'fame.json'
    for entry in json.loads(fame_file.read_text(encoding='utf-8')).get('entries', []) if fame_file.is_file() else []:
        credit = f"{entry.get('caption') or 'on the wall of fame.'} by @{entry['by']}"
        art = entry['thumb'] if entry.get('kind') == 'gif' else entry['src']
        add(entry['src'], {'title': credit, 'alt': entry.get('alt')}, art, entry.get('kind') != 'image', f"fame.html#fame-{entry['id']}")
    # Duk of the day (scripts/daily.py): one card per recorded day, s/daily-<date>.html -> daily.html#day-<date>.
    daily_file = ASSETS / 'daily.json'
    for day in json.loads(daily_file.read_text(encoding='utf-8')).get('days', []) if daily_file.is_file() else []:
        date = datetime.strptime(day['date'], '%Y-%m-%d')
        title = f"duk of the day, {date:%b} {date.day}. {day.get('title') or 'just duk.'}".lower()
        add(f"daily/{day['date']}", {'title': title, 'alt': day.get('alt')}, day['src'], False, f"daily.html#day-{day['date']}")
    return found


def main() -> None:
    CARDS.mkdir(parents=True, exist_ok=True)
    keep, drawn, written = set(), 0, 0
    for name, title, alt, art, video, target in items():
        html_path, jpg_path = OUT / f'{name}.html', CARDS / f'{name}.jpg'
        old = html_path.read_text(encoding='utf-8') if html_path.is_file() else ''
        stale_card = not jpg_path.is_file() or jpg_path.stat().st_mtime < art.stat().st_mtime
        if stale_card or f'<title>{escape(title)} / duk.</title>' not in old or f'"duk-card" content="{CARD_VERSION}"' not in old:
            try:
                card(art, title, video).save(jpg_path, quality=82, optimize=True, progressive=True)
                drawn += 1
            except (OSError, subprocess.CalledProcessError) as error:
                # One unreadable clip (still being written, too short) must not stop the sync: skip it this run.
                print(f'share pages: skipped {name}: {error}')
                if not jpg_path.is_file():
                    continue
        # The card's hash rides on its url: x caches card images by url, so a redrawn card gets a new one.
        html = page(name, title, alt, target, hashlib.sha1(jpg_path.read_bytes()).hexdigest()[:8])
        if old != html:
            html_path.write_text(html, encoding='utf-8', newline='\n')
            written += 1
        keep.update({html_path, jpg_path})
    removed = [path for path in list(OUT.glob('*.html')) + list(CARDS.glob('*.jpg')) if path not in keep]
    for path in removed:
        path.unlink()
    print(f'share pages: {len(keep) // 2} ({written} written, {drawn} cards drawn, {len(removed)} removed)')


if __name__ == '__main__':
    main()
