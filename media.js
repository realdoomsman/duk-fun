// stickers.html + watch.html: everything renders from the shared media index (app.js), so new packs, gifs and clips just show up.
(() => {
  'use strict';
  const config = window.DUK_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const site = (typeof config.SITE === 'string' && /^https:\/\//.test(config.SITE) ? config.SITE : 'https://duk.fun').replace(/\/+$/, '') + '/';

  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key in node && typeof value !== 'string') node[key] = value;
      else node.setAttribute(key, value === true ? '' : value);
    });
    node.append(...children.filter(Boolean));
    return node;
  };
  const absolute = (path) => new URL(path, site).href;
  const fileName = (path) => decodeURIComponent(String(path).split('/').pop());
  const extension = (path) => (String(path).split('.').pop() || '').toLowerCase();
  const clock = (seconds) => {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };
  const spokenLength = (seconds) => {
    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return [minutes && `${minutes} minute${minutes === 1 ? '' : 's'}`, rest && `${rest} second${rest === 1 ? '' : 's'}`].filter(Boolean).join(' ');
  };
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

  // Looping previews only load and play while on screen. Reduced motion: loaded, never autoplayed.
  const loops = new Set();
  const loadVideo = (video) => {
    if (video.dataset.loaded) return;
    video.dataset.loaded = 'true';
    if (video.dataset.src) video.src = video.dataset.src;
    video.preload = 'metadata';
    video.load();
  };
  const shouldPlay = (video) => !reducedMotion.matches && video.dataset.userPaused !== 'true';
  const syncToggle = (video) => {
    const toggle = video.duk_toggle;
    if (!toggle) return;
    const action = video.paused ? 'play' : 'pause';
    toggle.textContent = action;
    toggle.setAttribute('aria-label', `${action} ${toggle.dataset.label}`);
  };
  const loopObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        loadVideo(target);
        if (shouldPlay(target)) target.play().catch(() => syncToggle(target));
      } else if (!target.paused) {
        target.pause();
      }
    });
  }, { rootMargin: '200px' }) : null;
  const watchLoop = (video) => {
    loops.add(video);
    // attributes as well as properties: iOS Safari only autoplays inline when both are there.
    video.muted = true;
    video.setAttribute('muted', '');
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'none';
    video.addEventListener('play', () => syncToggle(video));
    video.addEventListener('pause', () => syncToggle(video));
    if (loopObserver) loopObserver.observe(video);
    else {
      loadVideo(video);
      if (shouldPlay(video)) video.play().catch(() => syncToggle(video));
    }
  };
  const loopToggle = (video, label) => {
    const toggle = el('button', { type: 'button', class: 'loop-toggle', 'data-label': label, 'aria-label': `play ${label}`, text: 'play' });
    video.duk_toggle = toggle;
    toggle.addEventListener('click', () => {
      loadVideo(video);
      if (video.paused) {
        video.dataset.userPaused = 'false';
        video.play().catch(() => syncToggle(video));
      } else {
        video.dataset.userPaused = 'true';
        video.pause();
      }
    });
    return toggle;
  };
  reducedMotion.addEventListener?.('change', () => {
    loops.forEach((video) => { if (reducedMotion.matches) video.pause(); });
  });

  const copyText = async (text, status, done) => {
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = done;
    } catch {
      status.textContent = `copy this: ${text}`;
    }
  };

  // muted looping mp4 that swaps itself for the gif if the mp4 can't load here.
  const loopingArt = ({ mp4, gif, poster, label, toggleLabel, cls, size }) => {
    const gifImage = () => el('img', { class: cls, src: gif, alt: label, width: size, height: size, loading: 'lazy', decoding: 'async' });
    if (!mp4) return { media: gifImage() };
    // src stays in data-src until the video is on screen. a <source> with no src counts as a failed
    // candidate in webkit/chromium, which used to trip the gif fallback before anything loaded.
    const video = el('video', { class: cls, width: size, height: size, 'aria-label': label, poster, disablePictureInPicture: true, 'data-src': mp4 });
    watchLoop(video);
    const toggle = loopToggle(video, toggleLabel);
    if (gif) {
      const fallBack = () => {
        if (!video.getAttribute('src')) return;
        video.removeEventListener('error', fallBack);
        loopObserver?.unobserve(video);
        loops.delete(video);
        video.replaceWith(gifImage());
        toggle.remove();
      };
      video.addEventListener('error', fallBack);
    }
    return { media: video, toggle };
  };

  /* ---------- stickers ---------- */
  // alpha webm renders black or not at all on iphone safari and x can't post it,
  // so motion stickers preview and download as mp4/gif; the webm is a small extra.
  const isWebm = (item) => item.type === 'webm' || extension(item.src) === 'webm';
  const hasExport = (item) => Boolean(item.mp4 || item.gif);
  const downloadsFor = (item) => (isWebm(item) ? [item.gif, item.mp4, item.src].filter(Boolean) : [item.src]);
  const stickerPreview = (item, label) => {
    if (isWebm(item) && hasExport(item)) {
      return loopingArt({ mp4: item.mp4, gif: item.gif, poster: null, label, toggleLabel: label, cls: 'sticker-art', size: 512 });
    }
    if (isWebm(item)) {
      // no export exists for this one: the webm is all there is.
      const video = el('video', { class: 'sticker-art', width: 512, height: 512, 'aria-label': label, 'data-src': item.src, disablePictureInPicture: true });
      watchLoop(video);
      return { media: video, toggle: loopToggle(video, label) };
    }
    return { media: el('img', { class: 'sticker-art', src: item.thumb || item.src, alt: label, width: 512, height: 512, loading: 'lazy', decoding: 'async' }) };
  };
  const packUse = (items) => {
    const motion = items.filter(isWebm);
    if (!motion.length) return 'these work as x reply media.';
    const exported = motion.filter(hasExport).length;
    if (exported === motion.length) return 'the gif and mp4 work on x. the webm is there if you want it.';
    if (!exported) return 'preview only. x doesn\u2019t take webm.';
    return 'the gif and mp4 work on x.';
  };

  const renderPack = (pack, index) => {
    const items = Array.isArray(pack.items) ? pack.items : [];
    const id = `pack-${String(pack.id || index).replace(/[^a-z0-9_-]/gi, '-')}`;
    const name = pack.name || 'unnamed pack';
    const animated = pack.kind === 'animated';
    const headingId = `${id}-title`;
    const section = el('section', { class: 'sticker-pack', id, 'aria-labelledby': headingId });

    const head = el('div', { class: pack.icon ? 'sticker-pack-head' : 'sticker-pack-head no-icon' });
    if (pack.icon) head.append(el('img', { class: 'sticker-pack-icon', src: pack.icon, alt: '', width: 100, height: 100, loading: 'lazy' }));
    head.append(el('div', { class: 'sticker-pack-title' },
      el('p', { class: 'sticker-pack-number', text: `pack ${String(index + 1).padStart(2, '0')}` }),
      el('h2', { id: headingId, text: name }),
      el('p', { class: 'sticker-pack-meta' },
        el('span', { text: plural(items.length, 'sticker') }),
        el('span', { class: 'sticker-kind', text: animated ? 'animated' : 'static' }),
        items.length ? el('span', { text: `files: ${[...new Set(items.flatMap(downloadsFor).map(extension))].join(', ')}` }) : null)));

    const actions = el('div', { class: 'sticker-pack-actions' });
    if (items.length) actions.append(el('p', { class: 'sticker-use', text: packUse(items) }));
    if (pack.contact) {
      actions.append(el('a', { class: 'button sticker-sheet', href: pack.contact, download: fileName(pack.contact), text: 'download the sheet', 'aria-label': `download the contact sheet for ${name} (${extension(pack.contact)})` }));
    }
    head.append(actions);
    section.append(head);

    if (!items.length) {
      section.append(el('p', { class: 'media-empty', text: 'nothing in this pack yet.' }));
      return section;
    }
    const grid = el('ul', { class: 'sticker-grid', 'aria-label': `${name} stickers` });
    // per-item note only in mixed packs; a pack with no exports says it once in its head.
    const anyExport = items.some((item) => isWebm(item) && hasExport(item));
    items.forEach((item, itemIndex) => {
      const caption = item.alt || `sticker ${itemIndex + 1}.`;
      const label = `duk sticker: ${caption}`;
      const { media, toggle } = stickerPreview(item, label);
      // the mp4/gif exports are flat on white, so their frame goes white to match.
      const frame = el('div', { class: isWebm(item) && hasExport(item) ? 'sticker-frame is-export' : 'sticker-frame' }, media);
      if (toggle) frame.append(toggle);
      grid.append(el('li', { class: 'sticker-card' },
        frame,
        el('p', { class: 'sticker-caption', text: caption }),
        el('p', { class: 'sticker-downloads' },
          el('span', { text: 'download' }),
          ...downloadsFor(item).map((src) => el('a', {
            class: isWebm(item) && hasExport(item) && src === item.src ? 'sticker-download sticker-extra' : 'sticker-download',
            href: src, download: fileName(src), 'aria-label': `download ${caption} as ${extension(src)}`, text: extension(src) }))),
        anyExport && isWebm(item) && !hasExport(item) ? el('p', { class: 'sticker-note', text: 'preview only. x doesn\u2019t take webm.' }) : null));
    });
    section.append(grid);
    return section;
  };

  const renderStickers = (media) => {
    const packs = (Array.isArray(media.stickerPacks) ? media.stickerPacks : []).filter((pack) => pack && Array.isArray(pack.items));
    const list = $('sticker-packs');
    const index = $('pack-index');
    const total = packs.reduce((sum, pack) => sum + pack.items.length, 0);
    $('sticker-status').textContent = packs.length
      ? `${plural(packs.length, 'pack')}, ${plural(total, 'sticker')}.`
      : 'no packs yet.';
    const sections = packs.map(renderPack);
    list.replaceChildren(...sections);
    list.setAttribute('aria-busy', 'false');
    if (packs.length > 1) {
      index.replaceChildren(...sections.map((section, i) => el('li', {}, el('a', { href: `#${section.id}` }, el('span', { text: packs[i].name || 'unnamed pack' }), el('b', { text: String(packs[i].items.length) })))));
      $('pack-index-wrap').hidden = false;
    }
    renderGifs(Array.isArray(media.gifs) ? media.gifs.filter((gif) => gif && (gif.mp4 || gif.gif)) : []);
  };

  const renderGifs = (gifs) => {
    const grid = $('gif-grid');
    $('gif-count').textContent = gifs.length ? plural(gifs.length, 'gif') : '';
    if (!gifs.length) {
      grid.hidden = true;
      $('gif-empty').hidden = false;
      return;
    }
    grid.replaceChildren(...gifs.map((gif, i) => {
      const title = gif.title || `reaction ${i + 1}.`;
      const label = gif.alt || `duk reaction: ${title}`;
      const titleId = `gif-${i}-title`;
      const { media: art, toggle } = loopingArt({ mp4: gif.mp4, gif: gif.gif, poster: gif.poster, label, toggleLabel: title, cls: 'gif-art', size: 480 });
      const status = el('p', { class: 'gif-status', role: 'status', 'aria-live': 'polite' });
      const share = gif.gif || gif.mp4;
      const copy = el('button', { type: 'button', class: 'gif-copy', text: 'copy link', 'aria-describedby': titleId });
      copy.addEventListener('click', () => copyText(absolute(share), status, 'link copied.'));
      const buttons = el('div', { class: 'gif-actions' },
        gif.gif ? el('a', { href: gif.gif, download: fileName(gif.gif), text: 'gif', 'aria-label': `download ${title} as gif` }) : null,
        gif.mp4 ? el('a', { href: gif.mp4, download: fileName(gif.mp4), text: extension(gif.mp4), 'aria-label': `download ${title} as ${extension(gif.mp4)}` }) : null,
        copy);
      return el('li', { class: 'gif-card' },
        el('div', { class: 'gif-frame' }, art, toggle),
        el('h3', { id: titleId, text: title }),
        gif.tag ? el('p', { class: 'gif-tag', text: gif.tag }) : null,
        buttons, status);
    }));
  };

  /* ---------- watch ---------- */
  const frameTime = (src) => {
    const match = /-(\d+(?:\.\d+)?)s\.[a-z]+$/i.exec(src);
    return match ? Number(match[1]) : null;
  };
  const frameLabel = (seconds) => {
    const whole = Math.floor(seconds);
    const tenth = Math.round((seconds - whole) * 10);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}${tenth ? `.${tenth}` : ''}`;
  };

  const renderTrailer = (trailer) => {
    const player = $('trailer');
    if (!trailer || !trailer.src) {
      player.hidden = true;
      $('storyboard').hidden = true;
      $('trailer-missing').hidden = false;
      return;
    }
    const video = $('trailer-video');
    const title = trailer.title || 'duk. the trailer.';
    $('trailer-title').textContent = title;
    video.setAttribute('aria-label', title);
    if (trailer.poster) video.poster = trailer.poster;
    const length = clock(trailer.duration);
    if (length) {
      const time = $('trailer-duration');
      time.textContent = length;
      time.dateTime = `PT${Math.round(trailer.duration)}S`;
      time.setAttribute('aria-label', spokenLength(trailer.duration));
      $('trailer-length').hidden = false;
    }
    const download = $('trailer-download');
    download.href = trailer.src;
    download.download = fileName(trailer.src);
    download.textContent = `download the trailer (${extension(trailer.src)})`;

    const autoplay = !reducedMotion.matches;
    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;
      video.src = trailer.src;
      video.load();
      if (autoplay) video.play().catch(() => { /* blocked autoplay leaves the native controls. */ });
    };
    video.muted = true;
    video.loop = autoplay;
    $('trailer-note').textContent = autoplay
      ? 'starts muted and loops. unmute for sound.'
      : 'reduced motion is on, so it won\u2019t autoplay. press play.';
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { load(); observer.disconnect(); }
      }, { rootMargin: '300px' });
      observer.observe(video);
    } else { load(); }
    video.addEventListener('play', load, { once: true });

    const frames = Array.isArray(trailer.frames) ? trailer.frames.filter(Boolean) : [];
    if (!frames.length) { $('storyboard').hidden = true; return; }
    $('storyboard-count').textContent = `${plural(frames.length, 'frame')}. same face in every one.`;
    $('storyboard-strip').replaceChildren(...frames.map((src, i) => {
      const seconds = frameTime(src);
      const image = el('img', { src, alt: '', width: 1080, height: 1080, loading: 'lazy', decoding: 'async' });
      if (seconds === null) {
        return el('li', {}, el('div', { class: 'storyboard-frame' }, image, el('span', { text: `frame ${i + 1}` })));
      }
      const stamp = frameLabel(seconds);
      const jump = el('button', { type: 'button', class: 'storyboard-frame', 'aria-label': `jump the trailer to ${stamp}` }, image, el('span', { text: stamp }));
      jump.addEventListener('click', () => {
        load();
        const seek = () => {
          video.currentTime = seconds;
          video.play().catch(() => {});
        };
        if (video.readyState >= 1) seek();
        else video.addEventListener('loadedmetadata', seek, { once: true });
        video.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
        video.focus({ preventScroll: true });
      });
      return el('li', {}, jump);
    }));
  };

  // one poster card that swaps itself for an inline player on tap. Each card has an id for deep links
  // (watch.html#clip-<file>), a post-it link, and an "up next" button once its clip ends.
  const videoCard = (clip, i, { kind, width, height }) => {
    const title = clip.title || `${kind} ${i + 1}.`;
    const length = clock(clip.duration);
    const titleId = `${kind}-${i}-title`;
    const id = `${kind}-${fileName(clip.src).replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-')}`;
    const stage = el('div', { class: 'clip-stage' });
    const play = el('button', { type: 'button', class: 'clip-play', 'aria-describedby': titleId, 'aria-label': `play ${title}` },
      clip.poster
        ? el('img', { src: clip.poster, alt: '', width, height, loading: 'lazy', decoding: 'async' })
        : el('img', { class: 'clip-placeholder', src: 'assets/ducking.png', alt: '', width: 1000, height: 600, loading: 'lazy' }),
      el('span', { class: 'clip-play-label', text: 'play' }));
    const next = el('button', { type: 'button', class: 'clip-next', hidden: true });
    let video = null;
    const start = () => {
      if (!video) {
        video = el('video', { class: 'clip-video', controls: true, playsInline: true, preload: 'auto', poster: clip.poster, width, height, 'aria-label': clip.alt || title, src: clip.src });
        video.addEventListener('play', () => { next.hidden = true; });
        video.addEventListener('ended', () => {
          if (!card.duk_next) return;
          next.textContent = `up next: ${card.duk_next.duk_title}`;
          next.hidden = false;
        });
        play.replaceWith(video);
      }
      video.focus({ preventScroll: true });
      video.play().catch(() => { /* controls are right there. */ });
    };
    play.addEventListener('click', start);
    next.addEventListener('click', () => {
      const upcoming = card.duk_next;
      upcoming.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
      upcoming.duk_start();
    });
    stage.append(play);
    const share = `${title}\n\njust duk. $duk\n${site}watch.html#${id}`;
    const card = el('li', { class: 'clip-card', id },
      stage,
      el('div', { class: 'clip-info' },
        el('h3', { id: titleId, text: title }),
        length ? el('time', { class: 'clip-length', dateTime: `PT${Math.round(clip.duration)}S`, 'aria-label': spokenLength(clip.duration), text: length }) : null),
      el('div', { class: 'clip-actions' },
        el('a', { class: 'clip-download', href: clip.src, download: fileName(clip.src), 'aria-label': `download ${title} (${extension(clip.src)})`, text: `download ${extension(clip.src)}` }),
        el('a', { class: 'clip-download', href: `https://x.com/intent/post?text=${encodeURIComponent(share)}`, target: '_blank', rel: 'noopener', 'aria-label': `post ${title} on x`, text: 'post it' }),
        next));
    card.duk_start = start;
    card.duk_title = title;
    return card;
  };

  const renderClips = (clips) => {
    const grid = $('clip-grid');
    $('clip-count').textContent = clips.length ? `${plural(clips.length, 'clip')}. they all end the same way.` : '';
    if (!clips.length) {
      grid.hidden = true;
      $('clip-empty').hidden = false;
      return;
    }
    const cards = clips.map((clip, i) => videoCard(clip, i, { kind: 'clip', width: clip.width || 1080, height: clip.height || 1080 }));
    cards.forEach((card, i) => { card.duk_next = cards[i + 1] || null; });
    grid.replaceChildren(...cards);
    // The cards arrive after the browser tried the hash, so honour deep links by hand.
    let wanted = '';
    try { wanted = decodeURIComponent(window.location.hash.slice(1)); } catch { /* not ours. */ }
    const linked = wanted && cards.find((card) => card.id === wanted);
    if (linked) {
      linked.classList.add('is-linked');
      linked.scrollIntoView({ block: 'center' });
      linked.querySelector('.clip-play').focus({ preventScroll: true });
    }
  };

  // One clip with sound at a time: starting one pauses the others (muted loops keep going).
  document.addEventListener('play', ({ target }) => {
    if (!(target instanceof HTMLVideoElement) || target.muted) return;
    document.querySelectorAll('video').forEach((other) => {
      if (other !== target && !other.paused && !other.muted) other.pause();
    });
  }, true);

  const renderWatch = (media) => {
    const videos = media.videos || {};
    const playable = (list) => (Array.isArray(list) ? list.filter((clip) => clip && clip.src) : []);
    renderTrailer(videos.trailer || null);
    renderClips(playable(videos.clips));
    $('watch-status').textContent = '';
  };

  const page = document.body.dataset.media;
  if (page !== 'stickers' && page !== 'watch') return;
  window.dukMedia()
    .then((media) => (page === 'stickers' ? renderStickers(media) : renderWatch(media)))
    .catch(() => {
      if (page === 'stickers') {
        $('sticker-status').textContent = 'the stickers didn\u2019t load. try reloading.';
        $('sticker-packs').setAttribute('aria-busy', 'false');
        $('gif-grid').hidden = true;
        $('gif-empty').hidden = false;
      } else {
        $('watch-status').textContent = 'the videos didn\u2019t load. try reloading.';
        $('trailer').hidden = true;
        $('storyboard').hidden = true;
        $('clip-grid').hidden = true;
      }
    });
})();
