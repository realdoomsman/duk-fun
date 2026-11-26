"""The sitemap: python site/scripts/sitemap.py -> site/sitemap.xml (sync-content.py runs it every pass).

Each page's <lastmod> (a utc date) is the newest of: the last commit touching the page or the local css/js it loads
(a file with uncommitted edits counts as changed today), and the newest drop it shows (content.json 'created' per kind,
daily.json days, fame.json 'added'). The file is only written when it changes, so a quiet pass leaves it alone.
"""
from datetime import datetime, timezone
from pathlib import Path
import json
import re
import subprocess

SITE = Path(__file__).resolve().parents[1]
ASSETS = SITE / 'assets'
OUT = SITE / 'sitemap.xml'
ORIGIN = 'https://duk.fun/'
# (page, changefreq, drops it shows: content.json kinds plus 'daily' / 'fame')
PAGES = (
    ('index.html', 'daily', ('memes', 'clips', 'gifs', 'comics', 'daily', 'fame')),
    ('memes.html', 'hourly', ('memes',)),
    ('maker.html', 'weekly', ()),
    ('watch.html', 'daily', ('clips',)),
    ('stickers.html', 'daily', ('gifs',)),
    ('comics.html', 'daily', ('comics',)),
    ('pool.html', 'daily', ()),
    ('cult.html', 'weekly', ()),
    ('kit.html', 'weekly', ()),
    ('manual.html', 'monthly', ()),
    ('buy.html', 'monthly', ()),
    ('fame.html', 'daily', ('fame',)),
    ('daily.html', 'daily', ('daily',)),
    ('press.html', 'monthly', ()),
)
LOCAL_REF = re.compile(r'(?:src|href)="([\w./-]+\.(?:css|js))(?:\?[^"]*)?"')


def read(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8')) if path.is_file() else {}


def changed(paths: list) -> str:
    """Date of the newest commit touching paths, or today when one of them has uncommitted edits."""
    def git(*args):
        return subprocess.run(['git', '-C', str(SITE), *args, '--', *paths], capture_output=True, text=True).stdout.strip()
    if git('status', '--porcelain'):
        return datetime.now(timezone.utc).strftime('%Y-%m-%d')
    stamp = git('log', '-1', '--format=%cI')
    return datetime.fromisoformat(stamp).astimezone(timezone.utc).strftime('%Y-%m-%d') if stamp else ''


def drops() -> dict:
    """Newest utc date per kind of drop."""
    content = read(ASSETS / 'content.json')
    newest = {kind: max((entry.get('created', '')[:10] for entry in content.get(kind, [])), default='')
              for kind in ('memes', 'clips', 'gifs', 'comics')}
    newest['daily'] = max((day.get('date', '') for day in read(ASSETS / 'daily.json').get('days', [])), default='')
    newest['fame'] = max((entry.get('added', '')[:10] for entry in read(ASSETS / 'fame.json').get('entries', [])), default='')
    return newest


def main() -> None:
    newest = drops()
    rows = []
    for page, freq, shows in PAGES:
        html = (SITE / page).read_text(encoding='utf-8')
        files = [page] + sorted({ref for ref in LOCAL_REF.findall(html) if (SITE / ref).is_file()})
        lastmod = max([changed(files)] + [newest[kind] for kind in shows])
        loc = ORIGIN if page == 'index.html' else ORIGIN + page
        rows.append(f'  <url><loc>{loc}</loc>' + (f'<lastmod>{lastmod}</lastmod>' if lastmod else '')
                    + f'<changefreq>{freq}</changefreq></url>')
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + '\n'.join(rows) + '\n</urlset>\n')
    if OUT.is_file() and OUT.read_text(encoding='utf-8') == xml:
        print('sitemap.xml: no change')
        return
    OUT.write_text(xml, encoding='utf-8', newline='\n')
    print(f'sitemap.xml: {len(rows)} pages')


if __name__ == '__main__':
    main()
