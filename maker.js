(() => {
  'use strict';

  const root = document.getElementById('maker-tool');
  if (!root) return;

  const SIZE = 1000;
  const TEXT_WIDTH = 872;
  const TEXT_MAX_HEIGHT = 220;
  const SHARE_TAIL = 'just duk. $DUK https://duk.fun/maker.html';

  const sprite = (label, file, group) => ({ label, src: `assets/${file}`, kind: 'sprite', group, tag: null, number: '', alt: '' });
  const quickMeme = (label, file, number, tag) => ({ label, src: `assets/memes/${file}`, kind: 'meme', group: 'meme', tag, number, alt: '' });

  const poses = [
    sprite('standing', 'stand.png', 'duk'),
    sprite('floating', 'float.png', 'duk'),
    sprite('the position', 'ducking.png', 'duk'),
    sprite('got hit', 'hit.png', 'duk')
  ];
  const problems = [
    sprite('rent due', 'obj_rent.png', 'problem'),
    sprite('red candles', 'obj_candles.png', 'problem'),
    sprite('the ex', 'obj_ex.png', 'problem'),
    sprite('liquidation', 'obj_liq.png', 'problem'),
    sprite('monday alarm', 'obj_alarm.png', 'problem'),
    sprite('kol post', 'obj_kol.png', 'problem'),
    sprite('the rug', 'obj_rug.png', 'problem')
  ];
  const bases = [
    poses[0], poses[2], problems[0], problems[1], problems[2],
    quickMeme('just duk', 'duk.png', '', null),
    quickMeme('the face', 'pfp.png', '', null),
    quickMeme('still staring', '14_duk_stare.png', '14', 'reaction')
  ].map(base => ({ ...base, quick: true }));
  for (const item of [...poses, ...problems]) {
    if (!bases.some(base => base.src === item.src)) bases.push({ ...item, quick: false });
  }

  const colors = [
    { label: 'blue', value: '#00a2e8' },
    { label: 'white', value: '#ffffff' },
    { label: 'cream', value: '#fff9e7' },
    { label: 'orange', value: '#ff7f27' },
    { label: 'green', value: '#22b14c' },
    { label: 'red', value: '#ed1c24' },
    { label: 'yellow', value: '#fff200' },
    { label: 'black', value: '#111111' }
  ];

  root.innerHTML = `
    <div class="maker-window">
      <div class="maker-titlebar"><strong>duk paint</strong><span>untitled.png</span></div>
      <div class="maker-workspace">
        <div class="maker-controls">
          <section class="maker-step" aria-labelledby="maker-step-base">
            <h3 id="maker-step-base" class="maker-step-title">1. pick a base.</h3>
            <label class="maker-toggle"><input id="maker-combo-toggle" type="checkbox"><span>build your own: pick a pose and a problem.</span></label>
            <div class="maker-library">
              <div class="maker-filters">
                <div class="maker-field"><label for="maker-search">search</label><input id="maker-search" type="search" placeholder="rent, pool, monday…" autocomplete="off" aria-controls="maker-bases"></div>
                <div class="maker-field"><label for="maker-show">show</label><select id="maker-show" aria-controls="maker-bases"><option value="all">everything</option><option value="quick">quick picks</option><option value="sprite">sprites</option><option value="meme">memes</option></select></div>
              </div>
              <p class="maker-library-status" role="status" aria-live="polite" aria-atomic="true"></p>
              <fieldset class="maker-fieldset">
                <legend>pick one.</legend>
                <div id="maker-bases" class="maker-bases"></div>
                <p class="maker-empty" hidden>no matches.</p>
              </fieldset>
            </div>
            <div class="maker-combo" hidden>
              <fieldset class="maker-fieldset"><legend>pose.</legend><div class="maker-card-grid maker-poses"></div></fieldset>
              <fieldset class="maker-fieldset"><legend>problem over his head.</legend><div class="maker-card-grid maker-problems"></div></fieldset>
            </div>
          </section>
          <fieldset class="maker-fieldset maker-step">
            <legend class="maker-step-title">2. pick a background.</legend>
            <div class="maker-palette"></div>
          </fieldset>
          <section class="maker-step" aria-labelledby="maker-step-words">
            <h3 id="maker-step-words" class="maker-step-title">3. add words.</h3>
            <div class="maker-field"><label for="maker-top">top text</label><textarea id="maker-top" rows="2" maxlength="120" placeholder="rent is due." aria-describedby="maker-caption-help"></textarea></div>
            <div class="maker-field"><label for="maker-bottom">bottom text</label><textarea id="maker-bottom" rows="2" maxlength="120" placeholder="just duk." aria-describedby="maker-caption-help"></textarea></div>
            <p id="maker-caption-help" class="maker-help">up to 120 characters each. leave both empty for no words.</p>
          </section>
          <div class="maker-actions">
            <button class="maker-download" type="button" disabled>download png.</button>
            <a class="maker-post" href="https://x.com/intent/post" target="_blank" rel="noopener noreferrer" aria-describedby="maker-post-note">post on x<span class="sr-only"> (opens in a new tab)</span></a>
          </div>
          <p id="maker-post-note" class="maker-help">x can't attach the image from here. download the png first, then add it to your post.</p>
          <p class="maker-export-status" role="status" aria-live="polite" aria-atomic="true"></p>
        </div>
        <figure class="maker-preview">
          <div class="maker-preview-bar"><span>preview</span><span>1000 × 1000</span></div>
          <canvas width="${SIZE}" height="${SIZE}" role="img" aria-label="meme preview" aria-describedby="maker-load-status" aria-busy="true">your browser needs canvas support to make a meme.</canvas>
          <figcaption>
            <p id="maker-load-status" role="status" aria-live="polite" aria-atomic="true">loading…</p>
            <button class="maker-retry" type="button" hidden>try again.</button>
            <p class="maker-help">it all happens in your browser. nothing gets uploaded.</p>
          </figcaption>
        </figure>
      </div>
      <p class="maker-footnote">no watermark. just duk.</p>
    </div>`;

  const $ = selector => root.querySelector(selector);
  const comboToggle = $('#maker-combo-toggle');
  const library = $('.maker-library');
  const combo = $('.maker-combo');
  const search = $('#maker-search');
  const showSelect = $('#maker-show');
  const libraryStatus = $('.maker-library-status');
  const basePicker = $('.maker-bases');
  const empty = $('.maker-empty');
  const posePicker = $('.maker-poses');
  const problemPicker = $('.maker-problems');
  const palette = $('.maker-palette');
  const topCaption = $('#maker-top');
  const bottomCaption = $('#maker-bottom');
  const download = $('.maker-download');
  const post = $('.maker-post');
  const exportStatus = $('.maker-export-status');
  const canvas = $('canvas');
  const loadStatus = $('#maker-load-status');
  const retry = $('.maker-retry');

  function makeChoice(name, value, item, checked, lazy) {
    const label = document.createElement('label');
    label.className = 'maker-choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = String(value);
    input.checked = checked;
    const card = document.createElement('span');
    card.className = 'maker-base-card';
    const image = document.createElement('img');
    image.alt = '';
    image.width = 80;
    image.height = 64;
    image.decoding = 'async';
    if (lazy) image.loading = 'lazy';
    image.src = item.src;
    const title = document.createElement('span');
    title.className = 'maker-card-title';
    title.textContent = item.label;
    card.append(image, title);
    if (item.number) {
      const number = document.createElement('span');
      number.className = 'maker-card-number';
      number.textContent = ` no. ${item.number}`;
      card.append(number);
    }
    label.append(input, card);
    return label;
  }

  function addBaseCard(index) {
    const base = bases[index];
    const choice = makeChoice('maker-base', index, base, index === 0, !base.quick);
    choice.dataset.kind = base.kind;
    choice.dataset.tag = base.tag || '';
    choice.dataset.quick = String(base.quick);
    choice.dataset.search = [base.label, base.number, base.tag, base.group, base.kind, base.alt].filter(Boolean).join(' ').toLowerCase();
    basePicker.append(choice);
  }

  bases.forEach((base, index) => addBaseCard(index));
  poses.forEach((pose, index) => posePicker.append(makeChoice('maker-pose', index, pose, index === 2, false)));
  problems.forEach((problem, index) => problemPicker.append(makeChoice('maker-problem', index, problem, index === 1, false)));
  colors.forEach((color, index) => {
    const label = document.createElement('label');
    label.className = 'maker-choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'maker-color';
    input.value = color.value;
    input.checked = index === 0;
    const chip = document.createElement('span');
    chip.className = 'maker-color-chip';
    chip.style.setProperty('--maker-color', color.value);
    chip.textContent = color.label;
    label.append(input, chip);
    palette.append(label);
  });

  let libraryNote = 'loading memes…';
  function applyFilter() {
    const query = search.value.trim().toLowerCase();
    const show = showSelect.value;
    let visible = 0;
    basePicker.querySelectorAll('.maker-choice').forEach(choice => {
      const data = choice.dataset;
      const inGroup = show === 'all' || (show === 'quick' && data.quick === 'true') || show === data.kind || show === `tag:${data.tag}`;
      const match = inGroup && (!query || data.search.includes(query));
      choice.hidden = !match;
      if (match) visible += 1;
    });
    empty.hidden = visible > 0;
    libraryStatus.textContent = `showing ${visible} of ${bases.length}.${libraryNote ? ` ${libraryNote}` : ''}`;
  }

  const state = {
    combo: false,
    base: 0,
    pose: 2,
    problem: 1,
    background: colors[0].value,
    label: bases[0].label,
    loaded: null
  };
  let loadVersion = 0;
  let saving = false;
  let lastTop = '';
  let lastBottom = '';

  function updatePostLink() {
    const words = [lastTop, lastBottom].map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
    post.href = `https://x.com/intent/post?text=${encodeURIComponent(words ? `${words}\n\n${SHARE_TAIL}` : SHARE_TAIL)}`;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    loadStatus.textContent = 'canvas is unavailable in this browser. try another browser to make your meme.';
    canvas.setAttribute('aria-busy', 'false');
    root.querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = true; });
    updatePostLink();
    applyFilter();
    return;
  }

  function updateDownload() {
    download.disabled = !state.loaded || saving;
    download.textContent = saving ? 'saving…' : 'download png.';
  }

  function luminance(hex) {
    const channels = [1, 3, 5].map(offset => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function textColor(background) {
    const light = luminance(background);
    const onWhite = 1.05 / (light + 0.05);
    const onBlack = (light + 0.05) / (luminance('#111111') + 0.05);
    return onWhite > onBlack ? '#ffffff' : '#111111';
  }

  function setFont(size) {
    context.font = `bold ${size}px "Comic Sans MS", "Comic Sans", Arial, sans-serif`;
  }

  // At most four typed lines; extra lines are joined rather than dropped.
  function normalizeCaption(text) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (lines.length > 4) lines.splice(3, lines.length, lines.slice(3).join(' '));
    return lines.join('\n');
  }

  function wrapText(text, width) {
    const lines = [];
    let broke = false;
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (context.measureText(candidate).width <= width) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = '';
        if (context.measureText(word).width <= width) {
          line = word;
          continue;
        }
        broke = true;
        for (const character of word) {
          if (line && context.measureText(line + character).width > width) {
            lines.push(line);
            line = '';
          }
          line += character;
        }
      }
      lines.push(line);
    }
    return { lines, broke };
  }

  // Prefer the biggest size that fits without splitting a word; otherwise the biggest that fits.
  function layoutCaption(text) {
    if (!text) return null;
    let fallback = null;
    for (let size = 76; size >= 16; size -= 2) {
      setFont(size);
      const { lines, broke } = wrapText(text, TEXT_WIDTH);
      const layout = { lines, size, height: Math.ceil(lines.length * size * 1.15) };
      if (layout.height <= TEXT_MAX_HEIGHT) {
        if (!broke) return layout;
        fallback = fallback || layout;
      }
      if (size === 16) return fallback || layout;
    }
    return fallback;
  }

  function drawCaption(layout, top) {
    setFont(layout.size);
    layout.lines.forEach((line, index) => {
      context.fillText(line, SIZE / 2, top + (index + 0.5) * layout.size * 1.15);
    });
  }

  function drawContained(image, x, y, width, height, alignBottom) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = Math.round(image.naturalWidth * scale);
    const drawHeight = Math.round(image.naturalHeight * scale);
    const left = Math.round(x + (width - drawWidth) / 2);
    const top = Math.round(alignBottom ? y + height - drawHeight : y + (height - drawHeight) / 2);
    context.drawImage(image, left, top, drawWidth, drawHeight);
  }

  function drawArt(x, y, width, height) {
    const { combo: isCombo, images } = state.loaded;
    if (!isCombo) {
      drawContained(images[0], x, y, width, height, false);
      return;
    }
    const [pose, problem] = images;
    const gap = Math.round(height * 0.06);
    const problemHeight = Math.round(height * 0.34);
    drawContained(pose, x, y + problemHeight + gap, width, height - problemHeight - gap, true);
    const boxWidth = width * 0.56;
    context.save();
    context.translate(Math.round(x + width / 2), Math.round(y + problemHeight / 2));
    context.rotate(-0.12);
    drawContained(problem, -boxWidth / 2, -problemHeight / 2, boxWidth, problemHeight, false);
    context.restore();
  }

  function render() {
    lastTop = normalizeCaption(topCaption.value);
    lastBottom = normalizeCaption(bottomCaption.value);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = state.background;
    context.fillRect(0, 0, SIZE, SIZE);

    const topLayout = layoutCaption(lastTop);
    const bottomLayout = layoutCaption(lastBottom);
    context.fillStyle = textColor(state.background);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    if (topLayout) drawCaption(topLayout, 48);
    if (bottomLayout) drawCaption(bottomLayout, 952 - bottomLayout.height);

    if (state.loaded) {
      const artTop = topLayout ? 48 + topLayout.height + 28 : 64;
      const artBottom = bottomLayout ? 952 - bottomLayout.height - 28 : 936;
      drawArt(64, artTop, SIZE - 128, artBottom - artTop);
    }

    const words = [lastTop && `top text: ${lastTop}.`, lastBottom && `bottom text: ${lastBottom}.`].filter(Boolean).join(' ');
    canvas.setAttribute('aria-label', `meme preview: ${state.label}. ${words || 'no words.'}`);
    updatePostLink();
  }

  const imageCache = new Map();
  function loadImage(src) {
    if (!imageCache.has(src)) {
      imageCache.set(src, new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = () => {
          imageCache.delete(src);
          reject(new Error(`could not load ${src}`));
        };
        image.src = src;
      }));
    }
    return imageCache.get(src);
  }

  function currentSelection() {
    if (!state.combo) return { label: bases[state.base].label, sources: [bases[state.base].src] };
    const pose = poses[state.pose];
    const problem = problems[state.problem];
    return { label: `${pose.label} + ${problem.label}`, sources: [pose.src, problem.src] };
  }

  // Every selection gets a version; stale loads resolve quietly and never paint.
  function loadSelection() {
    const version = ++loadVersion;
    const selection = currentSelection();
    const isCombo = state.combo;
    state.label = selection.label;
    state.loaded = null;
    retry.hidden = true;
    exportStatus.textContent = '';
    loadStatus.textContent = `loading ${selection.label}…`;
    canvas.setAttribute('aria-busy', 'true');
    updateDownload();
    render();

    Promise.all(selection.sources.map(loadImage)).then(images => {
      if (version !== loadVersion) return;
      state.loaded = { combo: isCombo, images };
      canvas.setAttribute('aria-busy', 'false');
      loadStatus.textContent = `${selection.label} loaded.`;
      render();
      updateDownload();
    }, () => {
      if (version !== loadVersion) return;
      canvas.setAttribute('aria-busy', 'false');
      loadStatus.textContent = `could not load ${selection.label}. try again or pick another one.`;
      retry.hidden = false;
      updateDownload();
    });
  }

  comboToggle.addEventListener('change', () => {
    state.combo = comboToggle.checked;
    library.hidden = state.combo;
    combo.hidden = !state.combo;
    loadSelection();
  });
  search.addEventListener('input', applyFilter);
  showSelect.addEventListener('change', applyFilter);
  basePicker.addEventListener('change', event => {
    if (!event.target.matches('input[name="maker-base"]')) return;
    state.base = Number(event.target.value);
    loadSelection();
  });
  posePicker.addEventListener('change', event => {
    if (!event.target.matches('input[name="maker-pose"]')) return;
    state.pose = Number(event.target.value);
    loadSelection();
  });
  problemPicker.addEventListener('change', event => {
    if (!event.target.matches('input[name="maker-problem"]')) return;
    state.problem = Number(event.target.value);
    loadSelection();
  });
  palette.addEventListener('change', event => {
    if (!event.target.matches('input[name="maker-color"]')) return;
    state.background = event.target.value;
    exportStatus.textContent = '';
    render();
  });
  for (const field of [topCaption, bottomCaption]) {
    field.addEventListener('input', () => {
      exportStatus.textContent = '';
      render();
    });
  }
  retry.addEventListener('click', loadSelection);

  function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'masterpiece';
  }

  download.addEventListener('click', () => {
    if (!state.loaded || saving) return;
    saving = true;
    updateDownload();
    exportStatus.textContent = 'making your png…';
    const filename = `duk-${slug(state.label)}.png`;
    const failed = () => {
      exportStatus.textContent = 'could not save the png. try downloading again.';
      saving = false;
      updateDownload();
    };
    try {
      // toBlob snapshots the canvas now, even if the controls change while it encodes.
      canvas.toBlob(blob => {
        if (!blob) {
          failed();
          return;
        }
        let url;
        try {
          url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          root.append(link);
          try {
            link.click();
          } finally {
            link.remove();
          }
          exportStatus.textContent = `download started: ${filename}. attach it to your post.`;
        } catch {
          failed();
          return;
        } finally {
          if (url) window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
        saving = false;
        updateDownload();
      }, 'image/png');
    } catch {
      failed();
    }
  });

  applyFilter();
  loadSelection();

  fetch('assets/media.json')
    .then(response => {
      if (!response.ok) throw new Error(`media.json ${response.status}`);
      return response.json();
    })
    .then(data => {
      const memes = Array.isArray(data && data.memes) ? data.memes : [];
      const tags = new Set();
      for (const item of memes) {
        if (!item || typeof item.src !== 'string' || bases.some(base => base.src === item.src)) continue;
        const number = (/^(\d+)/.exec(String(item.file || '')) || [])[1] || '';
        const tag = typeof item.tag === 'string' ? item.tag.toLowerCase() : null;
        bases.push({
          label: String(item.title || item.file || 'untitled').toLowerCase(),
          src: item.src,
          kind: 'meme',
          group: 'meme',
          tag,
          number,
          alt: typeof item.alt === 'string' ? item.alt : '',
          quick: false
        });
        addBaseCard(bases.length - 1);
        if (tag) tags.add(tag);
      }
      for (const tag of [...tags].sort()) showSelect.append(new Option(`memes: ${tag}`, `tag:${tag}`));
      libraryNote = memes.length ? '' : 'no memes yet. the sprites still work.';
      applyFilter();
    })
    .catch(() => {
      libraryNote = 'memes didn\'t load. the sprites still work.';
      applyFilter();
    });
})();
