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
  const items = [];
  const bySource = new Map();
  const byKey = new Map();
  const site = (typeof config.SITE === 'string' && config.SITE.trim() ? config.SITE : 'https://duk.fun').replace(/\/+$/, '');
  const requestedTag = new URLSearchParams(window.location.search).get('tag');
  let filter = tags.has(requestedTag) ? requestedTag : 'all';
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
    button.addEventListener('click', () => openItem(item, button));
    card.append(button);
    item.card = card;
    item.button = button;
    return card;
  }

  function render() {
    visible = filter === 'all' ? items : items.filter(item => item.tag === filter);
    const totals = { all: items.length };
    for (const item of items) {
      if (item.tag) totals[item.tag] = (totals[item.tag] || 0) + 1;
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
    const text = `${item.caption}\n\njust duk. $DUK\n${site}/memes.html`;
    post.href = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
    previous.disabled = next.disabled = visible.length < 2;
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
    const item = byKey.get(key);
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
      if (filter !== 'all' && !items.some(item => item.tag === filter)) {
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
