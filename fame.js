// The wall of fame: assets/fame.json (hand-fed by scripts/add-fame.py) -> one credited card per piece, newest first.
// Cards carry id 'fame-<entry id>' (share pages land there); gifs loop only on screen, never with reduced motion,
// and carry a play/pause button (app.js dukWatchLoop / dukLoopToggle).
(() => {
  const grid = document.querySelector('[data-fame]');
  if (!grid) return;
  const empty = document.querySelector('[data-fame-empty]');
  const count = document.querySelector('[data-fame-count]');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    // 'loading' before 'src': a src set first starts an eager fetch.
    if ('loading' in props) node.loading = props.loading;
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'loading' || value === undefined || value === null || value === '') return;
      if (key === 'text') node.textContent = value;
      else if (key in node && typeof value !== 'string') node[key] = value;
      else node.setAttribute(key === 'className' ? 'class' : key, value);
    });
    node.append(...children.filter(Boolean));
    return node;
  };
  const handleOk = (handle) => /^[A-Za-z0-9_]{1,15}$/.test(handle || '');
  const postOk = (url) => /^https:\/\/(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+/i.test(url || '');
  const external = { target: '_blank', rel: 'noopener noreferrer' };

  const art = (entry) => {
    const size = { width: entry.width, height: entry.height };
    if (entry.kind === 'image') {
      return el('a', { className: 'fame-art', href: entry.src, ...external },
        el('img', { loading: 'lazy', src: entry.thumb || entry.src, alt: entry.alt || `a duk made by @${entry.by}`, decoding: 'async', ...size }),
        el('span', { className: 'sr-only', text: ' (full size, opens in a new tab)' }));
    }
    const video = el('video', { className: 'fame-video', src: entry.src, poster: entry.thumb, preload: 'none', playsinline: '', ...size,
      'aria-label': entry.alt || `a duk clip made by @${entry.by}` });
    video.playsInline = true;
    if (entry.kind === 'gif') {
      video.muted = true;
      video.loop = true;
      if (window.dukWatchLoop(video)) {
        return el('div', { className: 'fame-art' }, video, window.dukLoopToggle(video, `the gif by @${entry.by}`));
      }
    }
    video.controls = true;
    return el('div', { className: 'fame-art' }, video);
  };

  const card = (entry, number) => {
    const by = el('a', { href: `https://x.com/${entry.by}`, ...external, text: `@${entry.by}` });
    const links = el('p', { className: 'fame-links' },
      postOk(entry.post) ? el('a', { href: entry.post, ...external, text: 'their post' }) : null,
      el('a', { href: window.dukPostHref ? window.dukPostHref(`${entry.caption || 'on the duk wall of fame.'} by @${entry.by}`, entry.src) : '#', ...external, text: 'post it' }));
    return el('article', { className: 'fame-card', id: `fame-${entry.id}` },
      el('span', { className: 'fame-number', text: `no. ${number}` }),
      art(entry),
      el('div', { className: 'fame-body' },
        entry.caption ? el('p', { className: 'fame-caption', text: entry.caption }) : null,
        el('p', { className: 'fame-by' }, 'by ', by, entry.added ? el('time', { datetime: entry.added, text: ` / ${entry.added}` }) : null),
        links));
  };

  const showLinked = () => {
    let wanted = '';
    try { wanted = decodeURIComponent(window.location.hash.slice(1)); } catch { /* not ours. */ }
    grid.querySelectorAll('.is-linked').forEach((node) => node.classList.remove('is-linked'));
    const linked = wanted.startsWith('fame-') && document.getElementById(wanted);
    if (!linked || !grid.contains(linked)) return;
    linked.classList.add('is-linked');
    linked.scrollIntoView({ block: 'center', behavior: still.matches ? 'auto' : 'smooth' });
    linked.querySelector('a, video')?.focus({ preventScroll: true });
  };

  fetch('assets/fame.json', { cache: 'no-cache' })
    .then((response) => (response.ok ? response.json() : { entries: [] }))
    .catch(() => ({ entries: [] }))
    .then((manifest) => {
      const entries = (Array.isArray(manifest.entries) ? manifest.entries : [])
        .filter((entry) => entry && entry.id && entry.src && handleOk(entry.by));
      grid.replaceChildren(...entries.map((entry, i) => card(entry, entries.length - i)));
      if (empty) empty.hidden = entries.length > 0;
      if (count) count.textContent = entries.length ? `${entries.length} on the wall.\nmake one, you're next.` : 'empty for now.\nbe first.';
      showLinked();
      window.addEventListener('hashchange', showLinked);
    });
})();
