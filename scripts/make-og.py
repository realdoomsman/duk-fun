"""Per-page share cards: python site/scripts/make-og.py -> site/assets/og/<page>.png (1200x630).

Built only from the published paint sprites and memes plus Comic Sans, so the cards stay in the locked style.
The home page keeps assets/og-1200x630.png.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SITE = Path(__file__).resolve().parents[1]
ASSETS = SITE / 'assets'
OUT = ASSETS / 'og'
W, H = 1200, 630
BLUE, INK, ORANGE, CREAM = (0, 162, 232), (17, 17, 17), (255, 127, 39), (255, 249, 231)
FONTS = Path('C:/Windows/Fonts')

# page -> (title, subtitle, [(asset, box (x, y, w, h), degrees, framed)])
PAGES = {
    'memes': ('the archive.', 'every duk meme. free to take.', [
        ('memes/11_ducked.png', (730, 40, 260, 260), 6, True),
        ('memes/14_duk_stare.png', (920, 180, 250, 250), -5, True),
        ('memes/23_candle_rain.png', (720, 330, 250, 250), -3, True)]),
    'comics': ('duk comics.', 'something bad happens. he lies down.', [('hit.png', (680, 190, 500, 420), 0, False)]),
    'pool': ('the pool.', 'fees went in. lp burned. he floats.', [('float.png', (600, 150, 560, 380), 0, False)]),
    'cult': ('the cult.', 'say duk back.', [('stand.png', (760, 60, 380, 520), 0, False)]),
    'stickers': ('stickers.', 'for replying to people.', [
        ('stickers/react/18_noted.png', (620, 60, 280, 280), -6, False),
        ('stickers/react/20_side_eye.png', (880, 110, 280, 280), 5, False),
        ('stickers/react/36_i_see.png', (740, 320, 280, 280), 2, False)]),
    'watch': ('duk tv.', 'a lot happens. he doesn\'t.', [('videos/duk-trailer-poster.jpg', (690, 80, 440, 440), 3, True)]),
    'kit': ('the kit.', 'pfps, banners, blank templates.', [('memes/pfp.png', (720, 70, 430, 430), -3, True)]),
    'maker': ('make a duk.', 'your problem. his position.', [
        ('obj_rent.png', (790, 40, 260, 210), -10, False),
        ('ducking.png', (600, 260, 560, 340), 0, False)]),
    'manual': ('the manual.', 'the long version, with the faq.', [('ducking.png', (620, 200, 540, 330), 0, False)]),
    'buy': ('how to buy.', 'wallet, sol, the real ca. then duk.', [
        ('obj_rent.png', (690, 50, 220, 180), -8, False),
        ('stand.png', (840, 90, 320, 500), 0, False)]),
    'fame': ('the wall of fame.', 'stuff the cult made.', [
        ('memes/pfp.png', (690, 60, 250, 250), -6, True),
        ('stand.png', (900, 110, 270, 470), 0, False)]),
    'daily': ('duk of the day.', 'one a day. same one for everyone.', [
        ('memes/05_monday.png', (700, 50, 230, 230), -6, True),
        ('memes/08_capitulation.png', (920, 150, 240, 240), 4, True),
        ('memes/21_bedtime.png', (730, 320, 240, 240), -2, True)]),
    'press': ('press kit.', 'the story, the facts, the art.', [
        ('logo.png', (700, 60, 440, 200), -4, False),
        ('ducking.png', (640, 300, 520, 310), 0, False)]),
}


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


def paste(card: Image.Image, asset: str, box: tuple, degrees: float, framed: bool) -> None:
    x, y, w, h = box
    with Image.open(ASSETS / asset) as source:
        art = source.convert('RGBA')
    art.thumbnail((w, h), Image.LANCZOS)
    if framed:
        border = 6
        frame = Image.new('RGBA', (art.width + border * 2, art.height + border * 2), INK + (255,))
        frame.paste(art, (border, border), art)
        art = frame
    if degrees:
        art = art.rotate(degrees, resample=Image.BICUBIC, expand=True)
    card.alpha_composite(art, (x + (w - art.width) // 2, y + (h - art.height) // 2))


def card(title: str, subtitle: str, art: list) -> Image.Image:
    image = Image.new('RGBA', (W, H), BLUE + (255,))
    for item in art:
        paste(image, *item)
    draw = ImageDraw.Draw(image)
    size = 120
    while draw.textlength(title, font=font('comicbd.ttf', size)) > 600 and size > 60:
        size -= 4
    draw.text((60, 150), title, font=font('comicbd.ttf', size), fill=INK)
    draw.text((64, 160 + size + 20), subtitle, font=font('comic.ttf', 40), fill=INK)
    tag = font('comicbd.ttf', 34)
    label = 'duk.fun  /  $DUK'
    width = draw.textlength(label, font=tag)
    draw.rounded_rectangle((52, 520, 52 + width + 40, 584), radius=6, fill=ORANGE, outline=INK, width=4)
    draw.text((72, 528), label, font=tag, fill=INK)
    draw.text((60, 50), 'duk.', font=font('comicbd.ttf', 56), fill=CREAM, stroke_width=4, stroke_fill=INK)
    return image


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for page, (title, subtitle, art) in PAGES.items():
        target = OUT / f'{page}.png'
        card(title, subtitle, art).convert('RGB').quantize(colors=128, method=Image.MEDIANCUT).save(target, optimize=True)
        print(f'{target.relative_to(SITE).as_posix()} {target.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
