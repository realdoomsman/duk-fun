# duk.fun builder status

Owner: DukSiteBuilder. Newest first.

## 2026-11-26
- **speed**: 480px webp thumbs for every meme grid (archive, cult, pool, maker, home) and 320px webp sticker previews,
  made by copy-assets.py / sync-content.py; downloads keep the original png. Static sticker previews ~5.4MB -> 1.4MB.
- **mobile**: every page checked at 390px in chromium (no horizontal overflow); watch keeps two clip columns on phones.
- **share cards**: `python site/scripts/make-og.py` -> assets/og/<page>.png from the paint sprites; each page's og/twitter image points at its card.
- **duk hour clock** on home (21:00 utc daily, hh:mm:ss countdown, local time line, flips to "post duk. on x" for the 10-minute window).
- **sync schedule**: Windows task `duk-site-sync` runs work/site-sync.bat every 45 min (log work/site-sync.log). clips2 publish to assets/clips2
  because copy-assets.py rebuilds assets/videos from scratch.

- **maker v2** (maker.html / maker.js / maker.css): 20 blank kit templates join the base library (full-bleed, outlined text by default),
  words are lowercased in the paint font, top/bottom text and stickers drag on the canvas, corner handle + size slider resize,
  sticker tray (duk sprites, problems, and every static sticker pack), text color picker, layer select + keyboard (arrows, +/-, delete),
  png download (selection box never exported), post-on-x intent with the caption + `just duk. $DUK https://duk.fun/maker.html`.
- **content sync**: `python site/scripts/sync-content.py [--push]` publishes memes4/ + comics2/ (DukFactory) and videos/clips2/ + gifs2/
  (DukVideo) into assets/, writes assets/content.json (captions from x/queue-factory.jsonl and work/clips2/shipped.json),
  makes 480px webp thumbs, gif->mp4 twins and webp posters, prunes removed files, and with --push commits only those paths and pushes.
  Pages read media.json + content.json through `window.dukMedia()` in app.js (fresh memes/gifs/clips first, fresh comics appended).
