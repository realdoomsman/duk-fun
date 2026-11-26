// comics.html and kit.html: both render whatever assets/media.json lists right now.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const page = document.body.dataset.collection;

  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else if (key in node && !key.includes('-')) node[key] = value;
      else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
  };
  const text = (value, fallback) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);
  // Only files copy-assets.py published under assets/ are rendered; nothing remote, nothing outside the folder.
  const localAsset = (src) => typeof src === 'string' && /^assets\/[^?#]+$/.test(src) && !src.split('/').includes('..');
  const baseName = (src) => src.split('/').pop();
  const extension = (src) => (baseName(src).split('.').pop() || '').toLowerCase();
  const isVideo = (src) => ['mp4', 'webm'].includes(extension(src));
  const slug = (value) => value.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const pad = (n) => String(n).padStart(2, '0');

  function comicsPage() {
    const list = $('comics-list');
    const index = $('comics-index');
    const status = $('comics-status');
    const dialog = $('comics-dialog');
    const dialogImage = $('comics-dialog-image');
    const previous = $('comics-prev');
    const next = $('comics-next');
    const strips = [];
    let current = 0;
    let backdropPress = false;

    const postFor = (strip) => window.dukPostHref(strip.title, strip.src);
    const downloadName = (strip) => `duk-comic-${strip.number}-${baseName(strip.src)}`;
    // copy image (mouse) / share with the strip (touch) in the dialog, from app.js.
    const preparePicture = window.dukPictureButtons($('comics-dialog-share'), $('comics-dialog-copy'), () => {
      const strip = strips[current];
      return strip && { src: strip.src, name: downloadName(strip).replace(/\.[^.]+$/, ''), text: window.dukPostText(strip.title, strip.src) };
    });

    function renderStrip(strip, position) {
      const titleId = `${strip.id}-title`;
      // Every strip is a still image; the dialog shows the same file big.
      const image = el('img', { loading: position === 0 ? 'eager' : 'lazy', decoding: 'async', width: 1600, height: 1600, alt: strip.alt, src: strip.src });
      const open = el('button', { type: 'button', class: 'comic-open', 'aria-haspopup': 'dialog', 'aria-label': `see it bigger: no. ${strip.number}, ${strip.title}` }, [image, el('span', { class: 'comic-open-hint', 'aria-hidden': 'true', text: 'see it bigger' })]);
      open.addEventListener('click', () => openDialog(position));
      strip.opener = open;
      const figure = el('figure', { class: 'comic-figure' }, [open]);
      const transcript = el('details', { class: 'comic-transcript' }, [
        el('summary', { text: 'transcript' }),
        el('p', { text: strip.alt })
      ]);
      const actions = el('div', { class: 'comic-actions' }, [
        el('a', { class: 'button', href: strip.src, download: downloadName(strip), text: 'download', 'aria-label': `download no. ${strip.number}` }),
        el('a', { class: 'button', href: postFor(strip), target: '_blank', rel: 'noopener noreferrer', text: 'post on x' }),
        el('a', { class: 'comic-permalink', href: `#${strip.id}`, text: 'link to this one', 'aria-label': `link to no. ${strip.number}` })
      ]);
      const article = el('article', { class: 'comic-strip', id: strip.id, 'aria-labelledby': titleId, tabIndex: -1 }, [
        el('header', { class: 'comic-head' }, [
          el('span', { class: 'comic-number', text: `no. ${strip.number}` }),
          el('h2', { id: titleId, text: strip.title }),
          el('a', { class: 'comic-top', href: '#comics-index-title', text: 'back to the index' })
        ]),
        figure,
        el('div', { class: 'comic-foot' }, [transcript, actions])
      ]);
      return el('li', {}, [article]);
    }

    function showDialog(position) {
      current = position;
      const strip = strips[position];
      $('comics-dialog-title').textContent = `no. ${strip.number}: ${strip.title}`;
      dialogImage.src = strip.src;
      dialogImage.alt = strip.alt;
      $('comics-dialog-position').textContent = `strip ${position + 1} of ${strips.length}`;
      previous.disabled = position === 0;
      next.disabled = position === strips.length - 1;
      const save = $('comics-dialog-download');
      save.href = strip.src;
      save.download = downloadName(strip);
      $('comics-dialog-post').href = postFor(strip);
      preparePicture(strip.src);
    }

    function openDialog(position) {
      showDialog(position);
      if (!dialog.open) dialog.showModal();
    }

    function step(delta) {
      const target = current + delta;
      if (target < 0 || target >= strips.length) return;
      showDialog(target);
      // Keep keyboard focus on a usable button once prev/next hits an end.
      if (document.activeElement?.disabled) (delta < 0 ? next : previous).focus();
    }

    previous.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    $('comics-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    });
    // Focus returns to the strip the reader ended on, scrolled into place.
    dialog.addEventListener('close', () => {
      const strip = strips[current];
      if (strip?.opener?.isConnected) {
        strip.opener.focus({ preventScroll: true });
        document.getElementById(strip.id).scrollIntoView({ block: 'start' });
      }
    });
    const isBackdrop = (event) => {
      if (event.target !== dialog) return false;
      const box = dialog.getBoundingClientRect();
      return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    };
    dialog.addEventListener('pointerdown', (event) => { backdropPress = event.button === 0 && isBackdrop(event); });
    dialog.addEventListener('pointercancel', () => { backdropPress = false; });
    dialog.addEventListener('click', (event) => {
      if (backdropPress && isBackdrop(event)) dialog.close();
      backdropPress = false;
    });

    window.dukMedia().then((media) => {
      const ids = new Set();
      for (const item of Array.isArray(media.comics) ? media.comics : []) {
        if (!item || !localAsset(item.src) || isVideo(item.src)) continue;
        let id = `strip-${slug(text(item.file, baseName(item.src))) || strips.length + 1}`;
        while (ids.has(id)) id += '-again';
        ids.add(id);
        const title = text(item.title, 'untitled.');
        strips.push({ id, src: item.src, title, alt: text(item.alt, title), number: pad(strips.length + 1), opener: null });
      }
      if (!strips.length) {
        status.textContent = 'no comics yet.';
        $('comics-empty').hidden = false;
        return;
      }
      list.append(...strips.map(renderStrip));
      index.append(...strips.map((strip) => el('li', {}, [
        el('a', { href: `#${strip.id}` }, [el('span', { text: `no. ${strip.number}` }), document.createTextNode(` ${strip.title}`)])
      ])));
      $('comics-index-nav').hidden = false;
      $('comics-reading-note').hidden = false;
      status.textContent = strips.length === 1 ? '1 strip.' : `${strips.length} strips.`;
      // The strips arrive after the browser tried the hash, so honour deep links by hand.
      const target = decodeURIComponent(window.location.hash.slice(1));
      const linked = target && document.getElementById(target);
      if (linked?.classList.contains('comic-strip')) {
        linked.scrollIntoView({ block: 'start' });
        linked.focus({ preventScroll: true });
      }
    }).catch(() => {
      status.textContent = 'the comics didn\'t load.';
      $('comics-error').hidden = false;
    });
  }

  const KIT_GROUPS = {
    replies: {
      title: 'the reply pack.', label: 'reply pack', eyebrow: 'replies', size: [1200, 675],
      howto: 'pictures for replying to bad news. no caption needed.',
      empty: 'no reply pictures yet. replying "duk." works fine for now.'
    },
    templates: {
      title: 'templates.', eyebrow: 'blank', size: [1000, 1000],
      howto: 'put whatever is coming at him in the empty space.',
      empty: 'no templates yet.'
    },
    formats: {
      title: 'the new formats.', label: 'new formats', eyebrow: 'blank', size: [1200, 1200],
      howto: 'this week\u2019s memes with the words taken out. fill in your own.',
      empty: 'no new formats yet.'
    },
    pfp: {
      title: 'pfps.', eyebrow: 'faces', size: [1000, 1000],
      howto: 'shown round, the way x crops them.',
      empty: 'no extra pfps yet. the one in the basics works.'
    },
    wallpapers: {
      title: 'wallpapers.', eyebrow: 'phone / desktop', size: [1080, 1920],
      howto: 'for your phone or desktop. good for when the chart is red.',
      empty: 'no wallpapers yet.'
    },
    banners: {
      title: 'banners.', eyebrow: 'headers', size: [1500, 500],
      howto: '1500 × 500, sized for the x header.',
      empty: 'no extra banners yet. the one in the basics fits x.'
    }
  };

  function kitPage() {
    const groups = $('kit-groups');
    const jump = $('kit-jump');
    const status = $('kit-status');

    function kitCard(group, item) {
      const kind = isVideo(item.src) ? 'video' : 'image';
      const [width, height] = Object.hasOwn(KIT_GROUPS, group) ? KIT_GROUPS[group].size : [1000, 1000];
      const meta = el('p', { class: 'kit-meta', text: extension(item.src) });
      const describe = (w, h) => {
        let line = `${w} × ${h} ${extension(item.src)}`;
        if (group === 'wallpapers') line += w < h ? ' / phone' : ' / desktop';
        meta.textContent = line;
      };
      let thumb;
      if (kind === 'video') {
        const video = el('video', { src: item.src, controls: true, muted: true, loop: true, playsInline: true, preload: 'metadata', width, height, 'aria-label': item.alt });
        video.addEventListener('loadedmetadata', () => describe(video.videoWidth, video.videoHeight), { once: true });
        thumb = el('div', { class: 'kit-thumb' }, [video]);
      } else {
        const sized = Number.isInteger(item.width) && Number.isInteger(item.height);
        const image = el('img', { loading: 'lazy', decoding: 'async', width, height, alt: item.alt, src: item.thumb || item.src });
        const measure = () => {
          const [w, h] = sized ? [item.width, item.height] : [image.naturalWidth, image.naturalHeight];
          describe(w, h);
          image.closest('.kit-card').classList.add(w < h ? 'is-portrait' : 'is-landscape');
        };
        // Known sizes show straight away; the rest wait for the image (the portrait/landscape class can wait either way).
        if (sized) describe(item.width, item.height);
        image.addEventListener('load', measure, { once: true });
        thumb = el('a', { class: 'kit-thumb', href: item.src, target: '_blank', rel: 'noopener', 'aria-label': `open ${item.title} full size` }, [image]);
      }
      const save = el('a', { class: 'button kit-save', href: item.src, download: `duk-${slug(group)}-${baseName(item.src)}`, text: 'download', 'aria-label': `download ${item.title}` });
      const titleId = `kit-${slug(group)}-${slug(baseName(item.src))}`;
      const actions = [save];
      if (group === 'templates' || group === 'formats') {
        actions.push(el('a', { class: 'button kit-save', href: `maker.html?base=${encodeURIComponent(item.src)}#maker`, text: 'fill it in', 'aria-label': `fill in ${item.title} in the maker` }));
      } else if (group === 'replies' && kind === 'image') {
        // a reply picture goes straight into the reply: copied on a computer, the share sheet on a phone.
        const share = el('button', { type: 'button', class: 'button kit-save', text: 'share', hidden: true, 'aria-describedby': titleId });
        const copy = el('button', { type: 'button', class: 'button kit-save', text: 'copy image', hidden: true, 'aria-describedby': titleId });
        const prepare = window.dukPictureButtons(share, copy, () => ({ src: item.src, name: `duk-${slug(baseName(item.src))}`, text: 'duk.' }));
        share.addEventListener('pointerdown', () => prepare(item.src));
        actions.push(share, copy);
      }
      return el('li', { class: 'kit-card' }, [
        thumb,
        el('h3', { id: titleId, text: item.title }),
        meta,
        actions.length > 1 ? el('div', { class: 'kit-actions' }, actions) : save
      ]);
    }

    function replyLines(lines) {
      const lineStatus = el('p', { class: 'kit-copy-status', role: 'status', 'aria-live': 'polite' });
      return el('div', { class: 'kit-reply-lines' }, [
        el('h3', { text: 'the lines.' }),
        el('p', { class: 'kit-reply-lines-note', text: 'no picture handy? paste one of these instead.' }),
        el('ul', { class: 'kit-words-list kit-lines' }, lines.map((line) => {
          const code = el('code', { text: line });
          const button = el('button', { type: 'button', text: 'copy' });
          wireCopy(button, code, lineStatus);
          return el('li', {}, [code, button]);
        })),
        lineStatus,
        el('a', { class: 'button', href: 'assets/replies/lines.md', download: 'duk-reply-lines.md', text: `download all ${lines.length} lines` })
      ]);
    }

    function kitSection(group, items, lines) {
      const known = Object.hasOwn(KIT_GROUPS, group) ? KIT_GROUPS[group] : null;
      const name = known?.label || group.replace(/[-_]+/g, ' ').toLowerCase();
      const id = `kit-${slug(group) || 'extras'}`;
      const titleId = `${id}-title`;
      const count = items.length === 1 ? '1 file' : `${items.length} files`;
      const body = items.length
        ? el('ul', { class: 'kit-grid' }, items.map((item) => kitCard(group, item)))
        : el('p', { class: 'kit-empty', text: known ? known.empty : 'nothing here yet.' });
      jump.append(el('li', {}, [el('a', { href: `#${id}`, text: `${name} (${items.length})` })]));
      return el('section', { class: `kit-section kit-group kit-group-${known ? group : 'other'} page-width`, id, 'aria-labelledby': titleId }, [
        el('div', { class: 'kit-section-head' }, [
          el('div', {}, [
            el('p', { class: 'eyebrow', text: `${known ? known.eyebrow : 'other'} / ${count}` }),
            el('h2', { id: titleId, text: known ? known.title : `${name}.` })
          ]),
          el('p', { class: 'kit-howto', text: known ? known.howto : 'more duk files.' })
        ]),
        body,
        ...(lines.length ? [replyLines(lines)] : [])
      ]);
    }

    window.dukMedia().then((media) => {
      const kit = media.kit && typeof media.kit === 'object' && !Array.isArray(media.kit) ? media.kit : {};
      const lines = (Array.isArray(media.replyLines) ? media.replyLines : [])
        .filter((line) => typeof line === 'string' && line.trim()).map((line) => line.trim());
      const order = [...Object.keys(KIT_GROUPS), ...Object.keys(kit).filter((key) => !Object.hasOwn(KIT_GROUPS, key)).sort()];
      let total = 0;
      const sections = order.map((group) => {
        const items = (Array.isArray(kit[group]) ? kit[group] : [])
          .filter((item) => item && localAsset(item.src))
          .map((item) => {
            const title = text(item.title, baseName(item.src));
            const thumb = localAsset(item.thumb) ? item.thumb : null;
            return { src: item.src, thumb, width: item.width, height: item.height, title, alt: text(item.alt, title) };
          });
        total += items.length;
        return kitSection(group, items, group === 'replies' ? lines : []);
      });
      groups.append(...sections);
      status.textContent = total
        ? `${total} more ${total === 1 ? 'file' : 'files'} below. all free.`
        : 'nothing else here yet. the basics above are ready to download.';
    }).catch(() => {
      status.textContent = 'the rest of the kit didn\'t load. try reloading. the basics above still work.';
    });

    function wireCopy(button, code, copyStatus) {
      button.setAttribute('aria-label', `copy: ${code.textContent}`);
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.textContent);
          copyStatus.textContent = `copied "${code.textContent}".`;
        } catch {
          const range = document.createRange();
          range.selectNodeContents(code);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          copyStatus.textContent = 'selected. hold to copy, or press ctrl/cmd + c.';
        }
      });
    }

    const wordsStatus = $('kit-copy-status');
    document.querySelectorAll('[data-copy]').forEach((button) => wireCopy(button, button.previousElementSibling, wordsStatus));
  }

  if (page === 'comics') comicsPage();
  if (page === 'kit') kitPage();
})();
