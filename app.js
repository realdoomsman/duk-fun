// Shared by every page: the media index, social links, the CA box, the community tape, the duk hour clock,
// and the home directory counts. Every block checks for its elements first.
(() => {
  'use strict';
  const config = window.DUK_CONFIG || {};

  // One media index for every page: assets/media.json (copy-assets.py) plus the fresh drops in
  // assets/content.json (scripts/sync-content.py, newest first). Fresh memes, gifs and clips lead;
  // fresh comics go after the old strips so strip numbers stay put. content.json is optional.
  const getJSON = (path) => fetch(path, { cache: 'no-cache' }).then((response) => {
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return response.json();
  });
  const list = (value) => (Array.isArray(value) ? value : []);
  const joined = (first, then) => {
    const seen = new Set();
    return [...list(first), ...list(then)].filter((item) => {
      const key = item && (item.src || item.mp4 || item.gif);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  let media = null;
  window.dukMedia = () => {
    media = media || Promise.all([getJSON('assets/media.json'), getJSON('assets/content.json').catch(() => null)])
      .then(([index, fresh]) => {
        if (!index || typeof index !== 'object') throw new Error('invalid media.json');
        if (!fresh || typeof fresh !== 'object') return index;
        const videos = index.videos || { trailer: null, clips: [] };
        return {
          ...index,
          memes: joined(fresh.memes, index.memes),
          comics: joined(index.comics, [...list(fresh.comics)].reverse()),
          gifs: joined(fresh.gifs, index.gifs),
          videos: { ...videos, clips: joined(fresh.clips, videos.clips) },
          updated: fresh.updated || null,
        };
      });
    return media;
  };

  // Duk of the day (home clock, daily.html): each day's pick as written down in assets/daily.json by scripts/daily.py
  // (frozen once recorded). A day the sync hasn't recorded yet gets the pick daily.py will make: the curated archive
  // (media.json memes, no 'created') minus content-rule breakers, sorted by src, pool[(utc day * 7919) % pool length].
  // Resolves { days (newest first, today included), today }.
  const OFF_RULE = /bitcoin|\bbtc\b|\beth\b|\$\d|\d+ ?%|\d+k\b|\d+x\b/i; // same as sync-content.py OFF_RULE
  let daily = null;
  window.dukDaily = () => {
    daily = daily || Promise.all([window.dukMedia(), getJSON('assets/daily.json').catch(() => null)]).then(([index, record]) => {
      const days = list(record && record.days).filter((day) => day && day.date && day.src);
      const now = Date.now();
      const date = new Date(now).toISOString().slice(0, 10);
      let today = days.find((day) => day.date === date) || null;
      if (!today) {
        const pool = list(index.memes)
          .filter((meme) => meme && meme.src && !meme.created && !OFF_RULE.test(`${meme.title || ''} ${meme.alt || ''}`))
          .sort((a, b) => (a.src < b.src ? -1 : a.src > b.src ? 1 : 0));
        if (pool.length) {
          const pick = pool[(Math.floor(now / 86400000) * 7919) % pool.length];
          today = { date, src: pick.src, thumb: pick.thumb || pick.src, title: pick.title || 'just duk.', alt: pick.alt || '' };
          days.push(today);
        }
      }
      days.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      return { days, today };
    });
    return daily;
  };

  const $ = (id) => document.getElementById(id);
  const externalURL = (value) => {
    if (!value) return null;
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  };
  const site = externalURL(config.SITE) || 'https://duk.fun/';
  // Every meme, clip, reaction gif and comic has a share page with its own card (scripts/share-pages.py):
  // s/<path under assets/ without the extension, '/' -> '-'>.html. Post links point there so x shows that piece.
  window.dukSharePage = (src) => `${site.replace(/\/+$/, '')}/s/${String(src).replace(/^assets\//, '').replace(/\.[^./]+$/, '')
    .replace(/\//g, '-').replace(/[^\w-]/g, '-')}.html`;
  // The x post for one piece: its caption (without a trailing $duk, the tail adds it), the tail, its share page.
  window.dukPostHref = (caption, src) => `https://x.com/intent/post?text=${encodeURIComponent(
    `${String(caption || 'just duk.').replace(/\s*\$duk\s*$/i, '')}\n\njust duk. $DUK\n${window.dukSharePage(src)}`)}`;

  const links = [['PUMP', 'pump.fun'], ['DEX', 'dexscreener'], ['X', 'x / twitter'], ['X_LIST', 'the list (x)']];
  document.querySelectorAll('[data-links]').forEach((container) => {
    links.forEach(([key, label]) => {
      const href = externalURL(config[key]);
      if (!href) return;
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      container.append(link);
    });
  });

  // The pond is optional: its tab and sections stay hidden until config.POND is set.
  const pond = externalURL(config.POND);
  document.querySelectorAll('[data-pond]').forEach((link) => {
    if (pond) link.href = pond;
    link.hidden = !pond;
  });
  document.querySelectorAll('[data-pond-only]').forEach((section) => { section.hidden = !pond; });

  const copyButton = $('copy-ca');
  if (copyButton && $('ca') && typeof config.CA === 'string' && config.CA.trim()) {
    $('ca-soon').hidden = true;
    $('ca-field').hidden = false;
    $('ca').value = config.CA.trim();
    copyButton.hidden = false;
    copyButton.addEventListener('click', async () => {
      const status = $('copy-status');
      try {
        await navigator.clipboard.writeText($('ca').value);
        if (status) status.textContent = 'copied. now duk.';
      } catch {
        $('ca').focus();
        $('ca').select();
        if (status) status.textContent = 'selected. hold to copy, or press ctrl/cmd + c.';
      }
    });
  }

  const tapeToggle = $('tape-toggle');
  const tape = $('tape-track');
  if (tapeToggle && tape) {
    tapeToggle.addEventListener('click', () => {
      const paused = tapeToggle.getAttribute('aria-pressed') !== 'true';
      tapeToggle.setAttribute('aria-pressed', String(paused));
      tapeToggle.textContent = paused ? 'play' : 'pause';
      tape.classList.toggle('is-paused', paused);
    });
  }

  // Duk hour: one daily moment (UTC) when everyone says "duk." for ten minutes.
  // [data-duk-hour] is the header line (minute steps); [data-duk-clock] is the home page clock (second steps).
  const hourSlots = document.querySelectorAll('[data-duk-hour]');
  const clocks = document.querySelectorAll('[data-duk-clock]');
  const [hourText, minuteText] = String(config.DUK_HOUR_UTC || '21:00').split(':');
  const dukHour = Number(hourText);
  const dukMinute = Number(minuteText) || 0;
  if ((hourSlots.length || clocks.length) && Number.isInteger(dukHour) && dukHour >= 0 && dukHour < 24) {
    const windowMs = 10 * 60 * 1000;
    const postIntent = (text) => `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
    // Becomes today's duk share page once the home clock has picked one (below).
    let postHref = postIntent(`duk.\n${site}`);
    const pad = (value) => String(value).padStart(2, '0');
    const utcLabel = `${pad(dukHour)}:${pad(dukMinute)} utc`;
    const moment = () => {
      const now = Date.now();
      const today = new Date(now);
      const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), dukHour, dukMinute);
      const live = now >= start && now < start + windowMs;
      return { now, start, live, next: now < start ? start : start + 24 * 60 * 60 * 1000 };
    };
    const render = () => {
      const { now, live, next } = moment();
      hourSlots.forEach((slot) => {
        slot.classList.toggle('is-live', live);
        if (live) {
          if (slot.dataset.state === 'live') return;
          slot.dataset.state = 'live';
          const link = document.createElement('a');
          link.href = postHref;
          link.dataset.dukPost = '';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'post duk. on x';
          slot.replaceChildren(document.createTextNode('duk hour. say duk. '), link);
          return;
        }
        slot.dataset.state = 'waiting';
        const minutes = Math.max(1, Math.ceil((next - now) / 60000));
        const hours = Math.floor(minutes / 60);
        const remainder = minutes % 60;
        const wait = hours ? `${hours}h ${remainder}m` : `${remainder}m`;
        slot.replaceChildren(document.createTextNode(`next duk hour in ${wait}`));
        slot.title = `duk hour is ${utcLabel} daily`;
      });
    };
    const tick = () => {
      const { now, start, live, next } = moment();
      const seconds = Math.max(0, Math.ceil(((live ? start + windowMs : next) - now) / 1000));
      const face = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
      clocks.forEach((clock) => {
        clock.classList.toggle('is-live', live);
        const state = live ? 'live' : 'waiting';
        if (clock.dataset.state !== state) {
          clock.dataset.state = state;
          clock.querySelector('[data-duk-clock-label]').textContent = live ? 'duk hour is on. it ends in' : 'next duk hour in';
          const action = clock.querySelector('[data-duk-clock-action]');
          action.textContent = live ? 'post duk. on x' : 'make a duk for it';
          action.href = live ? postHref : 'maker.html';
          action.toggleAttribute('data-duk-post', live);
          action.target = live ? '_blank' : '';
          action.rel = live ? 'noopener noreferrer' : '';
        }
        clock.querySelector('[data-duk-clock-face]').textContent = face;
      });
    };
    clocks.forEach((clock) => {
      const local = clock.querySelector('[data-duk-clock-local]');
      if (local) {
        // Today's (or tomorrow's) actual moment, so daylight saving shifts show correctly.
        const at = new Date(moment().next);
        local.textContent = `that's ${at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()} where you are.`;
      }
    });
    render();
    window.setInterval(render, 15000);
    if (clocks.length) {
      tick();
      window.setInterval(tick, 1000);
      // Today's duk (window.dukDaily): one meme a day, the same for everyone; the clock links daily.html.
      // "post duk. on x" links its share page during duk hour.
      window.dukDaily().then(({ today: pick }) => {
        if (!pick) return;
        postHref = postIntent(`duk.\n${window.dukSharePage(pick.src)}`);
        document.querySelectorAll('[data-duk-post]').forEach((link) => { link.href = postHref; });
        clocks.forEach((clock) => {
          const today = clock.querySelector('[data-duk-today]');
          if (!today) return;
          const image = today.querySelector('img');
          Object.assign(image, { src: pick.thumb || pick.src, width: 480, height: 480, alt: '' });
          today.href = 'daily.html';
          today.setAttribute('aria-label', `today's duk: ${pick.title || 'just duk.'}`);
          today.classList.add('is-picked');
        });
      }).catch(() => { /* the plain duk stays. */ });
    }
  }

  // Home directory: live counts of what the copier and the sync script published.
  const counts = document.querySelectorAll('[data-count]');
  if (counts.length) {
    window.dukMedia()
      .then((media) => {
        const totals = {
          memes: (media.memes || []).length + (Array.isArray(config.memes) ? config.memes.length : 0),
          stickers: (media.stickerPacks || []).reduce((sum, pack) => sum + pack.items.length, 0) + (media.gifs || []).length,
          clips: (media.videos?.clips || []).length,
        };
        counts.forEach((node) => {
          const value = totals[node.dataset.count];
          if (value) node.textContent = String(value);
        });
      })
      .catch(() => { /* Static fallback numbers stay in place. */ });
  }

  // Home wall: the newest drops (memes, reaction gifs, clips) in one grid. The first clip is the big tile;
  // gifs loop muted only while on screen; clips swap their poster for a player on tap.
  const wall = document.querySelector('[data-fresh-wall]');
  if (wall) {
    const make = (tag, attrs = {}, ...children) => {
      const node = document.createElement(tag);
      // 'loading' goes first: an img starts fetching the moment src is set, so a later loading='lazy' is too late.
      for (const [key, value] of Object.entries(attrs).sort(([a], [b]) => (b === 'loading') - (a === 'loading'))) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'text') node.textContent = value;
        else if (key in node && typeof value === 'boolean') node[key] = value;
        else node.setAttribute(key, value);
      }
      node.append(...children.filter(Boolean));
      return node;
    };
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const looping = 'IntersectionObserver' in window && new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (isIntersecting && !still.matches) target.play().catch(() => { /* poster stays up. */ });
        else target.pause();
      }
    }, { threshold: 0.4 });
    const caption = (kind, text) => make('p', { class: 'fresh-cap' }, make('span', { class: 'fresh-kind', text: kind }), text || '');

    const memeTile = (meme) => make('li', { class: 'fresh-tile is-meme' },
      make('a', { class: 'fresh-frame', href: `memes.html#${encodeURIComponent(meme.file || meme.src.split('/').pop())}`, 'aria-label': `open ${meme.title || 'meme'} in the archive` },
        make('img', { src: meme.thumb || meme.src, alt: meme.alt || meme.title || '', width: 480, height: 480, loading: 'lazy', decoding: 'async' })),
      caption('meme', meme.title));

    const gifTile = (gif) => {
      const art = gif.mp4
        ? make('video', { muted: true, loop: true, playsInline: true, preload: 'none', poster: gif.poster, src: gif.mp4, width: 480, height: 480, 'aria-label': gif.alt || gif.title })
        : make('img', { src: gif.gif, alt: gif.alt || gif.title || '', width: 480, height: 480, loading: 'lazy', decoding: 'async' });
      if (gif.mp4) {
        art.defaultMuted = true;
        if (looping) looping.observe(art);
      }
      return make('li', { class: 'fresh-tile is-gif' },
        make('a', { class: 'fresh-frame', href: `stickers.html#gif-${(gif.gif || gif.mp4).split('/').pop().replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-')}`, 'aria-label': `${gif.title || 'reaction gif'}: get it with the other gifs` }, art),
        caption('gif', gif.title));
    };

    const clipTile = (clip, big) => {
      const title = clip.title || 'clip.';
      const play = make('button', { type: 'button', class: 'fresh-frame fresh-play', 'aria-label': `play ${title}` },
        make('img', { src: clip.poster || 'assets/ducking.png', alt: '', width: 480, height: 480, loading: big ? 'eager' : 'lazy', decoding: 'async' }),
        make('span', { class: 'fresh-play-label', text: 'play' }));
      play.addEventListener('click', () => {
        const video = make('video', { class: 'fresh-frame fresh-video', controls: true, playsInline: true, preload: 'auto', poster: clip.poster, src: clip.src, width: clip.width || 1080, height: clip.height || 1080, 'aria-label': clip.alt || title });
        play.replaceWith(video);
        video.focus();
        video.play().catch(() => { /* controls are right there. */ });
      });
      // The caption opens the clip on watch.html (media.js gives every clip card the id clip-<file stem>).
      const stem = clip.src.split('/').pop().replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-');
      const link = make('a', { href: `watch.html#clip-${stem}`, text: title });
      return make('li', { class: `fresh-tile is-clip${big ? ' is-big' : ''}` }, play, caption('clip', link));
    };

    const ago = (stamp) => {
      const minutes = Math.round((Date.now() - Date.parse(stamp)) / 60000);
      if (!Number.isFinite(minutes) || minutes < 0) return '';
      if (minutes < 2) return 'updated just now.';
      if (minutes < 60) return `updated ${minutes} min ago.`;
      const hours = Math.round(minutes / 60);
      return hours < 48 ? `updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago.` : `updated ${new Date(stamp).toLocaleDateString()}.`;
    };

    window.dukMedia()
      .then((media) => {
        const memes = list(media.memes).filter((item) => item.src).slice(0, 7);
        const gifs = list(media.gifs).filter((item) => item.mp4 || item.gif).slice(0, 3);
        const clips = list(media.videos?.clips).filter((item) => item.src).slice(0, 3);
        if (!memes.length) return;
        const pools = { m: memes.map(memeTile), g: gifs.map(gifTile), c: clips.slice(1).map((clip) => clipTile(clip)) };
        const tiles = clips.length ? [clipTile(clips[0], true)] : [];
        for (const key of 'mgmmcmgmmgcm') {
          const tile = pools[key].shift() || pools.m.shift() || pools.g.shift() || pools.c.shift();
          if (tile) tiles.push(tile);
        }
        wall.querySelector('[data-fresh-grid]').replaceChildren(...tiles);
        wall.querySelector('[data-fresh-updated]').textContent = media.updated ? ago(media.updated) : '';
        wall.hidden = false;
      })
      .catch(() => { /* No wall; the directory below still links everything. */ });
  }
})();
