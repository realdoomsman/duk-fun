// Duk of the day: today's pick big, then every day so far (window.dukDaily in app.js; history in assets/daily.json).
// Past days carry id 'day-YYYY-MM-DD' so a date can be linked.
(() => {
  const $ = (selector) => document.querySelector(selector);
  const list = $('[data-days]');
  if (!list || !window.dukDaily) return;
  const longDate = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).toLowerCase();
  const shortDate = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toLowerCase();
  const archiveHref = (src) => `memes.html#${src.replace(/^assets\//, '')}`;
  // "duk of the day, nov 26." + its caption, linking the day's own card (or the meme's before the sync records the day).
  const postHref = (day) => `https://x.com/intent/post?text=${encodeURIComponent(
    `duk of the day, ${shortDate(day.date)}.\n${String(day.title || 'just duk.').replace(/\s*\$duk\s*$/i, '')}\n\njust duk. $DUK\n${window.dukDailyShare(day)}`)}`;

  const next = $('[data-daily-next]');
  const countdown = () => {
    const now = Date.now();
    const left = Math.ceil((86400000 - (now % 86400000)) / 60000);
    if (next) next.textContent = `next one in ${Math.floor(left / 60)}h ${left % 60}m.`;
  };
  countdown();
  window.setInterval(countdown, 30000);

  // Your streak (window.dukStreak from app.js): utc days in a row on the site, with a post link to brag.
  const streak = window.dukStreak;
  const streakBox = $('[data-daily-streak]');
  if (streak && streakBox) {
    const { days, best } = streak;
    $('[data-streak-days]').textContent = days === 1 ? 'day 1.' : `day ${days} in a row.`;
    $('[data-streak-note]').textContent = days === 1
      ? `come back tomorrow and it's two.${best > 1 ? ` best so far: ${best}.` : ''}`
      : `he's been on the floor the whole time.${best > days ? ` best so far: ${best}.` : ''}`;
    const text = `${days === 1 ? 'day 1 of ducking.' : `day ${days} of ducking in a row.`} duk.\n\njust duk. $DUK\nhttps://duk.fun/daily.html`;
    $('[data-streak-post]').href = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
    streakBox.hidden = false;
  }

  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    if ('loading' in props) node.loading = props.loading;
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'loading') return;
      if (key === 'text') node.textContent = value;
      else node.setAttribute(key === 'className' ? 'class' : key, value);
    });
    node.append(...children.filter(Boolean));
    return node;
  };

  const showLinked = () => {
    let wanted = '';
    try { wanted = decodeURIComponent(window.location.hash.slice(1)); } catch { /* not ours. */ }
    list.querySelectorAll('.is-linked').forEach((node) => node.classList.remove('is-linked'));
    const linked = /^day-\d{4}-\d{2}-\d{2}$/.test(wanted) && document.getElementById(wanted);
    if (!linked) return;
    linked.classList.add('is-linked');
    linked.scrollIntoView({ block: 'center' });
  };

  window.dukDaily().then(({ days, today }) => {
    if (today) {
      const img = $('[data-daily-img]');
      Object.assign(img, { src: today.src, width: 1200, height: 1200, alt: today.alt || today.title || 'today\'s duk' });
      $('[data-daily-art]').href = archiveHref(today.src);
      $('[data-daily-art]').setAttribute('aria-label', `open today's duk in the archive: ${today.title || 'just duk.'}`);
      $('[data-daily-date]').textContent = longDate(today.date);
      $('[data-daily-caption]').textContent = today.title || 'just duk.';
      $('[data-daily-post]').href = postHref(today);
      $('[data-daily-remix]').href = `maker.html?base=${encodeURIComponent(today.src)}#maker`;
      const download = $('[data-daily-download]');
      download.href = today.src;
      download.setAttribute('download', `duk-of-the-day-${today.date}.${today.src.split('.').pop()}`);
      $('[data-daily-actions]').hidden = false;
    } else {
      $('[data-daily-caption]').textContent = 'no duk today. he ducked.';
    }
    const past = days.filter((day) => day !== today);
    list.replaceChildren(...past.map((day) => el('li', { className: 'daily-day', id: `day-${day.date}` },
      el('a', { className: 'daily-day-art', href: archiveHref(day.src), 'aria-label': `${shortDate(day.date)}: ${day.title || 'just duk.'}` },
        el('img', { loading: 'lazy', src: day.thumb || day.src, alt: '', width: '480', height: '480', decoding: 'async' })),
      el('p', { className: 'daily-day-date' }, el('time', { datetime: day.date, text: shortDate(day.date) })),
      el('p', { className: 'daily-day-title', text: day.title || 'just duk.' }),
      el('a', { className: 'daily-day-post', href: postHref(day), target: '_blank', rel: 'noopener noreferrer', text: 'post it' }))));
    $('[data-days-empty]').hidden = past.length > 0;
    $('[data-days-count]').textContent = `${days.length} ${days.length === 1 ? 'day' : 'days'} of duk.`;
    showLinked();
    window.addEventListener('hashchange', showLinked);
  }).catch(() => { $('[data-daily-caption]').textContent = 'couldn\'t load today\'s duk. he\'s still here.'; });
})();
