(() => {
  'use strict';

  const root = document.getElementById('card-tool');
  if (!root) return;

  const WIDTH = 1200;
  const HEIGHT = 750;
  const FONT = '"Comic Sans MS", "Comic Sans", Arial, sans-serif';
  const BLUE = '#00a2e8';
  const INK = '#111111';
  const CREAM = '#fff9e7';
  const ORANGE = '#ff7f27';
  const RANKS = ['hatchling', 'duckling', 'duk', 'elder duk'];
  const DEFAULT_RANK = 'duk';
  const DEFAULT_NAME = 'anon duk';
  const PFP_SRC = 'assets/memes/pfp.png';
  const CORNER_SRC = 'assets/ducking.png';
  const CULT_URL = 'https://duk.fun/cult.html';

  const two = value => String(value).padStart(2, '0');
  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  };

  root.innerHTML = `
    <div class="card-window">
      <div class="card-titlebar"><strong>membership card</strong><span>make as many as you want.</span></div>
      <div class="card-workspace">
        <form class="card-controls" novalidate>
          <div class="card-field">
            <label for="card-name">your name</label>
            <input id="card-name" type="text" maxlength="24" autocomplete="nickname" spellcheck="false" placeholder="${DEFAULT_NAME}" aria-describedby="card-name-help">
            <p id="card-name-help" class="card-help">up to 24 characters. it comes out lowercase.</p>
          </div>
          <div class="card-field">
            <label for="card-number">member number</label>
            <div class="card-number">
              <span aria-hidden="true">#</span>
              <input id="card-number" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="0000" aria-describedby="card-number-help">
            </div>
            <p id="card-number-help" class="card-help">pick any number. nobody checks.</p>
          </div>
          <div class="card-field">
            <label for="card-rank">rank</label>
            <select id="card-rank">${RANKS.map(rank => `<option value="${rank}"${rank === DEFAULT_RANK ? ' selected' : ''}>${rank}</option>`).join('')}</select>
          </div>
          <div class="card-field">
            <label for="card-date">date joined</label>
            <input id="card-date" type="date" required aria-describedby="card-date-help">
            <p id="card-date-help" class="card-help">defaults to today.</p>
          </div>
          <div class="card-actions">
            <button class="button card-download" type="button" disabled>download card</button>
            <a class="button card-post" href="https://x.com/intent/post" target="_blank" rel="noopener noreferrer">post on x</a>
          </div>
          <p class="card-help card-attach">download the card first. then attach it to your post. x won't do that part.</p>
          <p class="card-export-status" role="status" aria-live="polite" aria-atomic="true"></p>
        </form>
        <figure class="card-preview">
          <div class="card-preview-bar"><span>your card</span><span>1200 × 750</span></div>
          <canvas width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="membership card preview" aria-describedby="card-load-status" aria-busy="true">your browser needs canvas support to make a card.</canvas>
          <figcaption>
            <p id="card-load-status" role="status" aria-live="polite" aria-atomic="true">loading the duk.</p>
            <button class="button card-retry" type="button" hidden>try again</button>
          </figcaption>
        </figure>
      </div>
      <p class="card-footnote">the card is made in your browser. nothing gets uploaded.</p>
    </div>`;

  const form = root.querySelector('.card-controls');
  const nameInput = root.querySelector('#card-name');
  const numberInput = root.querySelector('#card-number');
  const rankSelect = root.querySelector('#card-rank');
  const dateInput = root.querySelector('#card-date');
  const download = root.querySelector('.card-download');
  const post = root.querySelector('.card-post');
  const exportStatus = root.querySelector('.card-export-status');
  const loadStatus = root.querySelector('#card-load-status');
  const retry = root.querySelector('.card-retry');
  const canvas = root.querySelector('canvas');
  const context = canvas.getContext('2d');

  dateInput.value = today();

  let pfp = null;
  let pfpState = 'loading';
  let corner = null;
  let loadToken = 0;
  let saving = false;
  let frame = 0;

  const readCard = () => {
    const name = nameInput.value.replace(/\s+/g, ' ').trim().toLowerCase() || DEFAULT_NAME;
    const digits = numberInput.value.replace(/\D/g, '');
    const number = digits ? String(Number(digits)).padStart(4, '0') : '0000';
    const rank = RANKS.includes(rankSelect.value) ? rankSelect.value : DEFAULT_RANK;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateInput.value) ? dateInput.value : today();
    return { name, number, rank, date };
  };

  // Deterministic jitter: the same shape always wobbles the same way.
  const random = seed => {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const wobble = (corners, seed, amount, closed) => {
    const next = random(seed);
    const jitter = () => (next() - 0.5) * 2 * amount;
    const points = [];
    const segments = closed ? corners.length : corners.length - 1;
    for (let i = 0; i < segments; i += 1) {
      const [x1, y1] = corners[i];
      const [x2, y2] = corners[(i + 1) % corners.length];
      const length = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(2, Math.round(length / 46));
      const nx = -(y2 - y1) / length;
      const ny = (x2 - x1) / length;
      for (let step = 0; step < steps; step += 1) {
        const t = step / steps;
        const offset = jitter() * (step === 0 ? 0.5 : 1);
        points.push([x1 + (x2 - x1) * t + nx * offset, y1 + (y2 - y1) * t + ny * offset]);
      }
    }
    if (!closed) {
      const [x, y] = corners[corners.length - 1];
      points.push([x + jitter() * 0.5, y + jitter() * 0.5]);
    }
    return points;
  };

  const trace = (points, closed) => {
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i][0], points[i][1]);
    if (closed) context.closePath();
  };

  const penStroke = (corners, seed, width, closed) => {
    context.strokeStyle = INK;
    context.lineWidth = width;
    trace(wobble(corners, seed, width * 0.45, closed), closed);
    context.stroke();
    // A thinner second pass, slightly off, like the pen went around twice.
    context.lineWidth = Math.max(2, width * 0.4);
    trace(wobble(corners, seed + 101, width * 0.6, closed), closed);
    context.stroke();
  };

  const font = (size, style = '') => `${style} bold ${size}px ${FONT}`.trim();

  const splitWord = (word, maxWidth) => {
    const pieces = [];
    let piece = '';
    for (const char of word) {
      if (piece && context.measureText(piece + char).width > maxWidth) {
        pieces.push(piece);
        piece = char;
      } else {
        piece += char;
      }
    }
    if (piece) pieces.push(piece);
    return pieces;
  };

  const wrap = (text, maxWidth) => {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const parts = context.measureText(word).width > maxWidth ? splitWord(word, maxWidth) : [word];
      for (const part of parts) {
        const candidate = line ? `${line} ${part}` : part;
        if (line && context.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = part;
        } else {
          line = candidate;
        }
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const fitName = (name, maxWidth, maxHeight) => {
    let fit = null;
    for (let size = 76; size >= 30; size -= 2) {
      context.font = font(size);
      const lines = wrap(name, maxWidth);
      fit = { size, lines, lineHeight: Math.round(size * 1.08) };
      if (lines.length * fit.lineHeight <= maxHeight) break;
    }
    return fit;
  };

  const drawImageInto = (image, x, y, width, height) => {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = Math.round(image.naturalWidth * scale);
    const drawHeight = Math.round(image.naturalHeight * scale);
    context.imageSmoothingEnabled = false;
    context.drawImage(image, Math.round(x + (width - drawWidth) / 2), Math.round(y + (height - drawHeight) / 2), drawWidth, drawHeight);
  };

  const draw = () => {
    const card = readCard();
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';

    context.fillStyle = BLUE;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    const cardShape = [[70, 58], [1132, 66], [1126, 690], [64, 684]];
    context.fillStyle = '#ffffff';
    trace(wobble(cardShape, 11, 3, true), true);
    context.fill();
    penStroke(cardShape, 11, 10, true);

    context.fillStyle = INK;
    context.font = font(74);
    context.fillText('the duk cult', 116, 146);
    context.font = font(26);
    context.textAlign = 'right';
    context.fillText('membership card', 1084, 140);
    context.textAlign = 'left';
    penStroke([[108, 178], [1090, 172]], 23, 6, false);

    // photo box
    const photoShape = [[112, 214], [468, 210], [472, 566], [108, 570]];
    context.save();
    trace(wobble(photoShape, 31, 2, true), true);
    context.fillStyle = pfp ? BLUE : CREAM;
    context.fill();
    context.clip();
    if (pfp) {
      drawImageInto(pfp, 110, 212, 360, 356);
    } else {
      context.fillStyle = INK;
      context.font = font(26);
      context.textAlign = 'center';
      context.fillText(pfpState === 'error' ? "the duk didn't load." : 'loading the duk.', 290, 398);
      context.textAlign = 'left';
    }
    context.restore();
    penStroke(photoShape, 31, 7, true);
    context.fillStyle = INK;
    context.font = font(22);
    context.fillText('photo on file.', 116, 606);

    // details
    const left = 520;
    const maxWidth = 560;
    context.font = font(50);
    context.fillText('member ', left, 240);
    const memberWidth = context.measureText('member ').width;
    context.fillStyle = ORANGE;
    context.fillText(`#${card.number}`, left + memberWidth, 240);
    context.fillStyle = INK;

    const nameTop = 258;
    const nameHeight = 124;
    const name = fitName(card.name, maxWidth, nameHeight);
    context.font = font(name.size);
    const used = name.lines.length * name.lineHeight;
    const startY = nameTop + Math.max(0, (nameHeight - used) / 2) + name.size * 0.86;
    name.lines.forEach((line, index) => context.fillText(line, left, startY + index * name.lineHeight));

    context.font = font(34);
    context.fillText('position: assumed.', left, 428);
    context.font = font(32);
    context.fillText(`rank: ${card.rank}`, left, 472);
    context.fillText(`joined: ${card.date}`, left, 514);

    // signature
    context.save();
    context.translate(548, 592);
    context.rotate(-0.06);
    context.font = font(54, 'italic');
    context.fillText('duk.', 0, 0);
    context.restore();
    penStroke([[520, 608], [830, 603]], 47, 4, false);
    context.font = font(18);
    context.fillText('authorized signature. probably.', left, 636);

    if (corner) drawImageInto(corner, 874, 542, 216, 130);

    context.restore();

    canvas.setAttribute('aria-label', `membership card preview. the duk cult. member #${card.number}. ${card.name}. position: assumed. rank: ${card.rank}. joined ${card.date}. signed duk.`);
    post.href = `https://x.com/intent/post?text=${encodeURIComponent(`joined the duk cult. member #${card.number}. position assumed. just duk. ${CULT_URL}`)}`;
  };

  const render = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  };

  const updateDownload = () => {
    download.disabled = !pfp || saving;
  };

  const loadImage = src => new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => (image.naturalWidth ? resolve(image) : reject(new Error('empty image')));
    image.onerror = () => reject(new Error(`could not load ${src}`));
    image.src = src;
  });

  const loadArt = () => {
    const token = ++loadToken;
    pfp = null;
    pfpState = 'loading';
    retry.hidden = true;
    loadStatus.textContent = 'loading the duk.';
    canvas.setAttribute('aria-busy', 'true');
    updateDownload();
    render();

    loadImage(PFP_SRC).then(image => {
      if (token !== loadToken) return;
      pfp = image;
      pfpState = 'ready';
      loadStatus.textContent = 'card ready. it updates as you type.';
    }, () => {
      if (token !== loadToken) return;
      pfpState = 'error';
      loadStatus.textContent = 'the duk art did not load. try again.';
      retry.hidden = false;
    }).finally(() => {
      if (token !== loadToken) return;
      canvas.setAttribute('aria-busy', 'false');
      updateDownload();
      render();
    });

    if (!corner) {
      loadImage(CORNER_SRC).then(image => {
        corner = image;
        render();
      }, () => {});
    }
  };

  const changed = () => {
    exportStatus.textContent = '';
    render();
  };

  form.addEventListener('submit', event => event.preventDefault());
  nameInput.addEventListener('input', changed);
  numberInput.addEventListener('input', () => {
    const digits = numberInput.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== numberInput.value) numberInput.value = digits;
    changed();
  });
  rankSelect.addEventListener('change', changed);
  dateInput.addEventListener('input', changed);
  dateInput.addEventListener('change', changed);
  retry.addEventListener('click', loadArt);

  download.addEventListener('click', () => {
    if (!pfp || saving) return;
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    draw();
    saving = true;
    updateDownload();
    const filename = `duk-member-${readCard().number}.png`;
    exportStatus.textContent = 'making your card…';
    const failed = () => {
      exportStatus.textContent = 'could not save the png. try again.';
      saving = false;
      updateDownload();
    };
    try {
      // toBlob captures the canvas now, even if the form changes while it encodes.
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
          exportStatus.textContent = `download started: ${filename}. now post it and attach the card.`;
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

  post.addEventListener('click', () => {
    exportStatus.textContent = 'x opened in a new tab. attach the card you downloaded.';
  });

  draw();
  loadArt();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render, () => {});
})();
