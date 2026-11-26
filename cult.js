// the cult page: copyable reply lines, duk hour in local time, and the collections rendered from media.json.
(() => {
  'use strict';
  const config = window.DUK_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined) continue;
      if (key === 'text') node.textContent = value;
      else if (key in node && key !== 'width' && key !== 'height') node[key] = value;
      else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
  };
  const say = (container, text) => container.replaceChildren(el('p', { className: 'cult-empty', text }));
  const fileName = (src) => src.split('/').pop();

  // reply lines: tap to copy.
  const replyStatus = $('reply-status');
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const line = button.dataset.copy;
      try {
        await navigator.clipboard.writeText(line);
        replyStatus.textContent = `copied: ${line}`;
      } catch {
        replyStatus.textContent = `couldn't copy it. type it instead: ${line}`;
      }
    });
  });

  // duk hour, converted. the countdown itself lives in the header (app.js).
  const [hourText, minuteText = '0'] = String(config.DUK_HOUR_UTC || '21:00').split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute));
    const end = new Date(start.getTime() + 10 * 60 * 1000);
    const utc = `${pad(hour)}:${pad(minute)} utc`;
    $('duk-hour-utc').textContent = utc;
    $('duk-hour-window').textContent = `${utc.slice(0, 5)}–${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())} utc`;
    const local = (date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    let zone = '';
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* no zone name. still duk hour. */ }
    $('duk-hour-local').textContent = `that's ${local(start)} to ${local(end)} where you are${zone ? ` (${zone.toLowerCase().replace(/_/g, ' ')})` : ''}. same ten minutes for everyone.`;
  }

  // the list: shown only when there is one.
  try {
    const list = new URL(String(config.X_LIST || ''));
    if (list.protocol === 'https:') {
      $('x-list-link').href = list.href;
      $('x-list').hidden = false;
    }
  } catch { /* no list yet. the box stays hidden. */ }

  const memeItem = (meme, caption) => el('a', { className: 'meme-item', href: meme.src }, [
    el('img', { src: meme.src, alt: meme.alt || meme.title || 'a duk meme', width: 1200, height: 1200, loading: 'lazy', decoding: 'async' }),
    el('span', {}, [caption || meme.title || 'duk.', el('b', { text: 'full size' })])
  ]);

  // the stare wall: picks from the react sticker pack first, reaction memes after.
  const STARES = ['noted', 'side_eye', 'i_see', 'no_comment', 'silence', 'judging', 'listening', 'not_my_problem', 'thinking', 'sleepy', 'popcorn', 'ok'];
  const PLACES = ['the floor', 'a group chat', 'a red candle', 'monday', 'your notifications', 'the timeline', 'a meeting', 'under a desk', 'the trenches', 'a bed', 'duk hour', 'everywhere'];
  const renderStares = (media) => {
    const wall = $('stare-wall');
    const packs = Array.isArray(media.stickerPacks) ? media.stickerPacks : [];
    const stills = packs.filter((pack) => pack && pack.id === 'react').flatMap((pack) => (Array.isArray(pack.items) ? pack.items : []))
      .filter((item) => item && item.src && (item.type === 'png' || item.type === 'webp'));
    const key = (item) => fileName(item.src).replace(/\.\w+$/, '').replace(/^\d+_/, '');
    const picked = [];
    for (const name of STARES) {
      const item = stills.find((sticker) => key(sticker) === name && !picked.includes(sticker));
      if (item) picked.push(item);
    }
    const stares = picked.map((item) => ({ src: item.src, alt: `duk. ${item.alt || 'staring.'}`, caption: item.alt || 'staring.', size: 512 }));
    const reactions = (Array.isArray(media.memes) ? media.memes : []).filter((meme) => meme.tag === 'reaction');
    for (const meme of reactions) {
      if (stares.length >= 12) break;
      stares.push({ src: meme.src, alt: meme.alt || meme.title, caption: meme.title || 'duk.', size: 1200 });
    }
    if (!stares.length) return say(wall, 'no stickers here yet.');
    wall.replaceChildren(...stares.slice(0, 12).map((stare, index) => el('figure', { className: 'stare-item' }, [
      el('img', { src: stare.src, alt: stare.alt, width: stare.size, height: stare.size, loading: 'lazy', decoding: 'async' }),
      el('figcaption', {}, [el('b', { text: `sighting ${String(index + 1).padStart(3, '0')}` }), ` ${stare.caption} seen: ${PLACES[index % PLACES.length]}.`])
    ])));
  };

  // duking examples: ducks lying down in places. then the dodge archive, minus repeats.
  const DUKING = [
    ['54_duk_sighting.png', 'under a park bench. correct.'],
    ['20_meeting.png', 'under the desk, during the sync. correct.'],
    ['56_floor_assembly.png', 'under three chairs. full attendance.']
  ];
  const renderMemes = (media) => {
    const memes = (Array.isArray(media.memes) ? media.memes : []).filter((meme) => meme && meme.src);
    const used = new Set();
    const examples = [];
    for (const [file, caption] of DUKING) {
      const meme = memes.find((item) => fileName(item.src) === file);
      if (meme) { examples.push(memeItem(meme, caption)); used.add(meme.src); }
    }
    for (const meme of memes) {
      if (examples.length >= 3) break;
      if ((meme.tag === 'cult' || meme.tag === 'dodge') && !used.has(meme.src)) { examples.push(memeItem(meme)); used.add(meme.src); }
    }
    if (examples.length) $('duking-examples').replaceChildren(...examples);
    else say($('duking-examples'), 'no examples yet.');

    const dodges = memes.filter((meme) => meme.tag === 'dodge' && !used.has(meme.src)).slice(0, 6);
    if (dodges.length) $('dodge-grid').replaceChildren(...dodges.map((meme) => memeItem(meme)));
    else say($('dodge-grid'), 'no memes here yet.');
  };

  // go blue: every pfp in the kit, or the one face we always have.
  const renderPfps = (media) => {
    const pfps = (media.kit && Array.isArray(media.kit.pfp) ? media.kit.pfp : []).filter((item) => item && item.src);
    if (!pfps.length) return;
    $('pfp-picks').replaceChildren(...pfps.slice(0, 8).map((item) => el('li', {}, [
      el('img', { src: item.src, alt: item.alt || item.title || 'a duk pfp', width: 1000, height: 1000, loading: 'lazy', decoding: 'async' }),
      el('a', { className: 'button', href: item.src, download: `duk-${fileName(item.src)}`, text: `${item.title || 'download'} ↓` })
    ])));
  };

  fetch('assets/media.json')
    .then((response) => {
      if (!response.ok) throw new Error(`media ${response.status}`);
      return response.json();
    })
    .then((media) => {
      renderStares(media);
      renderMemes(media);
      renderPfps(media);
    })
    .catch(() => {
      say($('stare-wall'), "the stickers didn't load. try again later.");
      say($('duking-examples'), "the examples didn't load. try again later.");
      say($('dodge-grid'), "the memes didn't load. try again later.");
    });
})();
