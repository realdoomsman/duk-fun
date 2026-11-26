"""The drops feed: python site/scripts/feed.py -> site/feed.xml (RSS 2.0; sync-content.py runs it every pass).

The newest fresh drops in assets/content.json (memes, clips, reaction gifs and comics, by 'created') plus every recorded
duk of the day (assets/daily.json), newest first. Each item links to its share page (scripts/share-pages.py), which
shows that piece's card and forwards to it on the site; the card is the enclosure. lastBuildDate is the newest item's
date and the file is only written when it changes, so a pass with nothing new leaves it alone.
"""
from datetime import datetime, timezone
from email.utils import format_datetime
from html import escape
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import json

SITE = Path(__file__).resolve().parents[1]
ASSETS = SITE / 'assets'
OUT = SITE / 'feed.xml'
ORIGIN = 'https://duk.fun/'
LIMIT = 80  # newest drops kept; every recorded duk of the day stays in on top of these

_spec = spec_from_file_location('share_pages', SITE / 'scripts' / 'share-pages.py')
share = module_from_spec(_spec)
_spec.loader.exec_module(share)

KINDS = (('memes', 'meme', 'src'), ('clips', 'clip', 'src'), ('gifs', 'reaction gif', 'gif'), ('comics', 'comic', 'src'))


def read(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8')) if path.is_file() else {}


def items() -> list:
    """(when, title, slug, picture, alt, kind) newest first: the newest LIMIT drops plus every duk of the day."""
    drops, days = [], []
    content = read(ASSETS / 'content.json')
    for key, kind, field in KINDS:
        for entry in content.get(key, []):
            src = entry.get(field) or entry.get('mp4') or entry.get('src')
            if not src or not entry.get('created'):
                continue
            when = datetime.strptime(entry['created'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
            picture = entry.get('thumb') or entry.get('poster') or src
            drops.append((when, str(entry.get('title') or 'just duk.'), share.slug(src), picture, str(entry.get('alt') or ''), kind))
    for day in read(ASSETS / 'daily.json').get('days', []):
        when = datetime.strptime(day['date'], '%Y-%m-%d').replace(tzinfo=timezone.utc)
        title = f"duk of the day, {when:%b} {when.day}. {day.get('title') or 'just duk.'}".lower()
        days.append((when, title, f"daily-{day['date']}", day.get('thumb') or day['src'], str(day.get('alt') or ''), 'duk of the day'))
    drops.sort(key=lambda item: item[0], reverse=True)
    return sorted(drops[:LIMIT] + days, key=lambda item: item[0], reverse=True)


def item_xml(when, title, slug, picture, alt, kind) -> str:
    link = f'{ORIGIN}s/{slug}.html'
    card = SITE / 's' / 'img' / f'{slug}.jpg'
    enclosure = (f'\n      <enclosure url="{ORIGIN}s/img/{slug}.jpg" length="{card.stat().st_size}" type="image/jpeg"/>'
                 if card.is_file() else '')
    body = f'<p><img src="{escape(ORIGIN + picture)}" alt="{escape(alt)}"></p><p>{escape(alt)}</p>'
    return f'''    <item>
      <title>{escape(title)}</title>
      <link>{link}</link>
      <guid isPermaLink="true">{link}</guid>
      <pubDate>{format_datetime(when)}</pubDate>
      <category>{kind}</category>
      <description>{escape(body)}</description>{enclosure}
    </item>'''


def main() -> None:
    found = items()
    built = format_datetime(found[0][0] if found else datetime(2026, 11, 26, tzinfo=timezone.utc))
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>duk. fresh drops</title>
    <link>{ORIGIN}</link>
    <atom:link href="{ORIGIN}feed.xml" rel="self" type="application/rss+xml"/>
    <description>new duk memes, clips, reaction gifs, comics and the duk of the day, as they land. just duk. $DUK</description>
    <language>en</language>
    <lastBuildDate>{built}</lastBuildDate>
    <image>
      <url>{ORIGIN}assets/icons/icon-192.png</url>
      <title>duk. fresh drops</title>
      <link>{ORIGIN}</link>
    </image>
{chr(10).join(item_xml(*item) for item in found)}
  </channel>
</rss>
'''
    old = OUT.read_text(encoding='utf-8') if OUT.is_file() else ''
    if xml != old:
        OUT.write_text(xml, encoding='utf-8', newline='\n')
    print(f"feed.xml: {len(found)} items{' (written)' if xml != old else ' (no change)'}")


if __name__ == '__main__':
    main()
