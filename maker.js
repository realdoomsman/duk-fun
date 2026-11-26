(() => {
  'use strict';

  const root = document.getElementById('maker-tool');
  if (!root) return;

  const SIZE = 1000;
  const TEXT_WIDTH = 872;
  const TEXT_MAX_HEIGHT = 220;
  const MAX_STICKERS = 12;
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

  // Sticker tray: the sprites are always there; sticker packs join once media.json loads.
  const stickerSets = [{ id: 'sprites', name: 'duk and problems', items: [...poses, ...problems].map(item => ({ label: item.label, src: item.src })) }];

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
                <div class="maker-field"><label for="maker-search">search</label><input id="maker-search" type="search" placeholder="rent, sign, monday…" autocomplete="off" aria-controls="maker-bases"></div>
                <div class="maker-field"><label for="maker-show">show</label><select id="maker-show" aria-controls="maker-bases"><option value="all">everything</option><option value="quick">quick picks</option><option value="template">blank templates</option><option value="sprite">sprites</option><option value="meme">memes</option></select></div>
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
            <p class="maker-help">templates bring their own background.</p>
          </fieldset>
          <section class="maker-step" aria-labelledby="maker-step-words">
            <h3 id="maker-step-words" class="maker-step-title">3. add words.</h3>
            <div class="maker-field"><label for="maker-top">top text</label><textarea id="maker-top" rows="2" maxlength="120" placeholder="rent is due." aria-describedby="maker-caption-help"></textarea></div>
            <div class="maker-field"><label for="maker-bottom">bottom text</label><textarea id="maker-bottom" rows="2" maxlength="120" placeholder="just duk." aria-describedby="maker-caption-help"></textarea></div>
            <div class="maker-field"><label for="maker-ink">text color</label><select id="maker-ink"><option value="auto">auto</option><option value="#111111">black</option><option value="#ffffff">white</option><option value="outline">white with black outline</option><option value="#ed1c24">red</option></select></div>
            <p id="maker-caption-help" class="maker-help">it gets lowercased, like everything duk says. drag the words on the picture to move them.</p>
          </section>
          <section class="maker-step" aria-labelledby="maker-step-stickers">
            <h3 id="maker-step-stickers" class="maker-step-title">4. stickers.</h3>
            <div class="maker-field"><label for="maker-sticker-set">pack</label><select id="maker-sticker-set" aria-controls="maker-stickers"></select></div>
            <div id="maker-stickers" class="maker-stickers" role="group" aria-label="tap a sticker to add it"></div>
            <p class="maker-help">tap one to drop it on the picture, then drag it around. up to ${MAX_STICKERS}.</p>
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
          <div class="maker-stage" tabindex="0" aria-describedby="maker-stage-help">
            <canvas width="${SIZE}" height="${SIZE}" role="img" aria-label="meme preview" aria-describedby="maker-load-status" aria-busy="true">your browser needs canvas support to make a meme.</canvas>
            <div class="maker-selection" hidden><span class="maker-handle" aria-hidden="true"></span></div>
          </div>
          <div class="maker-layer-tools">
            <div class="maker-field"><label for="maker-layer">selected</label><select id="maker-layer"><option value="">nothing</option></select></div>
            <div class="maker-field"><label for="maker-scale">size</label><input id="maker-scale" type="range" min="20" max="300" step="5" value="100" disabled></div>
            <div class="maker-layer-buttons"><button class="maker-small" type="button" data-layer-action="reset" disabled>reset</button><button class="maker-small" type="button" data-layer-action="remove" disabled>remove</button></div>
          </div>
          <figcaption>
            <p id="maker-load-status" role="status" aria-live="polite" aria-atomic="true">loading…</p>
            <button class="maker-retry" type="button" hidden>try again.</button>
            <p id="maker-stage-help" class="maker-help">drag words and stickers to move them, pull the corner to resize. keyboard: arrows move, + and - resize, delete removes.</p>
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
  const inkSelect = $('#maker-ink');
  const stickerSet = $('#maker-sticker-set');
  const stickerTray = $('#maker-stickers');
  const download = $('.maker-download');
  const post = $('.maker-post');
  const exportStatus = $('.maker-export-status');
  const stage = $('.maker-stage');
  const canvas = $('canvas');
  const selectionBox = $('.maker-selection');
  const handle = $('.maker-handle');
  const layerSelect = $('#maker-layer');
  const scaleInput = $('#maker-scale');
  const resetButton = $('[data-layer-action="reset"]');
  const removeButton = $('[data-layer-action="remove"]');
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
    image.src = item.thumb || item.src;
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
    const choice = makeChoice('maker-base', index, base, index === state.base, !base.quick);
    choice.dataset.kind = base.kind;
    choice.dataset.tag = base.tag || '';
    choice.dataset.quick = String(base.quick);
    choice.dataset.search = [base.label, base.number, base.tag, base.group, base.kind, base.alt].filter(Boolean).join(' ').toLowerCase();
    basePicker.append(choice);
  }

  const state = {
    combo: false,
    base: 0,
    pose: 2,
    problem: 1,
    background: colors[0].value,
    ink: 'auto',
    label: bases[0].label,
    loaded: null
  };

  bases.forEach((base, index) => addBaseCard(index));
  poses.forEach((pose, index) => posePicker.append(makeChoice('maker-pose', index, pose, index === state.pose, false)));
  problems.forEach((problem, index) => problemPicker.append(makeChoice('maker-problem', index, problem, index === state.problem, false)));
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

  function renderStickerSets() {
    const current = stickerSet.value || stickerSets[0].id;
    stickerSet.replaceChildren(...stickerSets.map(set => new Option(`${set.name} (${set.items.length})`, set.id)));
    stickerSet.value = current;
    renderStickerTray();
  }

  function renderStickerTray() {
    const set = stickerSets.find(item => item.id === stickerSet.value) || stickerSets[0];
    stickerTray.replaceChildren(...set.items.map(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'maker-sticker';
      button.dataset.src = item.src;
      button.dataset.label = item.label;
      button.setAttribute('aria-label', `add sticker: ${item.label}`);
      const image = document.createElement('img');
      image.alt = '';
      image.width = 56;
      image.height = 56;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.src = item.thumb || item.src;
      button.append(image);
      return button;
    }));
  }

  // Layers sit on top of the art. Words keep an offset from their default spot; stickers keep a center.
  const words = {
    top: { id: 'top', kind: 'text', name: 'top text', field: topCaption, dx: 0, dy: 0, scale: 1, box: null },
    bottom: { id: 'bottom', kind: 'text', name: 'bottom text', field: bottomCaption, dx: 0, dy: 0, scale: 1, box: null }
  };
  const stickers = [];
  let stickerCount = 0;
  let selected = null;

  let loadVersion = 0;
  let saving = false;
  let lastTop = '';
  let lastBottom = '';

  function updatePostLink() {
    const lines = [lastTop, lastBottom].map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
    post.href = `https://x.com/intent/post?text=${encodeURIComponent(lines ? `${lines}\n\n${SHARE_TAIL}` : SHARE_TAIL)}`;
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
    context.font = `bold ${size}px "Comic Sans MS", "Comic Sans", "Chalkboard SE", "Comic Neue", Arial, sans-serif`;
  }

  // Lowercase, at most four typed lines; extra lines are joined rather than dropped.
  function normalizeCaption(text) {
    const lines = text.toLowerCase().replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
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
      const width = Math.max(...lines.map(line => context.measureText(line).width));
      const layout = { lines, size, width, height: Math.ceil(lines.length * size * 1.15) };
      if (layout.height <= TEXT_MAX_HEIGHT) {
        if (!broke) return layout;
        fallback = fallback || layout;
      }
      if (size === 16) return fallback || layout;
    }
    return fallback;
  }

  // Draws a caption centered on (cx, cy) at the layer's scale and records its box for dragging.
  function drawCaption(layer, layout, cx, cy, ink) {
    const scale = layer.scale;
    const width = Math.ceil(layout.width * scale) + 16;
    const height = Math.ceil(layout.height * scale) + 8;
    const x = cx + layer.dx;
    const y = cy + layer.dy;
    layer.box = { x: x - width / 2, y: y - height / 2, w: width, h: height };
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    setFont(layout.size);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    layout.lines.forEach((line, index) => {
      const lineY = (index + 0.5) * layout.size * 1.15 - layout.height / 2;
      if (ink === 'outline') {
        context.lineWidth = Math.max(4, layout.size / 7);
        context.strokeStyle = '#111111';
        context.strokeText(line, 0, lineY);
        context.fillStyle = '#ffffff';
      } else {
        context.fillStyle = ink;
      }
      context.fillText(line, 0, lineY);
    });
    context.restore();
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

  function isTemplate() {
    return !state.combo && bases[state.base].kind === 'template';
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
    const fullBleed = isTemplate();
    if (state.loaded) {
      if (fullBleed) {
        drawContained(state.loaded.images[0], 0, 0, SIZE, SIZE, false);
      } else {
        // Words claim space above and below the art at their default spot; dragging them later doesn't move the art.
        const artTop = topLayout ? 48 + topLayout.height + 28 : 64;
        const artBottom = bottomLayout ? 952 - bottomLayout.height - 28 : 936;
        drawArt(64, artTop, SIZE - 128, artBottom - artTop);
      }
    }

    for (const sticker of stickers) {
      const ratio = sticker.image.naturalHeight / sticker.image.naturalWidth;
      const width = sticker.width * sticker.scale;
      const height = width * ratio;
      sticker.box = { x: sticker.x - width / 2, y: sticker.y - height / 2, w: width, h: height };
      context.drawImage(sticker.image, sticker.box.x, sticker.box.y, width, height);
    }

    const ink = state.ink === 'auto' ? (fullBleed ? 'outline' : textColor(state.background)) : state.ink;
    words.top.box = null;
    words.bottom.box = null;
    if (topLayout) drawCaption(words.top, topLayout, SIZE / 2, 48 + topLayout.height / 2, ink);
    if (bottomLayout) drawCaption(words.bottom, bottomLayout, SIZE / 2, 952 - bottomLayout.height / 2, ink);

    const described = [lastTop && `top text: ${lastTop}.`, lastBottom && `bottom text: ${lastBottom}.`, stickers.length && `${stickers.length} sticker${stickers.length === 1 ? '' : 's'}.`].filter(Boolean).join(' ');
    canvas.setAttribute('aria-label', `meme preview: ${state.label}. ${described || 'no words.'}`);
    updatePostLink();
    syncSelection();
  }

  /* ---------- layers: select, drag, resize ---------- */
  function layers() {
    return [words.top, words.bottom, ...stickers].filter(layer => layer.box);
  }

  function syncLayerList() {
    const all = layers();
    const options = [new Option('nothing', '')];
    for (const layer of all) options.push(new Option(layer.name, layer.id));
    layerSelect.replaceChildren(...options);
    layerSelect.value = selected ? selected.id : '';
    // Touches on the picture only stop page scrolling once there is something to drag.
    stage.classList.toggle('has-layers', all.length > 0);
  }

  function syncSelection() {
    if (selected && !selected.box) selected = null;
    const box = selected && selected.box;
    selectionBox.hidden = !box;
    if (box) {
      Object.assign(selectionBox.style, {
        left: `${(box.x / SIZE) * 100}%`,
        top: `${(box.y / SIZE) * 100}%`,
        width: `${(box.w / SIZE) * 100}%`,
        height: `${(box.h / SIZE) * 100}%`
      });
    }
    scaleInput.disabled = !box;
    resetButton.disabled = !box;
    removeButton.disabled = !box;
    removeButton.textContent = selected && selected.kind === 'text' ? 'clear' : 'remove';
    if (box) scaleInput.value = String(Math.round(selected.scale * 100));
    syncLayerList();
  }

  function select(layer) {
    selected = layer;
    syncSelection();
  }

  function clampScale(value) {
    return Math.min(3, Math.max(0.2, value));
  }

  function moveLayer(layer, dx, dy) {
    if (layer.kind === 'text') {
      layer.dx = Math.round(layer.dx + dx);
      layer.dy = Math.round(layer.dy + dy);
    } else {
      layer.x = Math.round(Math.min(SIZE, Math.max(0, layer.x + dx)));
      layer.y = Math.round(Math.min(SIZE, Math.max(0, layer.y + dy)));
    }
  }

  function removeLayer(layer) {
    if (layer.kind === 'text') {
      layer.field.value = '';
      Object.assign(layer, { dx: 0, dy: 0, scale: 1 });
    } else {
      stickers.splice(stickers.indexOf(layer), 1);
    }
    selected = null;
    exportStatus.textContent = '';
    render();
  }

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * SIZE, y: ((event.clientY - rect.top) / rect.height) * SIZE };
  }

  function hit(point) {
    const order = [...stickers].reverse().concat([words.bottom, words.top]);
    return order.find(layer => layer.box && point.x >= layer.box.x && point.x <= layer.box.x + layer.box.w
      && point.y >= layer.box.y && point.y <= layer.box.y + layer.box.h) || null;
  }

  let gesture = null;
  canvas.addEventListener('pointerdown', event => {
    const point = toCanvas(event);
    const layer = hit(point);
    select(layer);
    if (!layer) return;
    event.preventDefault();
    if (layer.kind === 'sticker') {
      // Grabbed stickers come to the front.
      stickers.splice(stickers.indexOf(layer), 1);
      stickers.push(layer);
    }
    gesture = { mode: 'move', pointer: event.pointerId, last: point };
    canvas.setPointerCapture(event.pointerId);
    stage.classList.add('is-dragging');
  });
  handle.addEventListener('pointerdown', event => {
    if (!selected || !selected.box) return;
    event.preventDefault();
    event.stopPropagation();
    const box = selected.box;
    const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const point = toCanvas(event);
    gesture = { mode: 'resize', pointer: event.pointerId, center, start: Math.max(8, Math.hypot(point.x - center.x, point.y - center.y)), scale: selected.scale };
    handle.setPointerCapture(event.pointerId);
    stage.classList.add('is-dragging');
  });
  function onPointerMove(event) {
    if (!gesture || event.pointerId !== gesture.pointer || !selected) return;
    const point = toCanvas(event);
    if (gesture.mode === 'move') {
      moveLayer(selected, point.x - gesture.last.x, point.y - gesture.last.y);
      gesture.last = point;
    } else {
      selected.scale = clampScale(gesture.scale * Math.hypot(point.x - gesture.center.x, point.y - gesture.center.y) / gesture.start);
    }
    exportStatus.textContent = '';
    render();
  }
  function endGesture(event) {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    gesture = null;
    stage.classList.remove('is-dragging');
  }
  for (const target of [canvas, handle]) {
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', endGesture);
    target.addEventListener('pointercancel', endGesture);
  }

  stage.addEventListener('keydown', event => {
    const all = layers();
    if (event.key === 'Tab' || !all.length) return;
    if (!selected && /^Arrow|^[+=-]$/.test(event.key)) select(all[0]);
    if (!selected) return;
    const step = event.shiftKey ? 50 : 10;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      moveLayer(selected, ...moves[event.key]);
    } else if (event.key === '+' || event.key === '=') {
      selected.scale = clampScale(selected.scale + 0.1);
    } else if (event.key === '-') {
      selected.scale = clampScale(selected.scale - 0.1);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      removeLayer(selected);
      event.preventDefault();
      return;
    } else if (event.key === 'Escape') {
      select(null);
      return;
    } else {
      return;
    }
    event.preventDefault();
    exportStatus.textContent = '';
    render();
  });

  layerSelect.addEventListener('change', () => {
    select(layers().find(layer => layer.id === layerSelect.value) || null);
  });
  scaleInput.addEventListener('input', () => {
    if (!selected) return;
    selected.scale = clampScale(Number(scaleInput.value) / 100);
    exportStatus.textContent = '';
    render();
  });
  resetButton.addEventListener('click', () => {
    if (!selected) return;
    if (selected.kind === 'text') Object.assign(selected, { dx: 0, dy: 0, scale: 1 });
    else Object.assign(selected, { x: SIZE / 2, y: SIZE / 2, scale: 1 });
    render();
  });
  removeButton.addEventListener('click', () => {
    if (selected) removeLayer(selected);
  });

  stickerSet.addEventListener('change', renderStickerTray);
  stickerTray.addEventListener('click', event => {
    const button = event.target.closest('.maker-sticker');
    if (!button) return;
    if (stickers.length >= MAX_STICKERS) {
      exportStatus.textContent = `that's ${MAX_STICKERS} stickers. remove one first.`;
      return;
    }
    const label = button.dataset.label;
    loadImage(button.dataset.src).then(image => {
      stickerCount += 1;
      // Spread new stickers out a little so they don't stack exactly.
      const nudge = ((stickers.length % 5) - 2) * 40;
      const sticker = { id: `sticker-${stickerCount}`, kind: 'sticker', name: `sticker: ${label}`, image, x: SIZE / 2 + nudge, y: SIZE / 2 + nudge, width: 300, scale: 1, box: null };
      stickers.push(sticker);
      selected = sticker;
      exportStatus.textContent = `added ${label}. drag it where you want it.`;
      // On phones the tray sits below the picture; bring the picture back so the sticker is visible.
      if (canvas.getBoundingClientRect().bottom < 80) stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      render();
    }, () => {
      exportStatus.textContent = `could not load ${label}. try another one.`;
    });
  });

  /* ---------- base art ---------- */
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
    palette.closest('fieldset').classList.toggle('is-muted', isTemplate());
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
  inkSelect.addEventListener('change', () => {
    state.ink = inkSelect.value;
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
      // The selection box is a separate element, so it never ends up in the png.
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

  renderStickerSets();
  applyFilter();
  loadSelection();

  window.dukMedia()
    .then(data => {
      const memes = Array.isArray(data && data.memes) ? data.memes : [];
      const templates = Array.isArray(data && data.kit && data.kit.templates) ? data.kit.templates : [];
      const tags = new Set();
      const addBase = (item, kind) => {
        if (!item || typeof item.src !== 'string' || bases.some(base => base.src === item.src)) return;
        const number = (/^(?:.*\/)?(\d+)/.exec(String(item.file || '')) || [])[1] || '';
        const tag = kind === 'meme' && typeof item.tag === 'string' ? item.tag.toLowerCase() : null;
        bases.push({
          label: String(item.title || item.file || 'untitled').toLowerCase(),
          src: item.src,
          kind,
          group: kind,
          tag,
          number,
          alt: typeof item.alt === 'string' ? item.alt : '',
          thumb: typeof item.thumb === 'string' ? item.thumb : null,
          quick: kind === 'template' && number === '01'
        });
        addBaseCard(bases.length - 1);
        if (tag) tags.add(tag);
      };
      templates.forEach(item => addBase(item, 'template'));
      memes.forEach(item => addBase(item, 'meme'));
      for (const tag of [...tags].sort()) showSelect.append(new Option(`memes: ${tag}`, `tag:${tag}`));
      libraryNote = memes.length ? '' : 'no memes yet. the sprites still work.';
      applyFilter();
      pickRequestedBase();

      const packs = Array.isArray(data && data.stickerPacks) ? data.stickerPacks : [];
      for (const pack of packs) {
        const items = (pack.items || [])
          .filter(item => item && typeof item.src === 'string' && /\.(png|webp)$/i.test(item.src))
          .map(item => ({ label: String(item.alt || '').replace(/\.$/, '') || 'sticker', src: item.src, thumb: typeof item.thumb === 'string' ? item.thumb : null }));
        if (items.length) stickerSets.push({ id: String(pack.id), name: String(pack.name || pack.id), items });
      }
      renderStickerSets();
    })
    .catch(() => {
      libraryNote = 'memes didn\'t load. the sprites still work.';
      applyFilter();
    });

  // maker.html?base=assets/memes/x.png (the archive's "remix it" link) opens with that base picked.
  function pickRequestedBase() {
    const requested = new URLSearchParams(window.location.search).get('base');
    const index = requested ? bases.findIndex(base => base.src === requested) : -1;
    if (index < 0 || (index === state.base && !state.combo)) return;
    const input = basePicker.querySelector(`input[value="${index}"]`);
    if (!input) return;
    input.checked = true;
    state.base = index;
    const card = input.closest('.maker-choice');
    basePicker.scrollTop = card.offsetTop - basePicker.offsetTop - 8;
    loadSelection();
  }
})();
