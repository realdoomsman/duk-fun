(() => {
  'use strict';
  const config = window.DUK_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const REFRESH_MS = 120000; // /log carries the keeper's ledger; every two minutes is plenty (it adds every ~5 min)
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

  const wholeNumbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const whole = (value) => isAmount(value) ? wholeNumbers.format(value) : '—';

  const waitingLabel = (data) => (data && data.state === 'no_mint'
    ? 'running, but no coin to watch yet.'
    : 'running, but not adding right now.');

  // Share of each batch that refills the reserve, in words.
  const refillShare = (bps) => {
    if (bps === 2500) return 'a quarter';
    if (bps === 5000) return 'half';
    return isAmount(bps) ? `${bps / 100}%` : 'part';
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

  // Fees claimed, the 4% duk reserve the bot keeps in its wallet, and the launch-day curve buys. Missing fields show '—'.
  const showWallet = (data) => {
    const totals = (data && data.totals) || {};
    $('pp-claimed').textContent = amount(totals.solClaimed);
    $('pp-held').textContent = whole(data && data.wallet_duk);
    $('pp-refilled').textContent = whole(totals.dukBoughtForReserve);
    if (data && isAmount(data.wallet_duk) && isAmount(data.duk_reserve)) {
      const pct = isAmount(data.reserve_pct) ? ` (${data.reserve_pct}%)` : '';
      $('pp-reserve').textContent = `reserve: ${whole(data.wallet_duk)} / ${whole(data.duk_reserve)} duk${pct}${data.reserve_refilling === true ? ' · refilling' : ''}`;
    } else {
      $('pp-reserve').textContent = 'reserve: — / 40,000,000 duk';
    }
    if (data && data.reserve_refilling === true) {
      $('pp-reserve-status').textContent = `it's below that right now, so ${refillShare(data.reserve_refill_bps)} of each batch buys duk back toward 4%. the rest goes in the pool every time.`;
    } else if (data && data.reserve_refilling === false) {
      $('pp-reserve-status').textContent = "it's at 4% now, so the refill is off and all of each batch goes in the pool.";
    }
    const buys = newestFirst(data && data.curve_buys).slice(0, 20);
    $('pp-curve-count').textContent = buys.length
      ? `${buys.length} ${buys.length === 1 ? 'buy' : 'buys'} on launch day, newest first. the bot doesn't buy on the curve anymore.`
      : 'each buy links to its transaction on solscan.';
    $('pp-curve-rows').replaceChildren(...(buys.length
      ? buys.map((entry) => txRow(entry, [['solIn', 'sol in'], ['dukOut', 'duk out']]))
      : [emptyRow(data ? '— no curve buys.' : "— the keeper didn't answer. try again in a minute.", 4)]));
  };

  /* ---------- every add, over time ----------
     /log 'transactions' holds the keeper's whole ledger; each 'deposit' is one add to the pool with raw amounts
     (quote = lamports, base = duk at 6 decimals, lp at 9, the same decimals the keeper uses for its totals).
     The chart is a running total, one step per add, with each add's own size as a bar along the bottom. */
  const CHART = {
    sol: { field: 'quote', decimals: 9, total: 'solAdded', unit: 'sol', format: new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }) },
    duk: { field: 'base', decimals: 6, total: 'dukAdded', unit: 'duk', format: wholeNumbers },
    lp: { field: 'lp', decimals: 9, total: 'lpBurned', unit: 'lp burned', format: new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }) },
  };
  // axis labels stay short: 40m, 2.5k, 20.
  const compactNumbers = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  const compact = (value) => compactNumbers.format(value).toLowerCase();
  const svgNS = 'http://www.w3.org/2000/svg';
  const svgNode = (tag, attrs = {}, text) => {
    const node = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const chartState = { adds: [], key: 'sol', pick: -1 };
  // Smallest of 1, 2, 2.5, 5 x 10^n at or above the value, so the top line reads as a round number.
  const niceTop = (value) => {
    if (!(value > 0)) return 1;
    const power = 10 ** Math.floor(Math.log10(value));
    return [1, 2, 2.5, 5, 10].map((step) => step * power).find((step) => step >= value);
  };
  const dayTime = (seconds) => new Date(seconds * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const chartReadout = () => {
    const { adds, key, pick } = chartState;
    const readout = $('pp-chart-readout');
    if (!adds.length) { readout.replaceChildren(); return; }
    const index = pick >= 0 ? pick : adds.length - 1;
    const add = adds[index];
    const { unit, format } = CHART[key];
    const link = document.createElement('a');
    link.href = `https://solscan.io/tx/${encodeURIComponent(add.signature)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'receipt ↗';
    readout.replaceChildren(`${pick >= 0 ? `add ${index + 1} of ${adds.length}` : 'last add'}, ${dayTime(add.t)}: +${format.format(add[key])} ${unit}. running total ${format.format(add.total[key])} ${unit}. `, link);
  };

  const drawChart = () => {
    const svg = $('pp-chart');
    const { adds, key, pick } = chartState;
    if (!adds.length || !svg.parentElement.clientWidth) return;
    const { unit, format } = CHART[key];
    const width = svg.parentElement.clientWidth;
    const narrow = width < 560;
    // the running total on top, a strip of each add's own size under its axis, then the time labels.
    const strip = narrow ? 30 : 40;
    const height = narrow ? 260 : 330;
    const pad = { left: narrow ? 46 : 62, right: 16, top: 18, bottom: 30 + strip + 12 };
    const start = adds[0].t;
    const end = Math.max(Date.now() / 1000, adds[adds.length - 1].t + 600);
    const top = niceTop(adds[adds.length - 1].total[key]);
    const biggest = Math.max(...adds.map((add) => add[key])) || 1;
    const x = (t) => pad.left + ((t - start) / (end - start)) * (width - pad.left - pad.right);
    const y = (v) => height - pad.bottom - (v / top) * (height - pad.top - pad.bottom);
    const floor = Math.round(y(0));
    const stripBase = floor + 12 + strip;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    const last = adds[adds.length - 1];
    svg.setAttribute('aria-label', `running total of ${unit} the keeper added to the pool: ${adds.length} adds from ${dayTime(start)} to ${dayTime(last.t)}, ${format.format(last.total[key])} ${unit} so far. use the arrow keys to step through the adds.`);

    const parts = [];
    // gridlines + y labels at 0, half, top.
    [0, top / 2, top].forEach((value) => {
      parts.push(svgNode('line', { class: 'chart-grid', x1: pad.left, x2: width - pad.right, y1: Math.round(y(value)), y2: Math.round(y(value)) }));
      parts.push(svgNode('text', { class: 'chart-label', x: pad.left - 8, y: Math.round(y(value)) + 4, 'text-anchor': 'end' }, compact(value)));
    });
    // x ticks every 1/2/3/6/12/24/48 hours, at most about six of them.
    const hours = (end - start) / 3600;
    const step = [1, 2, 3, 6, 12, 24, 48, 168].find((h) => hours / h <= (narrow ? 4 : 6)) || 336;
    const longSpan = hours > 36;
    for (let t = Math.ceil(start / (step * 3600)) * step * 3600; t <= end; t += step * 3600) {
      const at = Math.round(x(t));
      const when = new Date(t * 1000);
      parts.push(svgNode('line', { class: 'chart-tick', x1: at, x2: at, y1: stripBase, y2: stripBase + 6 }));
      parts.push(svgNode('text', { class: 'chart-label', x: at, y: height - 8, 'text-anchor': 'middle' },
        longSpan ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : when.toLocaleTimeString(undefined, { hour: 'numeric' })));
    }
    // each add's own size (square-root scale so small adds still show), in the strip under the total.
    parts.push(svgNode('text', { class: 'chart-label', x: pad.left - 8, y: stripBase - 4, 'text-anchor': 'end' }, 'each'));
    parts.push(svgNode('line', { class: 'chart-axis', x1: pad.left, x2: width - pad.right, y1: stripBase, y2: stripBase }));
    adds.forEach((add) => {
      const h = Math.max(3, Math.round(Math.sqrt(add[key] / biggest) * strip));
      parts.push(svgNode('rect', { class: 'chart-bar', x: Math.round(x(add.t)) - 1, y: stripBase - h, width: 3, height: h }));
    });
    // running total: a step up at every add, flat until now. It starts above zero when /log only lists the later adds.
    const first = adds[0];
    const left = Math.round(x(start));
    const startY = Math.round(y(first.total[key] - first[key]));
    const steps = adds.map((add) => `H${Math.round(x(add.t))}V${Math.round(y(add.total[key]))}`).join('') + `H${Math.round(x(end))}`;
    parts.push(svgNode('path', { class: 'chart-water', d: `M${left} ${floor}V${startY}${steps}V${floor}Z` }));
    parts.push(svgNode('path', { class: 'chart-line', d: `M${left} ${startY}${steps}` }));
    parts.push(svgNode('line', { class: 'chart-axis', x1: pad.left, x2: width - pad.right, y1: Math.round(floor), y2: Math.round(floor) }));
    if (pick >= 0) {
      const add = adds[pick];
      const at = Math.round(x(add.t));
      parts.push(svgNode('line', { class: 'chart-pick', x1: at, x2: at, y1: pad.top, y2: stripBase }));
      parts.push(svgNode('circle', { class: 'chart-dot', cx: at, cy: Math.round(y(add.total[key])), r: 6 }));
    }
    svg.replaceChildren(...parts);
    chartReadout();
  };

  // Returns how many adds the ledger lists (0 when it has none or isn't there). If /log ever lists only the later adds,
  // the totals cover what's missing: the running total starts at the difference, so it still ends at the real total.
  const drawAdds = (transactions, totals = {}) => {
    const raw = (Array.isArray(transactions) ? transactions : [])
      .filter((entry) => entry && entry.kind === 'deposit' && typeof entry.signature === 'string' && isAmount(entry.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);
    const amountOf = (entry, { field, decimals }) => {
      const value = Number(entry[field]) / 10 ** decimals;
      return Number.isFinite(value) && value > 0 ? value : 0;
    };
    const running = {};
    Object.entries(CHART).forEach(([key, spec]) => {
      const listed = raw.reduce((sum, entry) => sum + amountOf(entry, spec), 0);
      const missing = isAmount(totals[spec.total]) ? totals[spec.total] - listed : 0;
      running[key] = missing > listed * 0.001 ? missing : 0;
    });
    const adds = raw.map((entry) => {
      const add = { t: entry.timestamp, signature: entry.signature };
      Object.entries(CHART).forEach(([key, spec]) => {
        add[key] = amountOf(entry, spec);
        running[key] += add[key];
      });
      add.total = { ...running };
      return add;
    });
    // a refresh that brings a new add drops the picked one, so the readout shows the newest.
    if (adds.length !== chartState.adds.length) chartState.pick = -1;
    chartState.adds = adds;
    $('pool-chart').hidden = !adds.length;
    drawChart();
    return adds.length;
  };

  document.querySelectorAll('[data-chart-key]').forEach((button) => {
    button.addEventListener('click', () => {
      chartState.key = button.dataset.chartKey;
      document.querySelectorAll('[data-chart-key]').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      drawChart();
    });
  });
  const chartSvg = $('pp-chart');
  const pickAt = (clientX) => {
    const { adds } = chartState;
    if (!adds.length) return;
    const box = chartSvg.getBoundingClientRect();
    const width = Number(chartSvg.getAttribute('width')) || box.width;
    const at = ((clientX - box.left) / box.width) * width;
    // nearest add by its x position, read back from the bars.
    const bars = [...chartSvg.querySelectorAll('.chart-bar')].map((bar) => Number(bar.getAttribute('x')) + 1);
    let best = 0;
    bars.forEach((bx, i) => { if (Math.abs(bx - at) < Math.abs(bars[best] - at)) best = i; });
    if (best !== chartState.pick) { chartState.pick = best; drawChart(); }
  };
  chartSvg.addEventListener('pointermove', (event) => pickAt(event.clientX));
  chartSvg.addEventListener('pointerdown', (event) => pickAt(event.clientX));
  chartSvg.addEventListener('keydown', (event) => {
    const { adds } = chartState;
    if (!adds.length) return;
    const from = chartState.pick >= 0 ? chartState.pick : adds.length - 1;
    const to = { ArrowLeft: from - 1, ArrowRight: from + 1, Home: 0, End: adds.length - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    chartState.pick = Math.min(adds.length - 1, Math.max(0, to));
    drawChart();
  });
  if ('ResizeObserver' in window) {
    let lastWidth = 0;
    new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width !== lastWidth) { lastWidth = width; drawChart(); }
    }).observe(chartSvg.parentElement);
  }

  const showActive = (data) => {
    const totals = data.totals || {};
    $('pp-sol').textContent = amount(totals.solAdded);
    $('pp-duk').textContent = whole(totals.dukAdded);
    $('pp-lp').textContent = amount(totals.lpBurned);
    const sol = isAmount(totals.solAdded) ? totals.solAdded : 0;
    // Illustrative log scale, capped at 64% so the floating duck's head stays above the frame edge.
    const level = Math.min(64, 18 + Math.log10(1 + sol) * 22);
    setLevel(level, sol > 0 ? `${amount(sol)} sol added so far.` : 'pool found. no adds yet.');
    const recent = newestFirst(data.recent);
    const adds = drawAdds(data.transactions, totals);
    $('pp-state-text').textContent = recent.length
      ? `running. last checked ${clock(new Date())}.`
      : `running. waiting for enough fees for the first add. last checked ${clock(new Date())}.`;
    $('pp-count').textContent = !recent.length
      ? 'no adds yet. the keeper is waiting for enough fees.'
      : adds > recent.length
        ? `${adds} adds so far. the newest ${recent.length} are here, newest first.`
        : `${recent.length} ${recent.length === 1 ? 'receipt' : 'receipts'} on file. newest first.`;
    $('pp-rows').replaceChildren(...(recent.length ? recent.map(receiptRow) : [emptyRow('— no adds yet. the keeper is waiting for enough fees.')]));
  };

  let busy = false;
  const update = async () => {
    if (!keeperURL) { showPending('not connected yet.'); showWallet(null); return; }
    if (busy) return;
    busy = true;
    $('pp-refresh').disabled = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(keeperURL, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('keeper unavailable');
      const data = await response.json();
      showWallet(data);
      if (data && data.state === 'active') showActive(data);
      else showPending(waitingLabel(data));
    } catch {
      showWallet(null);
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
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = meme.thumb || meme.src;
    image.alt = meme.alt || meme.title || 'duk in the pool.';
    image.width = 1200;
    image.height = 1200;
    const caption = document.createElement('span');
    caption.textContent = meme.title || 'just duk.';
    const action = document.createElement('b');
    action.textContent = 'full size ↗';
    caption.append(action);
    link.append(image, caption);
    return link;
  };

  window.dukMedia()
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
