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

  const $ = (id) => document.getElementById(id);
  const externalURL = (value) => {
    if (!value) return null;
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  };
  const site = externalURL(config.SITE) || 'https://duk.fun/';

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
    const postHref = `https://x.com/intent/post?text=${encodeURIComponent(`duk.\n${site}`)}`;
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
})();
