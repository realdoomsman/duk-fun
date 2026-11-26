// Shared by every page: social links, the CA box, the community tape, the duk hour clock,
// and the home directory counts. Every block checks for its elements first.
(() => {
  'use strict';
  const config = window.DUK_CONFIG || {};
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
  const hourSlots = document.querySelectorAll('[data-duk-hour]');
  const [hourText, minuteText] = String(config.DUK_HOUR_UTC || '21:00').split(':');
  const dukHour = Number(hourText);
  const dukMinute = Number(minuteText) || 0;
  if (hourSlots.length && Number.isInteger(dukHour) && dukHour >= 0 && dukHour < 24) {
    const windowMs = 10 * 60 * 1000;
    const postHref = `https://x.com/intent/post?text=${encodeURIComponent(`duk.\n${site}`)}`;
    const render = () => {
      const now = Date.now();
      const today = new Date(now);
      const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), dukHour, dukMinute);
      const live = now >= start && now < start + windowMs;
      const next = now < start ? start : start + 24 * 60 * 60 * 1000;
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
        slot.title = `duk hour is ${String(dukHour).padStart(2, '0')}:${String(dukMinute).padStart(2, '0')} utc daily`;
      });
    };
    render();
    window.setInterval(render, 15000);
  }

  // Home directory: live counts of what the copier published.
  const counts = document.querySelectorAll('[data-count]');
  if (counts.length) {
    fetch('assets/media.json')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('media unavailable'))))
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
