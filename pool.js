(() => {
  'use strict';
  const config = window.DUK_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const REFRESH_MS = 120000; // /log carries the keeper's ledger; every two minutes is plenty
  const TIMEOUT_MS = 8000;

  const keeperURL = (() => {
    if (typeof config.KEEPER_URL !== 'string' || !config.KEEPER_URL.trim()) return null;
    try {
      const url = new URL(config.KEEPER_URL.trim());
      // limit=0: no transaction list; totals, recent receipts, curve buys and the hourly/daily add summaries are all we use.
      return ['https:', 'http:'].includes(url.protocol) ? `${url.href.replace(/\/+$/, '')}/log?limit=0` : null;
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
    $('pp-post').hidden = true;
  };

  // "post the receipts": an x post with today's add count (utc; the total when today has none yet) and this page.
  const postReceipts = (data, adds) => {
    const today = new Date().toISOString().slice(0, 10);
    const row = (Array.isArray(data.daily) ? data.daily : []).find((day) => day && day.day === today);
    const todays = row && Number.isInteger(row.adds) ? row.adds : 0;
    const count = todays
      ? `${todays} ${todays === 1 ? 'add' : 'adds'} today.`
      : `${adds} ${adds === 1 ? 'add' : 'adds'} so far.`;
    const page = `${(typeof config.SITE === 'string' && /^https:\/\//.test(config.SITE) ? config.SITE : 'https://duk.fun').replace(/\/+$/, '')}/pool.html`;
    $('pp-post').href = `https://x.com/intent/post?text=${encodeURIComponent(
      `fees went in the pool.\n${count} the lp from every add got burned.\nreceipts: ${page}\n\njust duk. $DUK`)}`;
    $('pp-post').hidden = !adds;
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

  // Fees claimed and the launch-day curve buys. Missing fields show '—'.
  const showWallet = (data) => {
    const totals = (data && data.totals) || {};
    $('pp-claimed').textContent = amount(totals.solClaimed);
    const buys = newestFirst(data && data.curve_buys).slice(0, 20);
    $('pp-curve-count').textContent = buys.length
      ? `${buys.length} ${buys.length === 1 ? 'buy' : 'buys'} on launch day, newest first. the bot doesn't buy on the curve anymore.`
      : 'each buy links to its transaction on solscan.';
    $('pp-curve-rows').replaceChildren(...(buys.length
      ? buys.map((entry) => txRow(entry, [['solIn', 'sol in'], ['dukOut', 'duk out']]))
      : [emptyRow(data ? '— no curve buys.' : "— the keeper didn't answer. try again in a minute.", 4)]));
  };

  /* ---------- the adds, over time ----------
     /log 'hourly' (the last 48 utc hours) and 'daily' (every utc day since the first add) count the keeper's adds:
     { hour | day, timestamp (bucket start, unix s), adds, solAdded, dukAdded, lpBurned }, oldest first, zero-filled.
     The chart is the running total (a step per bucket) with each bucket's own amount as a bar underneath. The hourly
     window starts after the first add, so its running total starts at whatever came before (totals minus the window). */
  const CHART = {
    sol: { field: 'solAdded', unit: 'sol', format: new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }) },
    duk: { field: 'dukAdded', unit: 'duk', format: wholeNumbers },
    lp: { field: 'lpBurned', unit: 'lp burned', format: new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }) },
  };
  const SPANS = {
    hourly: { seconds: 3600, words: 'per hour, the last 48 hours',
      label: (t) => new Date(t * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' }) },
    daily: { seconds: 86400, words: 'per day, since the first add',
      label: (t) => new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) },
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
  const chartState = { rows: { hourly: [], daily: [] }, span: 'hourly', key: 'sol', pick: -1 };
  const chartRows = () => chartState.rows[chartState.span];
  // Smallest of 1, 2, 2.5, 5 x 10^n at or above the value, so the top line reads as a round number.
  const niceTop = (value) => {
    if (!(value > 0)) return 1;
    const power = 10 ** Math.floor(Math.log10(value));
    return [1, 2, 2.5, 5, 10].map((step) => step * power).find((step) => step >= value);
  };
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

  const chartReadout = () => {
    const rows = chartRows();
    const readout = $('pp-chart-readout');
    if (!rows.length) { readout.replaceChildren(); return; }
    const { pick, key, span } = chartState;
    const row = rows[pick >= 0 ? pick : rows.length - 1];
    const { unit, format } = CHART[key];
    const when = SPANS[span].label(row.t);
    readout.textContent = `${pick >= 0 ? when : `${span === 'hourly' ? 'this hour' : 'today'} (${when})`}: ${plural(row.adds, 'add')}, `
      + `+${format.format(row[key])} ${unit}. running total ${format.format(row.total[key])} ${unit}.`;
  };

  const drawChart = () => {
    const svg = $('pp-chart');
    const rows = chartRows();
    if (!rows.length || !svg.parentElement.clientWidth) return;
    const { key, pick, span } = chartState;
    const { unit, format } = CHART[key];
    const { seconds, words } = SPANS[span];
    const width = svg.parentElement.clientWidth;
    const narrow = width < 560;
    // the running total on top, a strip of each bucket's own amount under its axis, then the time labels.
    const strip = narrow ? 30 : 40;
    const height = narrow ? 260 : 330;
    const pad = { left: narrow ? 46 : 62, right: 16, top: 18, bottom: 30 + strip + 12 };
    const start = rows[0].t;
    const end = rows[rows.length - 1].t + seconds;
    const last = rows[rows.length - 1];
    const top = niceTop(last.total[key]);
    const biggest = Math.max(...rows.map((row) => row[key])) || 1;
    const x = (t) => pad.left + ((t - start) / (end - start)) * (width - pad.left - pad.right);
    const y = (v) => height - pad.bottom - (v / top) * (height - pad.top - pad.bottom);
    const floor = Math.round(y(0));
    const stripBase = floor + 12 + strip;
    const slot = (width - pad.left - pad.right) / rows.length;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    const adds = rows.reduce((sum, row) => sum + row.adds, 0);
    svg.setAttribute('aria-label', `running total of ${unit} the keeper added to the pool, ${words}: ${plural(adds, 'add')} in that time, `
      + `${format.format(last.total[key])} ${unit} so far. use the arrow keys to step through them.`);

    const parts = [];
    // gridlines + y labels at 0, half, top.
    [0, top / 2, top].forEach((value) => {
      parts.push(svgNode('line', { class: 'chart-grid', x1: pad.left, x2: width - pad.right, y1: Math.round(y(value)), y2: Math.round(y(value)) }));
      parts.push(svgNode('text', { class: 'chart-label', x: pad.left - 8, y: Math.round(y(value)) + 4, 'text-anchor': 'end' }, compact(value)));
    });
    // x labels: every 1/2/3/6/12 hours (local time), or every n days (utc, like the buckets), at most about six.
    const target = narrow ? 4 : 6;
    const every = span === 'hourly' ? [1, 2, 3, 6, 12].find((n) => rows.length / n <= target) || 12 : Math.max(1, Math.ceil(rows.length / target));
    rows.forEach((row, i) => {
      if ((rows.length - 1 - i) % every) return;
      const at = Math.round(x(row.t + seconds / 2));
      const label = span === 'hourly'
        ? new Date(row.t * 1000).toLocaleTimeString(undefined, { hour: 'numeric' })
        : SPANS.daily.label(row.t);
      parts.push(svgNode('line', { class: 'chart-tick', x1: at, x2: at, y1: stripBase, y2: stripBase + 6 }));
      parts.push(svgNode('text', { class: 'chart-label', x: at, y: height - 8, 'text-anchor': 'middle' }, label));
    });
    // each bucket's own amount, in the strip under the total.
    parts.push(svgNode('text', { class: 'chart-label', x: pad.left - 8, y: stripBase - 4, 'text-anchor': 'end' }, span === 'hourly' ? 'hour' : 'day'));
    parts.push(svgNode('line', { class: 'chart-axis', x1: pad.left, x2: width - pad.right, y1: stripBase, y2: stripBase }));
    const barWidth = Math.max(2, Math.min(40, Math.floor(slot) - 2));
    rows.forEach((row) => {
      if (!(row[key] > 0)) return;
      const h = Math.max(2, Math.round((row[key] / biggest) * strip));
      parts.push(svgNode('rect', { class: 'chart-bar', x: Math.round(x(row.t + seconds / 2) - barWidth / 2), y: stripBase - h, width: barWidth, height: h }));
    });
    // running total: a step at every bucket with adds, flat otherwise.
    const left = Math.round(x(start));
    const startY = Math.round(y(rows[0].total[key] - rows[0][key]));
    const steps = rows.map((row) => `H${Math.round(x(row.t))}V${Math.round(y(row.total[key]))}`).join('') + `H${Math.round(x(end))}`;
    parts.push(svgNode('path', { class: 'chart-water', d: `M${left} ${floor}V${startY}${steps}V${floor}Z` }));
    parts.push(svgNode('path', { class: 'chart-line', d: `M${left} ${startY}${steps}` }));
    parts.push(svgNode('line', { class: 'chart-axis', x1: pad.left, x2: width - pad.right, y1: floor, y2: floor }));
    if (pick >= 0) {
      const row = rows[pick];
      const at = Math.round(x(row.t + seconds / 2));
      parts.push(svgNode('line', { class: 'chart-pick', x1: at, x2: at, y1: pad.top, y2: stripBase }));
      parts.push(svgNode('circle', { class: 'chart-dot', cx: at, cy: Math.round(y(row.total[key])), r: 6 }));
    }
    svg.replaceChildren(...parts);
    chartReadout();
  };

  // Takes /log; returns the total number of adds (0 when there are none or the summaries are missing).
  const drawAdds = (data) => {
    const totals = data.totals || {};
    const bucketed = (list) => {
      const rows = (Array.isArray(list) ? list : [])
        .filter((row) => row && isAmount(row.timestamp))
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((row) => ({ t: row.timestamp, adds: isAmount(row.adds) ? row.adds : 0,
          ...Object.fromEntries(Object.entries(CHART).map(([key, { field }]) => [key, isAmount(row[field]) ? row[field] : 0])) }));
      const running = Object.fromEntries(Object.entries(CHART).map(([key, { field }]) => {
        const listed = rows.reduce((sum, row) => sum + row[key], 0);
        const before = isAmount(totals[field]) ? totals[field] - listed : 0;
        return [key, before > listed * 0.001 ? before : 0];
      }));
      return rows.map((row) => {
        Object.keys(CHART).forEach((key) => { running[key] += row[key]; });
        return { ...row, total: { ...running } };
      });
    };
    const daily = bucketed(data.daily);
    // hours before the very first add (nothing before them either) are dropped, keeping one empty hour as a lead-in.
    const hours = bucketed(data.hourly);
    const firstAdd = hours.findIndex((row) => row.total.sol > 0 || row.adds > 0);
    const hourly = hours.slice(Math.max(0, firstAdd - 1));
    // a refresh that adds a bucket drops the picked one, so the readout shows the newest.
    if (hourly.length !== chartState.rows.hourly.length || daily.length !== chartState.rows.daily.length) chartState.pick = -1;
    chartState.rows = { hourly, daily };
    const adds = daily.reduce((sum, row) => sum + row.adds, 0);
    $('pool-chart').hidden = !adds;
    drawChart();
    return adds;
  };

  const chartButtons = (attribute, apply) => document.querySelectorAll(`[${attribute}]`).forEach((button) => {
    button.addEventListener('click', () => {
      apply(button);
      document.querySelectorAll(`[${attribute}]`).forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      drawChart();
    });
  });
  chartButtons('data-chart-key', (button) => { chartState.key = button.dataset.chartKey; });
  chartButtons('data-chart-span', (button) => { chartState.span = button.dataset.chartSpan; chartState.pick = -1; });
  const chartSvg = $('pp-chart');
  const pickAt = (clientX) => {
    const rows = chartRows();
    const width = Number(chartSvg.getAttribute('width'));
    if (!rows.length || !width) return;
    const box = chartSvg.getBoundingClientRect();
    const left = width < 560 ? 46 : 62; // drawChart's pad.left
    const at = ((clientX - box.left) / box.width) * width;
    const index = Math.min(rows.length - 1, Math.max(0, Math.floor(((at - left) / (width - left - 16)) * rows.length)));
    if (index !== chartState.pick) { chartState.pick = index; drawChart(); }
  };
  // the readout only speaks (aria-live) for a key press or a tap; hovering and the two-minute refresh stay quiet.
  const speak = (on) => $('pp-chart-readout').setAttribute('aria-live', on ? 'polite' : 'off');
  chartSvg.addEventListener('pointermove', (event) => { if (event.pointerType === 'mouse') speak(false); pickAt(event.clientX); });
  chartSvg.addEventListener('pointerdown', (event) => { speak(true); pickAt(event.clientX); });
  chartSvg.addEventListener('keydown', (event) => {
    speak(true);
    const rows = chartRows();
    if (!rows.length) return;
    const from = chartState.pick >= 0 ? chartState.pick : rows.length - 1;
    const to = { ArrowLeft: from - 1, ArrowRight: from + 1, Home: 0, End: rows.length - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    chartState.pick = Math.min(rows.length - 1, Math.max(0, to));
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
    const adds = drawAdds(data);
    $('pp-state-text').textContent = recent.length
      ? `running. last checked ${clock(new Date())}.`
      : `running. waiting for enough fees for the first add. last checked ${clock(new Date())}.`;
    $('pp-count').textContent = !recent.length
      ? 'no adds yet. the keeper is waiting for enough fees.'
      : adds > recent.length
        ? `${adds} adds so far. the newest ${recent.length} are here, newest first.`
        : `${recent.length} ${recent.length === 1 ? 'receipt' : 'receipts'} on file. newest first.`;
    $('pp-rows').replaceChildren(...(recent.length ? recent.map(receiptRow) : [emptyRow('— no adds yet. the keeper is waiting for enough fees.')]));
    postReceipts(data, Math.max(adds, recent.length));
  };

  let busy = false;
  let lastShown = 0; // when a real answer last went on the page (0: not yet)
  let retry = 0; // the one pending 30 s recheck while the keeper restarts
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
      if (data && data.last_run === null) {
        // just restarted: it rebuilds its ledger from the chain (about a minute) and reports zeros until then.
        // Keep whatever is on the page and look again in 30 seconds.
        const note = 'restarting. counting the receipts again from the chain, back in about a minute.';
        if (lastShown) $('pp-state-text').textContent = `${note} the numbers here are from ${clock(new Date(lastShown))}.`;
        else showPending(note);
        window.clearTimeout(retry);
        retry = window.setTimeout(update, 30000);
        return;
      }
      showWallet(data);
      if (data && data.state === 'active') showActive(data);
      else showPending(waitingLabel(data));
      lastShown = Date.now();
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
