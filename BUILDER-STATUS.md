# duk.fun builder status

Owner: DukSiteBuilder. Newest first.

## 2026-11-27
- **reserve**: pool.html shows only the live number, "reserve: <wallet_duk from the keeper /log> duk", plus one line: that's the bot's
  reserve, it never goes in the pool, everything else from fees goes in the pool and the lp is burned. No target, fixed figure,
  percent, progress or "refilling". Reserve counters and the dev supply paragraph are gone; index pool card and manual say "it keeps a reserve".
- **wall of fame cards**: "share" on touch screens (png for images, the mp4 for gifs/clips) and "copy image" on computers (images).
- **thumb retry**: any lazy picture that fails to load (github pages burst 503s) tries once more after 1.5 s: one capture-phase
  listener in app.js covers the meme, sticker, gif and clip grids, the wall and fame. Video posters (gif grids, home wall gifs,
  fame videos) load through `window.dukPoster(video, src)`: an Image with the same single retry, then set as the poster.
- **duk, in your feed** (home, after the wall of fame): the 4 newest instagram/tiktok posts from DukSocials' social/post-log.jsonl
  (stories left out: they only link the profile). `scripts/social.py` -> assets/social.json + assets/social/<id>.webp (400px, first
  picture or a reel frame), content rule applied to captions/names; sync-content.py runs it every pass and publishes both.
- **formats 70**: + the returns desk, the board and the sign, the vault, the inbox, the river bank (memes4 135/136/138/140/142),
  the door, the screen, the decoys, the two boards, the ice (143/146/148/149/150), the four signs, the robots, the traffic light
  (152-154), the balloons, the dictionary, the two windows (155/156/158), the podium, the support group, the shelves, the list,
  the bus (160/161/163/167/182).

## 2026-11-26
- **picture into the post** (memes dialog, comics dialog, duk of the day): mouse screens get "copy image" (png to the clipboard, paste
  into the x draft), touch screens get "share" (the png + the post words to the share sheet: x app, telegram, messages).
  One shows, whichever the browser supports. Shared helper app.js `dukPictureButtons(share, copy, piece)`;
  `dukPostText` is the post words, `dukPostHref` wraps it as the x draft. Reaction gif cards (stickers) and clip cards
  (watch) get "share" on touch screens: the gif / mp4 file itself to the share sheet (no copy button: clipboards take
  png only). If a slow download outlasts the tap, the button says "ready. tap share again".
- **post the receipts** (pool.html, next to "check again"): x intent "fees go in the pool. N adds today. the lp from each
  one gets burned. receipts: https://duk.fun/pool.html" (total adds when today has none yet), shown once there are adds.
  Phones (<=480px): the pool counters stack as rows so long numbers stop wrapping mid-number.
- **sitemap dates**: scripts/sitemap.py writes sitemap.xml with a `<lastmod>` per page (newest of the page's last commit,
  incl. the css/js it loads, and the newest drop it shows: content.json kinds, daily.json, fame.json); every sync runs it
  after feed.py and publishes sitemap.xml. Written only on change.
- **pool card goes live**: the home "the pool." card shows "N adds today (utc). newest X min ago." from the keeper's
  `/log?limit=0` (daily row for today + newest `recent` timestamp), refreshed every two minutes; hidden while the keeper
  restarts or isn't adding.
- **pool chart v2**: pool.js now polls `/log?limit=0` every two minutes (~3 KB gzip instead of the whole ledger) and
  charts the keeper's `hourly` (last 48 hours, starting at the first add) and `daily` summaries: running total + each
  hour's/day's amount, toggles for span and sol/duk/lp. While the keeper restarts (`last_run` null, it reports zeros
  until it has re-read the chain) the page keeps the numbers it had and rechecks in 30 s.
- **content rule covers file names**: sync-content.py now runs OFF_RULE over each file's stem too (names show up in urls,
  share pages and downloads). It caught clips2/022_back_above_60k.mp4, which is off the site until it's renamed
  (DukVideo asked to rename it).
- **rss feed**: duk.fun/feed.xml (scripts/feed.py, run by every sync after share-pages): the newest 80 drops from
  content.json plus every duk of the day, each linking its share page with the card as enclosure. Advertised with
  `<link rel="alternate" type="application/rss+xml">` on home, memes, watch, stickers, comics, daily and press (linked there).
- **4 more blank formats** (34): the island (087), the roadmap (088), the swing (089), four of him (090), in the kit and
  the maker with their word spots.
- **link previews**: every page now carries og:site_name, og:image width/height/alt, twitter:image:alt and twitter:site
  (@justdukfun); stamp-assets.py also stamps the og/twitter image urls with ?v=<hash> so x, discord and telegram fetch a
  redrawn card instead of the cached one. Share pages (s/) get og:site_name + twitter:site on the next sync run.
- **press kit** (press.html, press.css, press.js) for kols, hosts and writers: the story in three lengths with copy buttons
  (one line / one post / one paragraph), the facts (ticker, chain, ca with copy, the pool in the approved wording, the greeting,
  duk hour, links), the main art with downloads, the look (colors, style rules) and "please don't" (no prices, no floor talk,
  no other coins). `python scripts/press-kit.py` builds assets/press/duk-press-kit.zip (the art + story.txt read out of
  press.html's [data-press-text] blocks): rerun it after changing those words or the art. Linked from every footer and the kit.
- **pool chart**: pool.html "every add, over time": running total of what the keeper put in (sol / duk / lp burned), one step
  per add, each add as a bar underneath; point, tap or arrow-key through the adds for time, size, running total and receipt.
  Built from every `deposit` in the keeper's /log `transactions` (the full ledger; `recent` stops at 20).
- **pause for looping gifs**: home wall and wall of fame gifs get the same play/pause button the sticker pages have
  (app.js `dukLoopToggle` + `dukWatchLoop`, shared by media.js); a pause by hand sticks while scrolling.
- **home screen app**: manifest.webmanifest (standalone, paint-blue, icons in assets/icons/ from the pfp, shortcuts: duk of the
  day / make a duk / memes) + apple-touch-icon on every page; chromium reports it installable with no errors. When the browser
  offers an install, home and daily.html show "put duk on your home screen" (beforeinstallprompt).
- **duk of the day cards**: every recorded day gets s/daily-<date>.html + a card ("duk of the day, nov 26. <caption>") that lands
  on daily.html#day-<date>; the daily page's "post it" and the duk hour "post duk. on x" link it (window.dukDailyShare; a day the
  sync hasn't recorded yet falls back to the meme's own card). The sync now runs daily.py before share-pages.py.
- **3 more blank formats** (30): everyone moved (082), the settings menu (083), the stampede (086). Skipped 084 (menu board with a
  price column) and 085 (a board of green candles). **home wall of fame strip**: the 4 newest fame.json entries between the
  fresh wall and the clock; stays hidden while the wall is empty.
- **wall submissions**: maker posts now tag @justdukfun (`just duk. $duk @justdukfun https://duk.fun/maker.html`) so made duks
  land in the account's mentions; fame.html has "post yours for the wall" (x intent: "my duk for the wall of fame. @justdukfun").
- **duk hour in your calendar**: assets/duk-hour.ics (daily 21:00-21:10 utc, alarm at start; CRLF kept by .gitattributes
  `*.ics -text`) linked from the home clock, cult #duk-hour (plus a google calendar template link) and daily.html.
- **streak** on duk of the day: app.js counts utc days in a row this browser opened the site (localStorage `duk-streak`
  {last, days, best}); daily.html shows "day N in a row." (best so far when it's higher) and a "post your streak" x link
  ("day N of ducking in a row. duk." + daily.html).
- **since you were here**: app.js keeps the last visit per browser (localStorage `duk-last-visit`; a session holds the one before
  it in sessionStorage `duk-since`). Returning visitors get an orange "welcome back. since you were here: N memes, N clips and N
  reaction gifs." bar on home (each count links its page; memes -> memes.html?tag=new&since=<ms>). The archive's "new" filter and
  stamps now cover since-your-last-visit or the last day, whichever is longer (window.dukNewSince).
- **a11y + speed pass**: axe-core on all 14 pages: the only violations were nested `<aside>` landmarks (home greeting card, manual
  margin notes) -> now a plain div / `role="note"`; axe is clean everywhere. Trailer poster: copy-assets.py publishes a webp copy
  (assets/videos/thumbs/duk-trailer-poster.webp, 153KB -> 24KB) for watch + the home card; the jpg stays for the og card.
- **duk of the day** (daily.html, daily.js, daily.css): today's pick big (post it / remix it / download, countdown to the next one),
  then every day so far (daily.html#day-YYYY-MM-DD). `scripts/daily.py` writes each utc day's pick into assets/daily.json once
  (sync-content.py runs it every pass and publishes daily.json), so past days never change. Pick = curated media.json memes minus
  content-rule breakers, sorted by src, [(utc day * 7919) % n]; window.dukDaily() in app.js reads daily.json and makes the same pick
  for a day not recorded yet. The home clock's "today's duk" uses it and links daily.html. Footer link + home directory card (12 now).
- **wall of fame** (fame.html, fame.js, fame.css): holders' pieces from assets/fame.json, credited (@handle, their post, "post it"
  with a share card s/fame-<id>.html that lands on fame.html#fame-<id>). Add one by hand:
  `python scripts/add-fame.py <png|jpg|webp|gif|mp4> --by <handle> --post <x status url> --caption "..." [--alt "..."] --push`
  (copies to assets/fame/, webp thumb, gif -> looping mp4, refuses prices/%/other coins; `--remove <id>`, `--list`).
  Empty for now, with "how to get on it". Linked from the footer, a home directory card, the cult closing and the maker's post note.
  Home directory also got a "how to buy" card; the last card spans the row so no gaps at any count.
- **how to buy** (buy.html): wallet (phantom/solflare), sol, the real ca with copy, jupiter (sol -> duk filled in) and pump.fun,
  open-in-wallet links for phones, then "then duk." links; the rules (no dms, ca never changes). no prices. linked from every nav,
  the home hero and the faq; og card assets/og/buy.png; in the sitemap.
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
  (DukVideo) into assets/, writes assets/content.json (captions from x/queue-factory.jsonl and work/clips2/shipped.json; a later
  `<id>-vN` line in x/queue-video.jsonl overrides caption/topic for its file),
  makes 480px webp thumbs, gif->mp4 twins and webp posters, prunes removed files, and with --push commits only those paths and pushes.
  Pages read media.json + content.json through `window.dukMedia()` in app.js (fresh memes/gifs/clips first, fresh comics appended).
