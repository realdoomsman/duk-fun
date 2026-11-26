(() => {
  'use strict';
  const config = window.DUK_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const REFRESH_MS = 60000;
  const TIMEOUT_MS = 8000;

  const keeperURL = (() => {
    if (typeof config.KEEPER_URL !== 'string' || !config.KEEPER_URL.trim()) return null;
    try {
      const url = new URL(config.KEEPER_URL.trim());
      return ['https:', 'http:'].includes(url.protocol) ? `${url.href.replace(/\/+$/, '')}/log` : null;
    } catch { return null; }
  })();

  const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });
  const isAmount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const amount = (value) => isAmount(value) ? numbers.format(value) : '—';
  const clock = (date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  // waiting_for_pool only means "buying on the curve" when the keeper reports pregrad_buy: true.
  const waitingLabel = (data) => {
    if (data && data.state === 'no_mint') return 'running, but no coin to watch yet.';
    if (data && data.state === 'waiting_for_pool') {
      return data.pregrad_buy === true
        ? 'running. buying on the curve and holding until graduation.'
        : 'coin found. waiting for graduation and the pumpswap pool.';
    }
    return 'not active yet.';
  };

  const setLevel = (level, caption) => {
    $('pp-illustration').style.setProperty('--pool-level', `${level}%`);
    $('pp-caption').textContent = caption;
    $('pp-illustration').setAttribute('aria-label', `illustration of the pool. ${caption}`);
  };

  const emptyRow = (text, columns = 5) => {
    const row = document.createElement('tr');
    row.className = 'pool-empty-row';
    const cell = document.createElement('td');
    cell.colSpan = columns;
    cell.textContent = text;
    row.append(cell);
    return row;
  };

  const showPending = (label) => {
    ['pp-sol', 'pp-duk', 'pp-lp'].forEach((id) => { $(id).textContent = '—'; });
    $('pp-state-text').textContent = label;
    setLevel(18, 'no adds yet.');
    $('pp-count').textContent = 'each add and burn will link to its transaction. none yet.';
    $('pp-rows').replaceChildren(emptyRow('— no receipts to show yet.'));
  };

  const timeCell = (timestamp) => {
    const when = document.createElement('td');
    const time = document.createElement('time');
    const date = isAmount(timestamp) ? new Date(timestamp * 1000) : null;
    if (date && !Number.isNaN(date.getTime())) {
      time.dateTime = date.toISOString();
      time.textContent = date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else {
      time.textContent = '—';
    }
    when.dataset.label = 'time';
    when.append(time);
    return when;
  };

  // One table row: time, the given amount columns, then the solscan link.
  const txRow = (entry, columns) => {
    const row = document.createElement('tr');
    row.append(timeCell(entry.timestamp));
    for (const [key, label] of columns) {
      const cell = document.createElement('td');
      cell.dataset.label = label;
      cell.textContent = amount(entry[key]);
      row.append(cell);
    }
    const receipt = document.createElement('td');
    receipt.dataset.label = 'receipt';
    const link = document.createElement('a');
    link.href = `https://solscan.io/tx/${encodeURIComponent(entry.signature)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `${entry.signature.slice(0, 6)}…${entry.signature.slice(-4)} ↗`;
    link.setAttribute('aria-label', `transaction ${entry.signature} on solscan`);
    receipt.append(link);
    row.append(receipt);
    return row;
  };
  const newestFirst = (list) => (Array.isArray(list) ? list : [])
    .filter((entry) => entry && typeof entry.signature === 'string' && entry.signature)
    .sort((a, b) => (isAmount(b.timestamp) ? b.timestamp : 0) - (isAmount(a.timestamp) ? a.timestamp : 0));
  const receiptRow = (entry) => txRow(entry, [['solAdded', 'sol'], ['dukAdded', 'duk'], ['lpBurned', 'lp burned']]);

  // Pre-graduation: fees claimed and duk bought on the bonding curve. Missing fields show '—'.
  const showCurve = (data) => {
    const totals = (data && data.totals) || {};
    $('pp-claimed').textContent = amount(totals.solClaimed);
    $('pp-curve-sol').textContent = amount(totals.solSpentOnCurveBuys);
    $('pp-curve-duk').textContent = amount(totals.dukBoughtOnCurve);
    const buys = newestFirst(data && data.curve_buys).slice(0, 20);
    const curveOn = Boolean(data && data.pregrad_buy === true);
    $('pp-curve-count').textContent = buys.length
      ? `the last ${buys.length} ${buys.length === 1 ? 'buy' : 'buys'}, newest first.`
      : 'each buy links to its transaction on solscan.';
    let emptyText = "— the keeper didn't answer. try again in a minute.";
    if (data) emptyText = curveOn ? '— no curve buys yet.' : "— pre-graduation buying isn't on yet.";
    $('pp-curve-rows').replaceChildren(...(buys.length
      ? buys.map((entry) => txRow(entry, [['solIn', 'sol in'], ['dukOut', 'duk out']]))
      : [emptyRow(emptyText, 4)]));
  };

  const showActive = (data) => {
    const totals = data.totals || {};
    $('pp-sol').textContent = amount(totals.solAdded);
    $('pp-duk').textContent = amount(totals.dukAdded);
    $('pp-lp').textContent = amount(totals.lpBurned);
    const sol = isAmount(totals.solAdded) ? totals.solAdded : 0;
    // Illustrative log scale, capped at 64% so the floating duck's head stays above the frame edge.
    const level = Math.min(64, 18 + Math.log10(1 + sol) * 22);
    setLevel(level, sol > 0 ? `${amount(sol)} sol added so far.` : 'pool found. no adds yet.');
    const recent = newestFirst(data.recent);
    $('pp-state-text').textContent = recent.length
      ? `running. last checked ${clock(new Date())}.`
      : `running. waiting for enough fees for the first add. last checked ${clock(new Date())}.`;
    $('pp-count').textContent = recent.length
      ? `${recent.length} ${recent.length === 1 ? 'receipt' : 'receipts'} on file. newest first.`
      : 'no adds yet. the keeper is waiting for enough fees.';
    $('pp-rows').replaceChildren(...(recent.length ? recent.map(receiptRow) : [emptyRow('— no adds yet. the keeper is waiting for enough fees.')]));
  };

  let busy = false;
  const update = async () => {
    if (!keeperURL) { showPending('not connected yet.'); showCurve(null); return; }
    if (busy) return;
    busy = true;
    $('pp-refresh').disabled = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(keeperURL, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('keeper unavailable');
      const data = await response.json();
      showCurve(data);
      if (data && data.state === 'active') showActive(data);
      else showPending(waitingLabel(data));
    } catch {
      showCurve(null);
      showPending("didn't answer this time. counters stay blank until it does.");
    } finally {
      window.clearTimeout(timer);
      busy = false;
      $('pp-refresh').disabled = false;
    }
  };

  $('pp-refresh').addEventListener('click', update);
  update();
  if (keeperURL) window.setInterval(() => { if (!document.hidden) update(); }, REFRESH_MS);

  // Fee wallet copy, with a select-and-copy fallback when the clipboard API is unavailable.
  $('pp-copy').addEventListener('click', async () => {
    const field = $('pp-wallet');
    try {
      await navigator.clipboard.writeText(field.value);
      $('pp-copy-status').textContent = 'copied.';
    } catch {
      field.focus();
      field.select();
      $('pp-copy-status').textContent = 'selected. hold to copy, or press ctrl/cmd + c.';
    }
  });

  const memeLink = (meme) => {
    const link = document.createElement('a');
    link.className = 'meme-item';
    link.href = meme.src;
    link.target = '_blank';
    link.rel = 'noopener';
    const image = document.createElement('img');
    image.src = meme.src;
    image.alt = meme.alt || meme.title || 'duk in the pool.';
    image.width = 1200;
    image.height = 1200;
    image.loading = 'lazy';
    image.decoding = 'async';
    const caption = document.createElement('span');
    caption.textContent = meme.title || 'just duk.';
    const action = document.createElement('b');
    action.textContent = 'full size ↗';
    caption.append(action);
    link.append(image, caption);
    return link;
  };

  fetch('assets/media.json')
    .then((response) => {
      if (!response.ok) throw new Error('media unavailable');
      return response.json();
    })
    .then((media) => {
      const sprite = typeof media.poolSprite === 'string' && media.poolSprite.startsWith('assets/') ? media.poolSprite : null;
      if (sprite) {
        const hero = $('pool-hero-art');
        hero.src = sprite;
        hero.width = 900;
        hero.height = 1549;
        hero.alt = 'duk floating in the pool.';
        const duck = $('pool-duck');
        duck.src = sprite;
        duck.width = 900;
        duck.height = 1549;
        duck.classList.add('is-floating');
      }
      const memes = (Array.isArray(media.memes) ? media.memes : [])
        .filter((meme) => meme && meme.tag === 'pool' && typeof meme.src === 'string');
      $('pp-memes').replaceChildren(...memes.map(memeLink));
      $('pp-memes-status').textContent = memes.length
        ? `${memes.length} pool ${memes.length === 1 ? 'meme' : 'memes'}. free to save.`
        : 'no pool memes yet. the full archive is below.';
    })
    .catch(() => { $('pp-memes-status').textContent = "couldn't load the pool memes. the full archive still works."; });
})();
