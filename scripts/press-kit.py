"""Build assets/press/duk-press-kit.zip for press.html: the main art plus story.txt.

story.txt is read out of press.html itself (every [data-press-text] block, and the ca), so the page stays the one
place the words live. Fixed zip timestamps keep the file byte-identical when nothing changed.

    python scripts/press-kit.py
"""
from html.parser import HTMLParser
from pathlib import Path
import zipfile

SITE = Path(__file__).resolve().parent.parent
OUT = SITE / 'assets' / 'press' / 'duk-press-kit.zip'
ART = [
    ('assets/logo.png', 'duk-logo.png'),
    ('assets/memes/pfp.png', 'duk-pfp.png'),
    ('assets/ducking.png', 'duk-the-position.png'),
    ('assets/stand.png', 'duk-standing.png'),
    ('assets/banner-1500x500.png', 'duk-banner-1500x500.png'),
    ('assets/og-1200x630.png', 'duk-card-1200x630.png'),
]
STAMP = (2026, 11, 26, 0, 0, 0)


class Blocks(HTMLParser):
    """Text of every [data-press-text] element (in page order) and of #ca-soon."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocks: list[tuple[str, str]] = []
        self.ca = ''
        self.open: list[list] = []  # [name, tag, depth, parts]

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for block in self.open:
            if block[1] == tag:
                block[2] += 1
        if 'data-press-text' in attrs:
            self.open.append([attrs['data-press-text'], tag, 1, []])
        elif attrs.get('id') == 'ca-soon':
            self.open.append(['#ca', tag, 1, []])

    def handle_endtag(self, tag):
        for block in list(self.open):
            if block[1] != tag:
                continue
            block[2] -= 1
            if block[2] == 0:
                self.open.remove(block)
                text = ''.join(block[3]).strip()
                if block[0] == '#ca':
                    self.ca = text
                else:
                    self.blocks.append((block[0], text))

    def handle_data(self, data):
        for block in self.open:
            block[3].append(data)


def story() -> str:
    parser = Blocks()
    parser.feed((SITE / 'press.html').read_text(encoding='utf-8'))
    if not parser.blocks or not parser.ca:
        raise SystemExit('press.html: no [data-press-text] blocks or no #ca-soon')
    parts = ['duk. press kit\nhttps://duk.fun/press.html\n', f'ticker: $DUK\nchain: solana\nca: {parser.ca}\nx: https://x.com/justdukfun\n'
             'instagram: https://www.instagram.com/justdukfun/\n'
             'telegram stickers: https://t.me/addstickers/justduk https://t.me/addstickers/dukdaily '
             'https://t.me/addstickers/duktrench https://t.me/addstickers/dukmoves\n']
    parts += [f'{name}:\n{text}\n' for name, text in parser.blocks]
    return '\n'.join(parts).replace('\r\n', '\n')


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix('.tmp')
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as kit:
        info = zipfile.ZipInfo('duk-press-kit/story.txt', STAMP)
        info.compress_type = zipfile.ZIP_DEFLATED
        kit.writestr(info, story())
        for src, name in ART:
            info = zipfile.ZipInfo(f'duk-press-kit/{name}', STAMP)
            info.compress_type = zipfile.ZIP_STORED  # pngs are already compressed
            kit.writestr(info, (SITE / src).read_bytes())
    tmp.replace(OUT)
    print(f'{OUT.relative_to(SITE).as_posix()} {OUT.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
