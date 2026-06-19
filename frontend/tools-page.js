/* ═══════════════════════════════════════════
   ZIPHAY TOOLS PAGE — JavaScript Engine (CSP-safe)
   All event handlers use addEventListener —
   no inline onclick/oninput attributes.
═══════════════════════════════════════════ */
'use strict';

const toolFiles = {};

/* ── Shared helpers ── */
function fmtBytes(b) {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Generic drop zone wiring ── */
function wireDropZone(dropId, inputId, fileKey, onFile) {
  const drop = document.getElementById(dropId);
  const input = document.getElementById(inputId);
  if (!drop || !input) return;

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(fileKey, e.dataTransfer.files[0], onFile);
  });
  input.addEventListener('change', e => {
    if (e.target.files.length) handleFile(fileKey, e.target.files[0], onFile);
    input.value = '';
  });
}

function handleFile(key, file, cb) {
  if (!file || !file.type.startsWith('image/')) return;
  toolFiles[key] = file;
  if (cb) cb(file);
}

/* ── Show preview ── */
function showPreview(file, previewWrapId, previewImgId, dimBadgeId) {
  const wrap = document.getElementById(previewWrapId);
  const img  = document.getElementById(previewImgId);
  if (!wrap || !img) return;

  const reader = new FileReader();
  reader.onload = e => {
    img.src = e.target.result;
    wrap.classList.add('show');
    img.onload = () => {
      const badge = document.getElementById(dimBadgeId);
      if (badge) badge.textContent = img.naturalWidth + ' × ' + img.naturalHeight;
    };
  };
  reader.readAsDataURL(file);
}

/* ── Show result with download ── */
function showResult(slot, blob, filename, info, color) {
  const el = document.getElementById(slot + '-result'); if (!el) return;
  el.classList.add('show');
  const url = URL.createObjectURL(blob);
  const dlClass = `dl-btn dl-btn-${color}`;
  el.innerHTML = `
    <div class="result-inner" style="border-color:rgba(${color === 'teal' ? '0,212,170' : color === 'purple' ? '139,92,246' : '245,158,11'},.15)">
      <div class="result-row">
        <div class="result-info">
          <div class="result-name">${escHtml(filename)}</div>
          <div class="result-meta">${escHtml(info)}</div>
        </div>
        <button class="${dlClass}" data-dl-url="${escHtml(url)}" data-dl-name="${escHtml(filename)}">↓ Download</button>
      </div>
    </div>
  `;

  /* Bind download button via addEventListener */
  el.querySelectorAll('[data-dl-url]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = btn.dataset.dlUrl;
      a.download = btn.dataset.dlName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  });
}

/* ── Progress helpers ── */
function showProg(slot, pct, label) {
  const el = document.getElementById(slot + '-prog');
  if (!el) return;
  el.classList.add('show');
  const fill = el.querySelector('.prog-fill');
  if (fill) fill.style.width = pct + '%';
  const lbl = el.querySelector('.prog-label');
  if (lbl) lbl.textContent = label || 'Processing…';
}

function hideProg(slot) {
  const el = document.getElementById(slot + '-prog');
  if (el) el.classList.remove('show');
}

/* ══════════════════════════════════════
   RESIZE TOOL
══════════════════════════════════════ */
let resizeRatio = 1;

wireDropZone('resize-drop', 'resize-input', 'resize', f => {
  showPreview(f, 'resize-preview-wrap', 'resize-preview', 'resize-dim-badge');
  document.getElementById('resize-fname').textContent = f.name;
  document.getElementById('resize-drop').classList.add('has-file');
  document.getElementById('resize-btn').disabled = false;

  const img = new Image();
  img.onload = () => {
    resizeRatio = img.naturalWidth / img.naturalHeight;
    document.getElementById('resize-w').value = img.naturalWidth;
    document.getElementById('resize-h').value = img.naturalHeight;
  };
  img.src = URL.createObjectURL(f);
});

/* Mode toggle (px vs pct) */
document.querySelectorAll('#resize-mode-btns .seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#resize-mode-btns .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const isPx = btn.dataset.mode === 'px';
    document.getElementById('resize-px-opts').style.display = isPx ? '' : 'none';
    document.getElementById('resize-pct-opts').style.display = isPx ? 'none' : '';
  });
});

/* Output format toggle */
document.querySelectorAll('#resize-fmt-btns .seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#resize-fmt-btns .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

/* Lock aspect ratio — W/H sync */
const rw = document.getElementById('resize-w');
const rh = document.getElementById('resize-h');
if (rw) rw.addEventListener('input', () => {
  if (document.getElementById('resize-lock').checked && resizeRatio) {
    rh.value = Math.round(parseInt(rw.value) / resizeRatio);
  }
});
if (rh) rh.addEventListener('input', () => {
  if (document.getElementById('resize-lock').checked && resizeRatio) {
    rw.value = Math.round(parseInt(rh.value) * resizeRatio);
  }
});

/* Percentage slider value display */
const resizePct = document.getElementById('resize-pct');
if (resizePct) resizePct.addEventListener('input', () => {
  document.getElementById('resize-pct-val').textContent = resizePct.value + '%';
});

/* Resize action button */
document.getElementById('resize-btn')?.addEventListener('click', async () => {
  const f = toolFiles.resize; if (!f) return;
  const btn = document.getElementById('resize-btn');
  btn.disabled = true;
  showProg('resize', 20, 'Resizing…');

  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = URL.createObjectURL(f); });

    const activeMode = document.querySelector('#resize-mode-btns .seg-btn.active')?.dataset.mode || 'px';
    let w, h;
    if (activeMode === 'px') {
      w = parseInt(document.getElementById('resize-w').value) || img.naturalWidth;
      h = parseInt(document.getElementById('resize-h').value) || img.naturalHeight;
    } else {
      const pct = parseInt(document.getElementById('resize-pct').value) / 100;
      w = Math.round(img.naturalWidth * pct);
      h = Math.round(img.naturalHeight * pct);
    }

    showProg('resize', 60, 'Processing…');
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);

    const fmt = document.querySelector('#resize-fmt-btns .seg-btn.active')?.dataset.fmt || 'webp';
    const mime = fmt === 'png' ? 'image/png' : fmt === 'jpeg' ? 'image/jpeg' : 'image/webp';
    const quality = fmt === 'png' ? undefined : 0.85;

    const blob = await new Promise(res => c.toBlob(res, mime, quality));
    showProg('resize', 100, 'Done!');

    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    const outName = f.name.replace(/\.[^.]+$/, '') + '_resized.' + ext;
    const info = `${w}×${h} · ${fmtBytes(blob.size)}`;

    setTimeout(() => {
      hideProg('resize');
      showResult('resize', blob, outName, info, 'teal');
      btn.disabled = false;
    }, 400);
  } catch (e) {
    console.error('[Resize]', e);
    hideProg('resize');
    btn.disabled = false;
  }
});

/* ══════════════════════════════════════
   ROTATE / FLIP TOOL
══════════════════════════════════════ */
wireDropZone('rotate-drop', 'rotate-input', 'rotate', f => {
  showPreview(f, 'rotate-preview-wrap', 'rotate-preview', 'rotate-dim-badge');
  document.getElementById('rotate-fname').textContent = f.name;
  document.getElementById('rotate-drop').classList.add('has-file');
  /* Enable transform buttons */
  document.querySelectorAll('.xform-btn').forEach(b => b.style.opacity = '1');
});

/* Transform button clicks */
document.querySelectorAll('.xform-btn[data-xform]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const f = toolFiles.rotate; if (!f) return;
    const xform = btn.dataset.xform;
    showProg('rotate', 30, 'Transforming…');

    try {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = URL.createObjectURL(f); });

      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      const W = img.naturalWidth, H = img.naturalHeight;

      if (xform === 'r90') {
        c.width = H; c.height = W;
        ctx.translate(H, 0); ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, 0, 0);
      } else if (xform === 'r180') {
        c.width = W; c.height = H;
        ctx.translate(W, H); ctx.rotate(Math.PI);
        ctx.drawImage(img, 0, 0);
      } else if (xform === 'r270') {
        c.width = H; c.height = W;
        ctx.translate(0, W); ctx.rotate(-Math.PI / 2);
        ctx.drawImage(img, 0, 0);
      } else if (xform === 'flipH') {
        c.width = W; c.height = H;
        ctx.translate(W, 0); ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
      } else if (xform === 'flipV') {
        c.width = W; c.height = H;
        ctx.translate(0, H); ctx.scale(1, -1);
        ctx.drawImage(img, 0, 0);
      }

      showProg('rotate', 80, 'Encoding…');
      const blob = await new Promise(res => c.toBlob(res, 'image/png'));
      showProg('rotate', 100, 'Done!');

      const outName = f.name.replace(/\.[^.]+$/, '') + '_' + xform + '.png';
      const info = `${c.width}×${c.height} · ${fmtBytes(blob.size)}`;

      setTimeout(() => {
        hideProg('rotate');
        showResult('rotate', blob, outName, info, 'purple');
      }, 400);
    } catch (e) {
      console.error('[Rotate/Flip]', e);
      hideProg('rotate');
    }
  });
});

/* ══════════════════════════════════════
   WATERMARK TOOL
══════════════════════════════════════ */
let wmPosition = 'br';

wireDropZone('wm-drop', 'wm-input', 'watermark', f => {
  showPreview(f, 'wm-preview-wrap', 'wm-preview');
  document.getElementById('wm-fname').textContent = f.name;
  document.getElementById('wm-drop').classList.add('has-file');
  document.getElementById('wm-btn').disabled = false;
});

/* Watermark font size slider */
const wmSize = document.getElementById('wm-size');
if (wmSize) wmSize.addEventListener('input', () => {
  document.getElementById('wm-size-val').textContent = wmSize.value + 'px';
});

/* Watermark opacity slider */
const wmOpacity = document.getElementById('wm-opacity');
if (wmOpacity) wmOpacity.addEventListener('input', () => {
  document.getElementById('wm-op-val').textContent = wmOpacity.value + '%';
});

/* Color preset swatches */
document.querySelectorAll('.wm-preset[data-color]').forEach(swatch => {
  swatch.addEventListener('click', () => {
    document.getElementById('wm-color').value = swatch.dataset.color;
  });
});

/* Position grid */
document.querySelectorAll('#wm-pos-grid .pos-btn[data-pos]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#wm-pos-grid .pos-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    wmPosition = btn.dataset.pos;
  });
});

/* Watermark action button */
document.getElementById('wm-btn')?.addEventListener('click', async () => {
  const f = toolFiles.watermark; if (!f) return;
  const btn = document.getElementById('wm-btn');
  btn.disabled = true;
  showProg('wm', 20, 'Rendering watermark…');

  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = URL.createObjectURL(f); });

    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const text    = document.getElementById('wm-text').value || '© Ziphay';
    const size    = parseInt(document.getElementById('wm-size').value) || 36;
    const opacity = (parseInt(document.getElementById('wm-opacity').value) || 60) / 100;
    const color   = document.getElementById('wm-color').value || '#ffffff';
    const tile    = document.getElementById('wm-tile').checked;
    const pos     = wmPosition;

    ctx.font = `bold ${size}px Inter, sans-serif`;
    ctx.globalAlpha = opacity;

    /* Parse hex color */
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
    ctx.globalAlpha = 1; /* we baked opacity into fillStyle */

    if (tile) {
      showProg('wm', 50, 'Tiling watermark…');
      ctx.save();
      ctx.rotate(-Math.PI / 6);
      const tw = ctx.measureText(text).width + 80;
      const th = size + 60;
      for (let y = -c.height; y < c.height * 2; y += th) {
        for (let x = -c.width; x < c.width * 2; x += tw) {
          ctx.fillText(text, x, y);
        }
      }
      ctx.restore();
    } else {
      const m = ctx.measureText(text);
      const pad = Math.max(20, size * 0.5);
      let x, y;

      const posMap = {
        tl: [pad, pad + size],
        tc: [c.width / 2 - m.width / 2, pad + size],
        tr: [c.width - m.width - pad, pad + size],
        ml: [pad, c.height / 2 + size / 2],
        c:  [c.width / 2 - m.width / 2, c.height / 2 + size / 2],
        mr: [c.width - m.width - pad, c.height / 2 + size / 2],
        bl: [pad, c.height - pad],
        bc: [c.width / 2 - m.width / 2, c.height - pad],
        br: [c.width - m.width - pad, c.height - pad],
      };
      [x, y] = posMap[pos] || posMap.br;
      ctx.fillText(text, x, y);
    }

    showProg('wm', 90, 'Encoding…');
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    showProg('wm', 100, 'Done!');

    const outName = f.name.replace(/\.[^.]+$/, '') + '_watermarked.png';
    const info = `${c.width}×${c.height} · ${fmtBytes(blob.size)}`;

    setTimeout(() => {
      hideProg('wm');
      showResult('wm', blob, outName, info, 'gold');
      btn.disabled = false;
    }, 400);
  } catch (e) {
    console.error('[Watermark]', e);
    hideProg('wm');
    btn.disabled = false;
  }
});

/* ══════════════════════════════════════
   CSP-SAFE EVENT BINDINGS
══════════════════════════════════════ */

/* Scroll-to-top */
const stb = document.getElementById('scrollTopBtn');
if (stb) {
  stb.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', () => {
    stb.classList.toggle('show', window.scrollY > 300);
  }, { passive: true });
}

/* Theme toggle */
const themeBtn = document.getElementById('themeBtn');
if (themeBtn) {
  themeBtn.addEventListener('click', function () {
    const h = document.documentElement;
    const isDark = h.getAttribute('data-theme') === 'dark';
    h.setAttribute('data-theme', isDark ? 'light' : 'dark');
    this.textContent = isDark ? '☀️' : '🌙';
  });
}

/* ═══ PREMIUM ANIMATION HOOKS ═══ */

/* Nav scroll compact */
const pgNav = document.querySelector('.pg-nav');
if (pgNav) {
  window.addEventListener('scroll', () => {
    pgNav.classList.toggle('nav-compact', window.scrollY > 40);
  }, { passive: true });
}

/* 3D tilt on tool cards */
document.querySelectorAll('.tool-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(800px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg) translateY(-3px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.transition = 'transform .5s cubic-bezier(.16,1,.3,1)';
    setTimeout(() => card.style.transition = '', 500);
  });
});

/* Magnetic hover on action buttons */
document.querySelectorAll('.tc-action, .dl-btn').forEach(btn => {
  btn.addEventListener('mousemove', e => {
    const r = btn.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    btn.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = '';
    btn.style.transition = 'transform .4s cubic-bezier(.16,1,.3,1)';
    setTimeout(() => btn.style.transition = '', 400);
  });
});


