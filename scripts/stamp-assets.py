"""Cache-bust the site's own css/js: python site/scripts/stamp-assets.py

GitHub Pages lets browsers keep css/js for ten minutes, so a deploy can pair new html with old styles.
Every local stylesheet/script reference in the pages gets ?v=<first 8 hex of its content hash>; run this
before committing a css/js change. Unchanged files keep their stamp, so the html only changes when they do.
"""
from hashlib import sha256
from pathlib import Path
import re

SITE = Path(__file__).resolve().parents[1]
REFERENCE = re.compile(r'(?P<attr>href|src)="(?P<path>/?[\w./-]+\.(?:css|js))(?:\?v=[0-9a-f]*)?"')


def stamp(match: re.Match) -> str:
    path = match['path']
    target = SITE / path.lstrip('/')
    if not target.is_file():
        return match[0]
    digest = sha256(target.read_bytes()).hexdigest()[:8]
    return f'{match["attr"]}="{path}?v={digest}"'


def main() -> None:
    changed = []
    for page in sorted(SITE.glob('*.html')):
        text = page.read_bytes().decode('utf-8')
        stamped = REFERENCE.sub(stamp, text)
        if stamped != text:
            page.write_bytes(stamped.encode('utf-8'))
            changed.append(page.name)
    print(f"stamped: {', '.join(changed) if changed else 'nothing changed'}")


if __name__ == '__main__':
    main()
