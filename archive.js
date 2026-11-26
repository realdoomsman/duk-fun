(() => {
  'use strict';

  const config = window.DUK_CONFIG || {};
  const tags = new Set(['reaction', 'dodge', 'pool', 'cult', 'market', 'life', 'season']);
  const assetBase = new URL('assets/', window.location.href);
  const grid = document.getElementById('archive-grid');
  const count = document.getElementById('archive-count');
  const note = document.getElementById('archive-note');
  const empty = document.getElementById('archive-empty');
  const filters = [...document.querySelectorAll('[data-archive-filter]')];
  const randomButton = document.getElementById('archive-random');
  const dialog = document.getElementById('archive-dialog');
  const title = document.getElementById('archive-dialog-title');
  const image = document.getElementById('archive-dialog-image');
  const position = document.getElementById('archive-dialog-position');
  const previous = document.getElementById('archive-prev');
  const next = document.getElementById('archive-next');
  const download = document.getElementById('archive-download');
  const post = document.getElementById('archive-post');
  const remix = document.getElementById('archive-remix');
  const shareButton = document.getElementById('archive-share');
  const copyButton = document.getElementById('archive-copy');
  // The picture itself into a post: touch screens hand it to the share sheet (x, telegram, messages) with the post
  // words; mouse screens copy it to paste into the post. One of the two shows, whichever this browser can do.
  const canShareFiles = (() => {
    try { return Boolean(navigator.canShare && navigator.canShare({ files: [new File([''], 'duk.png', { type: 'image/png' })] })); } catch { return false; }
  })();
  const canCopyImage = Boolean(window.isSecureContext && navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);
  const touch = window.matchMedia('(pointer: coarse)').matches;
  shareButton.hidden = !canShareFiles || (!touch && canCopyImage);
  copyButton.hidden = !canCopyImage || !shareButton.hidden;
  // The meme as a png blob (clipboards only take png; other formats are redrawn).
  const pngOf = (src) => fetch(src).then((response) => {
    if (!response.ok) throw new Error(`${src} ${response.status}`);
    return response.blob();
  }).then(async (blob) => {
    if (blob.type === 'image/png') return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    return new Promise((resolve, reject) => canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('no png'))), 'image/png'));
  });
  // The share sheet needs the file right after the tap, so the open meme's png is fetched when it opens (cached).
  let prepared = { src: '', png: null };
  const say = (button, text) => {
    button.dataset.label = button.dataset.label || button.textContent;
    button.textContent = text;
    window.clearTimeout(Number(button.dataset.timer));
    button.dataset.timer = String(window.setTimeout(() => { button.textContent = button.dataset.label; }, 2600));
  };
  const items = [];
  const bySource = new Map();
  const byKey = new Map();
  const requestedTag = new URLSearchParams(window.location.search).get('tag');
  // 'new' is a filter, not a tag: memes the sync script published (content.json 'created') since the visitor's last
  // visit or in the last day, whichever is longer (window.dukNewSince from app.js); ?since=<ms> (home's "since you
  // were here" link) pins the cutoff to that visit.
  const sinceParam = Number(new URLSearchParams(window.location.search).get('since'));
  const NEW_SINCE = sinceParam > 0 ? sinceParam : window.dukNewSince || Date.now() - 24 * 60 * 60 * 1000;
  let filter = tags.has(requestedTag) || requestedTag === 'new' ? requestedTag : 'all';
  let visible = [];
  let current = 0;
  let opener = null;
  let loading = true;
  let backdropPress = false;

  // Only local site assets are shown; manifest data never pulls in third-party images.
  function localAsset(path) {
    if (typeof path !== 'string' || !path.trim()) return null;
    let url;
    try { url = new URL(path, window.location.href); } catch { return null; }
    if (url.origin !== assetBase.origin || !url.pathname.startsWith(assetBase.pathname)) return null;
    url.search = '';
    url.hash = '';
    return url;
  }

  function addItem(entry) {
    if (!entry || typeof entry !== 'object') return;
    const source = localAsset(typeof entry.src === 'string' && entry.src.trim() ? entry.src
      : typeof entry.file === 'string' && entry.file.trim() ? `assets/memes/${entry.file}` : '');
    if (!source) return;
    const thumb = localAsset(entry.thumb);
    const tag = tags.has(entry.tag) ? entry.tag : null;
    const existing = bySource.get(source.href);
    if (existing) {
      if (!existing.tag && tag) existing.tag = tag;
      return;
    }
    const relative = decodeURIComponent(source.pathname.slice(assetBase.pathname.length));
    const file = relative.split('/').pop();
    const key = byKey.has(file) ? relative : file;
    const caption = typeof entry.title === 'string' && entry.title.trim() ? entry.title : 'just duk.';
    const item = {
      src: source.href,
      thumb: thumb ? thumb.href : source.href,
      file,
      key,
      caption,
      alt: typeof entry.alt === 'string' && entry.alt.trim() ? entry.alt : caption,
      tag,
      fresh: typeof entry.created === 'string' && Date.parse(entry.created) > NEW_SINCE,
      asset: relative,
      card: null,
      button: null
    };
    bySource.set(source.href, item);
    byKey.set(key, item);
    items.push(item);
  }

  function makeCard(item) {
    const card = document.createElement('li');
    card.className = 'archive-card';
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `open meme: ${item.caption}`);
    button.setAttribute('aria-haspopup', 'dialog');
    const thumbnail = document.createElement('img');
    thumbnail.loading = 'lazy';
    thumbnail.decoding = 'async';
    thumbnail.width = 480;
    thumbnail.height = 480;
    thumbnail.alt = item.alt;
    thumbnail.src = item.thumb;
    const caption = document.createElement('span');
    caption.className = 'archive-card-caption';
    caption.textContent = item.caption;
    const tag = document.createElement('span');
    tag.className = 'archive-card-tag';
    button.append(thumbnail, caption, tag);
    if (item.fresh) {
      const stamp = document.createElement('span');
      stamp.className = 'archive-card-new';
      stamp.textContent = 'new';
      button.append(stamp);
    }
    button.addEventListener('click', () => openItem(item, button));
    card.append(button);
    item.card = card;
    item.button = button;
    return card;
  }

  function render() {
    visible = filter === 'all' ? items : filter === 'new' ? items.filter(item => item.fresh) : items.filter(item => item.tag === filter);
    const totals = { all: items.length, new: 0 };
    for (const item of items) {
      if (item.tag) totals[item.tag] = (totals[item.tag] || 0) + 1;
      if (item.fresh) totals.new += 1;
    }
    const fragment = document.createDocumentFragment();
    for (const item of visible) {
      fragment.append(item.card || makeCard(item));
      item.card.querySelector('.archive-card-tag').textContent = item.tag || 'untagged';
    }
    grid.replaceChildren(fragment);
    grid.setAttribute('aria-busy', String(loading));
    count.textContent = `${visible.length} of ${items.length} memes / ${filter}${loading ? ' / loading...' : ''}`;
    empty.hidden = loading || visible.length !== 0;
    randomButton.disabled = visible.length === 0;
    for (const button of filters) {
      const key = button.dataset.archiveFilter;
      const total = totals[key] || 0;
      button.querySelector('[data-filter-count]').textContent = total;
      button.setAttribute('aria-pressed', String(key === filter));
      // Tags with no memes (e.g. season before memes3 lands, or any tag while media.json loads) stay hidden.
      button.hidden = key !== 'all' && total === 0 && key !== filter;
    }
    if (dialog.open) updateDialog();
  }

  function setUrl(hash) {
    const url = new URL(window.location.href);
    if (filter === 'all') url.searchParams.delete('tag');
    else url.searchParams.set('tag', filter);
    url.hash = hash ? encodeURIComponent(hash) : '';
    history.replaceState(null, '', hash ? url.href : url.href.replace(/#$/, ''));
  }

  function openItem(item, source) {
    if (!visible.includes(item)) {
      filter = 'all';
      render();
    }
    current = visible.indexOf(item);
    opener = source || item.button;
    updateDialog();
    if (!dialog.open) dialog.showModal();
  }

  function updateDialog() {
    const item = visible[current];
    if (!item) return;
    title.textContent = item.caption;
    image.src = item.src;
    image.alt = item.alt;
    position.textContent = `${current + 1} / ${visible.length} in ${filter}`;
    download.href = item.src;
    download.download = item.file;
    post.href = window.dukPostHref(item.caption, item.asset);
    remix.href = `maker.html?base=${encodeURIComponent(`assets/${decodeURIComponent(item.src.slice(assetBase.href.length))}`)}#maker`;
    previous.disabled = next.disabled = visible.length < 2;
    if (canShareFiles && prepared.src !== item.src) prepared = { src: item.src, png: pngOf(item.src).catch(() => null) };
    setUrl(item.key);
  }

  function move(direction) {
    if (!visible.length) return;
    current = (current + direction + visible.length) % visible.length;
    updateDialog();
  }

  function randomItem() {
    if (!visible.length) return null;
    if (!dialog.open || visible.length < 2) return visible[Math.floor(Math.random() * visible.length)];
    const pick = Math.floor(Math.random() * (visible.length - 1));
    return visible[pick >= current ? pick + 1 : pick];
  }

  function openFromHash() {
    const raw = window.location.hash.slice(1);
    if (!raw) return;
    let key;
    try { key = decodeURIComponent(raw); } catch { return; }
    const item = byKey.get(key) || bySource.get(new URL(key, assetBase).href);
    if (item) openItem(item, item.button);
  }

  for (const button of filters) {
    button.addEventListener('click', () => {
      filter = button.dataset.archiveFilter;
      render();
      setUrl('');
    });
  }
  randomButton.addEventListener('click', () => {
    const item = randomItem();
    if (item) openItem(item, randomButton);
  });
  document.getElementById('archive-dialog-random').addEventListener('click', () => {
    const item = randomItem();
    if (item) openItem(item, opener);
  });
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  shareButton.addEventListener('click', async () => {
    const item = visible[current];
    if (!item) return;
    const png = await (prepared.src === item.src ? prepared.png : pngOf(item.src).catch(() => null));
    if (!png) { say(shareButton, "couldn't load it. try download"); return; }
    try {
      await navigator.share({
        files: [new File([png], `${item.file.replace(/\.[^.]+$/, '')}.png`, { type: 'image/png' })],
        text: window.dukPostText(item.caption, item.asset),
      });
    } catch (error) {
      if (error && error.name !== 'AbortError') say(shareButton, "couldn't share. try download");
    }
  });
  copyButton.addEventListener('click', async () => {
    const item = visible[current];
    if (!item) return;
    try {
      // a promise inside the ClipboardItem keeps safari's tap permission while the png loads.
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': pngOf(item.src) })]);
      say(copyButton, 'copied. paste it in your post');
    } catch {
      say(copyButton, "couldn't copy. try download");
    }
  });
  document.getElementById('archive-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  dialog.addEventListener('close', () => {
    backdropPress = false;
    setUrl('');
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  });

  function isBackdrop(event) {
    const bounds = dialog.getBoundingClientRect();
    return event.target === dialog && (
      event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom
    );
  }
  dialog.addEventListener('pointerdown', event => {
    backdropPress = event.button === 0 && isBackdrop(event);
  });
  dialog.addEventListener('pointercancel', () => { backdropPress = false; });
  dialog.addEventListener('click', event => {
    if (backdropPress && isBackdrop(event)) dialog.close();
    backdropPress = false;
  });
  window.addEventListener('hashchange', openFromHash);

  if (Array.isArray(config.memes)) {
    for (const entry of config.memes) addItem(entry);
  }
  render();

  async function loadMedia() {
    try {
      const media = await window.dukMedia();
      if (!media || !Array.isArray(media.memes)) throw new Error('invalid media');
      for (const entry of media.memes) addItem(entry);
      note.textContent = 'pick a tag or hit random duk.';
    } catch {
      note.textContent = 'some memes didn\'t load. reload to try again.';
    } finally {
      loading = false;
      if (filter !== 'all' && !items.some(item => (filter === 'new' ? item.fresh : item.tag === filter))) {
        filter = 'all';
        const url = new URL(window.location.href);
        url.searchParams.delete('tag');
        history.replaceState(null, '', url.href);
      }
      render();
      openFromHash();
    }
  }
  loadMedia();
})();
