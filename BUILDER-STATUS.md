# duk.fun builder status

Owner: DukSiteBuilder. Newest first.

## 2026-11-26

- **maker v2** (maker.html / maker.js / maker.css): 20 blank kit templates join the base library (full-bleed, outlined text by default),
  words are lowercased in the paint font, top/bottom text and stickers drag on the canvas, corner handle + size slider resize,
  sticker tray (duk sprites, problems, and every static sticker pack), text color picker, layer select + keyboard (arrows, +/-, delete),
  png download (selection box never exported), post-on-x intent with the caption + `just duk. $DUK https://duk.fun/maker.html`.
- **content sync**: `python site/scripts/sync-content.py [--push]` publishes memes4/ + comics2/ (DukFactory) and videos/clips2/ + gifs2/
  (DukVideo) into assets/, writes assets/content.json (captions from x/queue-factory.jsonl and work/clips2/shipped.json),
  makes 480px webp thumbs, gif->mp4 twins and webp posters, prunes removed files, and with --push commits only those paths and pushes.
  Pages read media.json + content.json through `window.dukMedia()` in app.js (fresh memes/gifs/clips first, fresh comics appended).
