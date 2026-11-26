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

  const links = [['PUMP', 'pump.fun'], ['DEX', 'dexscreener'], ['X', 'x / twitter'], ['TG', 'telegram']];
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

  if (typeof config.CA === 'string' && config.CA.trim()) {
    $('ca-soon').hidden = true;
    $('ca-field').hidden = false;
    $('ca').value = config.CA.trim();
    $('copy-ca').hidden = false;
    $('copy-ca').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText($('ca').value);
        $('copy-status').textContent = 'copied. now duk.';
      } catch {
        $('ca').focus();
        $('ca').select();
        $('copy-status').textContent = 'selected. hold to copy, or press ctrl/cmd + c.';
      }
    });
  }

  const site = externalURL(config.SITE);
  if (site) {
    const image = new URL('assets/og-1200x630.png', site.endsWith('/') ? site : `${site}/`).href;
    ['og:image', 'twitter:image'].forEach((name) => {
      const meta = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
      if (meta) meta.content = image;
    });
  }

  // /log: {state, totals:{solAdded,dukAdded,lpBurned}, recent:[{signature,timestamp,...}]}
  const keeper = externalURL(config.KEEPER_URL);
  const amounts = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });
  const amount = (value) => typeof value === 'number' && Number.isFinite(value) ? amounts.format(value) : '—';
  const floorPending = () => {
    ['floor-sol', 'floor-duk', 'floor-lp'].forEach((id) => { $(id).textContent = '—'; });
    $('floor-state').textContent = 'starts after graduation';
    $('floor-transactions').hidden = true;
    $('floor-transactions').replaceChildren();
  };
  const updateFloor = async () => {
    if (!keeper) return;
    try {
      const response = await fetch(`${keeper.replace(/\/+$/, '')}/log`, {
        signal: AbortSignal.timeout(8000),
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('floor unavailable');
      const data = await response.json();
      if (data.state !== 'active') { floorPending(); return; }
      $('floor-sol').textContent = amount(data.totals?.solAdded);
      $('floor-duk').textContent = amount(data.totals?.dukAdded);
      $('floor-lp').textContent = amount(data.totals?.lpBurned);
      const recent = Array.isArray(data.recent) ? data.recent : [];
      $('floor-state').textContent = recent.length ? 'burn receipts. not promises.' : 'no claims yet.';
      const list = $('floor-transactions');
      list.replaceChildren();
      recent.slice(0, 10).forEach((entry) => {
        if (typeof entry.signature !== 'string' || !entry.signature) return;
        const row = document.createElement('li');
        const link = document.createElement('a');
        link.href = `https://solscan.io/tx/${encodeURIComponent(entry.signature)}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = `${entry.signature.slice(0, 7)}…${entry.signature.slice(-5)} ↗`;
        const detail = document.createElement('span');
        detail.textContent = `${amount(entry.solAdded)} sol / ${amount(entry.dukAdded)} duk / ${amount(entry.lpBurned)} lp burned`;
        const time = document.createElement('time');
        if (typeof entry.timestamp === 'number' && Number.isFinite(entry.timestamp)) {
          const date = new Date(entry.timestamp * 1000);
          time.dateTime = date.toISOString();
          time.textContent = date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        row.append(link, detail, time);
        list.append(row);
      });
      list.hidden = !list.children.length;
    } catch { floorPending(); }
  };
  if (keeper) {
    updateFloor();
    window.setInterval(updateFloor, 60000);
  }

  const dialog = $('lightbox');
  const lightboxImage = $('lightbox-image');
  let opener = null;
  const closeLightbox = () => dialog.close();
  $('close-lightbox').addEventListener('click', closeLightbox);
  dialog.addEventListener('click', (event) => {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeLightbox();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    if (opener) opener.focus({ preventScroll: true });
  });

  const renderMemes = (memes) => {
    $('meme-grid').replaceChildren();
    memes.forEach((meme) => {
      if (!meme || typeof meme.src !== 'string') return;
      let source;
      try { source = new URL(meme.src, document.baseURI); } catch { return; }
      if (!['https:', 'http:', 'file:'].includes(source.protocol)) return;
      const title = typeof meme.title === 'string' ? meme.title : 'just duk.';
      const alt = typeof meme.alt === 'string' ? meme.alt : title;
      const button = document.createElement('button');
      button.className = 'meme-item';
      button.setAttribute('aria-label', `open ${title}`);
      const image = document.createElement('img');
      image.src = source.href;
      image.alt = alt;
      image.width = 1200;
      image.height = 1200;
      image.loading = 'lazy';
      const caption = document.createElement('span');
      caption.append(document.createTextNode(title));
      const action = document.createElement('b');
      action.textContent = 'open + save';
      caption.append(action);
      button.append(image, caption);
      button.addEventListener('click', () => {
        opener = button;
        lightboxImage.src = source.href;
        lightboxImage.alt = alt;
        $('lightbox-title').textContent = title;
        $('download-meme').href = source.href;
        $('download-meme').download = source.pathname.split('/').pop() || 'duk.png';
        dialog.showModal();
        document.body.style.overflow = 'hidden';
      });
      $('meme-grid').append(button);
    });
  };
  const configuredMemes = Array.isArray(config.memes) ? config.memes : [];
  renderMemes(configuredMemes);
  // The copy script publishes the growing art pack separately from launch config.
  fetch('assets/memes/manifest.json')
    .then((response) => response.ok ? response.json() : [])
    .then((manifest) => {
      if (!Array.isArray(manifest) || !manifest.length) return;
      const pack = manifest.map((meme) => ({
        src: `assets/memes/${meme.file}`,
        title: meme.caption,
        alt: meme.alt
      }));
      renderMemes([...configuredMemes, ...pack]);
    })
    .catch(() => { /* The two configured memes also work on file:// previews. */ });
})();
