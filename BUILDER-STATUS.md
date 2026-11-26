# duk.fun builder status

Owner: DukSiteBuilder. Newest first.

## 2026-11-26
- **today's duk** in the home duk hour clock: one archive meme a day (same for everyone); during duk hour "post duk. on x" links its
  share page, so every duk hour post shows that meme.
- **speed**: lazy images are really lazy now (loading set before src) and gif posters load near the viewport only.
  stickers page on a phone: 202 requests -> 34.
- **share pages**: `python scripts/share-pages.py` (run by copy-assets.py and every sync) writes s/<item>.html + s/img/<item>.jpg,
  a 1200x630 card for every meme, clip, reaction gif and comic strip. The "post on x" / "post it" links on memes, watch, stickers and
  comics point there, so a posted link shows that piece; opening it lands on the item (memes.html#<folder/file>, watch.html#clip-…,
  stickers.html#gif-…, comics.html#strip-…).
- **maker**: tap a word block (or pick it in "selected") to change its words in place. formats now 27.
- **fixed clips back**: clips 002 005 011 018 022 and gif 005 were re-rendered clean and are published again with their -v2 captions
  (sync reads x/queue-video.jsonl; the latest line per base id wins). original 003 and gif 003 stay blocked.
- **content rule in the sync**: sync-content.py skips anything in work/state/content-blocklist.txt and anything whose
  caption/topic/alt names another coin or a price, %, NNk or NNx (`allow <file>` lines let clean art through when only the
  research topic tripped it). Blocked items are pruned from assets/ on the next run.
- **the wall** on home: newest clip big, then memes, looping reaction gifs (on screen only, never with reduced motion) and clips that play in place.
- **new formats**: kit/make_formats.py re-renders memes4 drawings with the words switched off -> kit/formats/ (14 so far);
  kit page section "the new formats." and every template/format card has "fill it in" (opens it in the maker).
- **watch**: each clip has an id (watch.html#clip-<file>), a "post it" link and an "up next" button when it ends; one clip with sound at a time.
- **cache busting**: `python scripts/stamp-assets.py` stamps css/js references with ?v=<content hash>; run it before pushing css/js.
- **more words** in the maker: type, add, and a draggable block of words drops onto the picture. new formats carry `spots` (where the
  original meme had words, found by diffing the worded and blank renders in kit/make_formats.py), so each block lands on the next sign/note.
- **memes 'new' filter** (memes.html?tag=new: the last day's drops, orange stamp). **deep links**: watch.html#clip-<file>, stickers.html#gif-<file>;
  the wall's clip captions and gif tiles open them. formats now 21.
- **kit thumbs**: templates, formats and pfps get 480px webp thumbs (kit cards + maker base cards); the card still shows the real size.
- **remix it**: archive dialog button opens maker.html?base=<meme src>#maker with that meme picked as the base.
- **404.html** (paint style, links home/memes/maker), robots.txt, sitemap.xml. reaction gifs got first-frame webp posters.
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
