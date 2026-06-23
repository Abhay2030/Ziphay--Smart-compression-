/* ══════════════════════════════════════════
   CONVERTER PAGE CONTROLLER (CSP-safe)
   All event handlers use addEventListener —
   no inline onclick attributes.
══════════════════════════════════════════ */

/* Config for each card */
const CARDS = {
  'img-any':  { type:'img-any',  multi:true  },
  'heic':     { type:'heic',     multi:true  },
  'svg':      { type:'svg',      multi:true  },
  'gif':      { type:'gif',      multi:true  },
  'png-jpg':  { type:'png-jpg',  multi:true  },
  'img-pdf':  { type:'img-pdf',  multi:true  },
  'pdf-img':  { type:'pdf-img',  multi:false },
  'to-mp4':   { type:'to-mp4',   multi:false },
  'to-webm':  { type:'to-webm',  multi:false },
  'to-gif':   { type:'to-gif',   multi:false },
  'to-mp3':   { type:'to-mp3',   multi:false },
  /* ── Audio Studio cards ── */
  'aud-convert':  { type:'aud-convert',  multi:true  },
  'aud-compress': { type:'aud-compress', multi:false },
  'aud-trim':     { type:'aud-trim',     multi:false },
  'aud-merge':    { type:'aud-merge',    multi:true  },
  'aud-split':    { type:'aud-split',    multi:false },
  'aud-extract':  { type:'aud-extract',  multi:false },
  'aud-denoise':  { type:'aud-denoise',  multi:false },
  'aud-enhance':  { type:'aud-enhance',  multi:false },
  'aud-silence':  { type:'aud-silence',  multi:false },
  'aud-podcast':  { type:'aud-podcast',  multi:false },
  'aud-music':    { type:'aud-music',    multi:false },
  'aud-meta':     { type:'aud-meta',     multi:false },
  'aud-presets':  { type:'aud-presets',  multi:false },
};

const state = {};  // cardId → { files: [] }
Object.keys(CARDS).forEach(id => state[id] = { files: [] });

/* ── Wire up all drop zones ── */
Object.keys(CARDS).forEach(id => {
  const dropEl  = document.getElementById('drop-' + id);
  const inputEl = document.getElementById('input-' + id);
  if (!dropEl || !inputEl) return;

  dropEl.addEventListener('click', () => inputEl.click());
  dropEl.addEventListener('dragover',  e => { e.preventDefault(); dropEl.classList.add('dragover'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('dragover'));
  dropEl.addEventListener('drop', e => {
    e.preventDefault(); dropEl.classList.remove('dragover');
    addFiles(id, Array.from(e.dataTransfer.files));
  });
  inputEl.addEventListener('change', e => {
    addFiles(id, Array.from(e.target.files));
    inputEl.value = '';
  });

  /* CSP-safe: wire convert button via addEventListener */
  const btnEl = document.getElementById('btn-' + id);
  if (btnEl) btnEl.addEventListener('click', () => runConvert(id));
});

function addFiles(id, files) {
  const cfg = CARDS[id];
  if (!cfg.multi) state[id].files = [files[0]];
  else files.forEach(f => {
    if (!state[id].files.find(x => x.name === f.name && x.size === f.size))
      state[id].files.push(f);
  });
  renderChips(id);
  document.getElementById('btn-' + id).disabled = state[id].files.length === 0;

  const dropSub = document.querySelector('#drop-' + id + ' .mini-drop-sub');
  if (state[id].files.length === 1) {
    dropSub.textContent = state[id].files[0].name + ' · ' + ZiphayConverter.fmtBytes(state[id].files[0].size);
  } else {
    const total = state[id].files.reduce((s,f)=>s+f.size,0);
    dropSub.textContent = state[id].files.length + ' files · ' + ZiphayConverter.fmtBytes(total);
  }
}

/* CSP-safe: renderChips uses data-attributes + event delegation instead of inline onclick */
function renderChips(id) {
  const el = document.getElementById('chips-' + id);
  if (!el) return;
  el.innerHTML = state[id].files.map((f,i) =>
    `<span class="fc">${escHtml(truncate(f.name,18))} <span class="chip-remove" data-card-id="${escHtml(id)}" data-file-idx="${i}" style="cursor:pointer;margin-left:2px">×</span></span>`
  ).join('');

  /* Bind chip remove buttons */
  el.querySelectorAll('.chip-remove').forEach(span => {
    span.addEventListener('click', e => {
      e.stopPropagation();
      removeFile(span.dataset.cardId, parseInt(span.dataset.fileIdx, 10));
    });
  });
}

function removeFile(id, idx) {
  state[id].files.splice(idx, 1);
  renderChips(id);
  document.getElementById('btn-' + id).disabled = state[id].files.length === 0;
  if (!state[id].files.length) {
    const dropSub = document.querySelector('#drop-' + id + ' .mini-drop-sub');
    if (dropSub) dropSub.textContent = 'Drop files here';
  }
}

/* ── Progress helpers ── */
function setProgress(id, pct, label) {
  const prog = document.getElementById('prog-' + id);
  if (!prog) return;
  prog.classList.add('show');
  prog.querySelector('.cp-fill').style.width = pct + '%';
  const lbl = prog.querySelector('.cp-label') || document.getElementById('lbl-' + id);
  if (lbl) lbl.textContent = label || 'Converting…';
}
function hideProgress(id) {
  const prog = document.getElementById('prog-' + id);
  if (prog) prog.classList.remove('show');
}

/* CSP-safe: showResult uses data-attributes + event delegation instead of inline onclick */
function showResult(id, results) {
  const el = document.getElementById('result-' + id);
  if (!el) return;
  el.classList.add('show');

  const arr   = Array.isArray(results) ? results : [results];
  const total = arr.reduce((s,r) => s + r.newSize, 0);
  const orig  = arr.reduce((s,r) => s + (r.origSize||0), 0);

  // Store blobs on window for download
  if (!window._zBlobs) window._zBlobs = {};
  arr.forEach((r,i) => { window._zBlobs[i + '_' + id] = r.blob; });
  window._zAllBlobs = window._zAllBlobs || {};
  window._zAllBlobs[id] = arr;

  el.innerHTML = `
    <div class="cr-inner">
      <div class="cr-stats">
        <span>${arr.length} file${arr.length>1?'s':''} converted</span>
        ${orig ? '<span>'+ZiphayConverter.fmtBytes(orig)+' → '+ZiphayConverter.fmtBytes(total)+'</span>' : ''}
      </div>
      <div class="cr-files">
        ${arr.map((r,i) => `
          <div class="cr-file">
            <span class="cr-name">${escHtml(r.filename)}</span>
            <span class="cr-size">${ZiphayConverter.fmtBytes(r.newSize)}</span>
            <button class="cr-dl" data-blob-key="${i}_${escHtml(id)}" data-filename="${escHtml(r.filename)}">↓</button>
          </div>
        `).join('')}
      </div>
      ${arr.length > 1 ? `<button class="cr-all" data-dl-all="${escHtml(id)}">↓ Download all ${arr.length} files</button>` : ''}
    </div>
  `;

  /* Bind download buttons via addEventListener */
  el.querySelectorAll('.cr-dl[data-blob-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      dlBlob(window._zBlobs[btn.dataset.blobKey], btn.dataset.filename);
    });
  });
  const dlAllBtn = el.querySelector('.cr-all[data-dl-all]');
  if (dlAllBtn) {
    dlAllBtn.addEventListener('click', () => dlAll(dlAllBtn.dataset.dlAll));
  }
}

function dlBlob(blob, filename) {
  if (!blob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 15000);
}

function dlAll(id) {
  const all = (window._zAllBlobs || {})[id] || [];
  all.forEach(r => dlBlob(r.blob, r.filename));
}

function showError(id, msg) {
  hideProgress(id);
  const el = document.getElementById('result-' + id);
  if (!el) return;
  el.classList.add('show');
  el.innerHTML = `<div style="padding:10px 12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:9px;color:#f87171;font-size:.78rem">⚠️ ${escHtml(msg)}</div>`;
  document.getElementById('btn-' + id).disabled = false;
}

/* ════════════════════════════════════════
   MAIN CONVERT DISPATCHER
════════════════════════════════════════ */
async function runConvert(id) {
  const files = state[id].files;
  if (!files.length) return;
  const btn = document.getElementById('btn-' + id);
  btn.disabled = true;
  const resultEl = document.getElementById('result-' + id);
  if (resultEl) { resultEl.classList.remove('show'); resultEl.innerHTML = ''; }
  setProgress(id, 10, 'Starting…');

  try {
    const startTime = performance.now();
    let results;

    /* ── Image conversions ── */
    if (id === 'img-any') {
      const fmt = document.getElementById('fmt-img-any').value;
      const q   = parseFloat(document.getElementById('q-img-any').value);
      results   = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(id, Math.round(10 + (i/files.length)*85), `Converting ${i+1}/${files.length}…`);
        results.push(await ZiphayConverter.convertImage(files[i], fmt, q));
      }
    }
    else if (id === 'heic') {
      const fmt = document.getElementById('fmt-heic').value;
      results   = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(id, Math.round(10 + (i/files.length)*85), `Converting ${i+1}/${files.length}…`);
        results.push(await ZiphayConverter.convertHEIC(files[i], fmt));
      }
    }
    else if (id === 'svg') {
      const fmt   = document.getElementById('fmt-svg').value;
      const scale = parseInt(document.getElementById('scale-svg').value);
      results     = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(id, Math.round(10 + (i/files.length)*85), `Rendering ${i+1}/${files.length}…`);
        results.push(await ZiphayConverter.convertSVG(files[i], fmt, scale));
      }
    }
    else if (id === 'gif') {
      const fmt = document.getElementById('fmt-gif').value;
      results   = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(id, Math.round(10 + (i/files.length)*85), `Converting ${i+1}/${files.length}…`);
        results.push(await ZiphayConverter.convertGIF(files[i], fmt));
      }
    }
    else if (id === 'png-jpg') {
      const bg = document.getElementById('bg-png-jpg').value;
      const q  = parseFloat(document.getElementById('q-png-jpg').value);
      results  = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(id, Math.round(10 + (i/files.length)*85), `Converting ${i+1}/${files.length}…`);
        results.push(await ZiphayConverter.convertImage(files[i], 'jpeg', q, bg));
      }
    }
    else if (id === 'img-pdf') {
      setProgress(id, 20, 'Building PDF…');
      results = [await ZiphayConverter.imagesToPDF(files, pct => setProgress(id, 20 + pct*0.75, `Adding page… ${pct}%`))];
    }
    else if (id === 'pdf-img') {
      const fmt   = document.getElementById('fmt-pdf-img').value;
      const scale = parseInt(document.getElementById('scale-pdf-img').value);
      setProgress(id, 15, 'Loading PDF…');
      results = await ZiphayConverter.pdfToImages(files[0], fmt, scale, pct => setProgress(id, 15 + pct*0.8, `Rendering page… ${pct}%`));
    }

    /* ── Video conversions (FFmpeg) ── */
    else if (id === 'to-mp4') {
      setProgress(id, 5, 'Loading FFmpeg (~32 MB on first use)…');
      results = [await ZiphayConverter.convertVideo(files[0], 'mp4',
        pct => setProgress(id, 5 + pct*0.9, `Encoding… ${pct}%`),
        msg => { if (msg) document.getElementById('lbl-to-mp4') && (document.getElementById('lbl-to-mp4').textContent = msg.slice(0,60)); }
      )];
    }
    else if (id === 'to-webm') {
      setProgress(id, 5, 'Loading FFmpeg (~32 MB on first use)…');
      results = [await ZiphayConverter.convertVideo(files[0], 'webm',
        pct => setProgress(id, 5 + pct*0.9, `Encoding WebM… ${pct}%`)
      )];
    }
    else if (id === 'to-gif') {
      setProgress(id, 5, 'Loading FFmpeg (~32 MB on first use)…');
      results = [await ZiphayConverter.convertVideo(files[0], 'gif',
        pct => setProgress(id, 5 + pct*0.9, `Generating GIF… ${pct}%`)
      )];
    }
    else if (id === 'to-mp3') {
      const fmt = document.getElementById('fmt-to-mp3').value;
      setProgress(id, 5, 'Loading FFmpeg (~32 MB on first use)…');
      results = [await ZiphayConverter.convertVideo(files[0], fmt,
        pct => setProgress(id, 5 + pct*0.9, `Extracting audio… ${pct}%`)
      )];
    }

    /* ════ AUDIO STUDIO TOOLS ════ */
    else if (id === 'aud-convert') {
      const fmt = document.getElementById('fmt-aud-convert').value;
      const br  = document.getElementById('q-aud-convert').value;
      setProgress(id, 5, 'Loading FFmpeg…');
      results = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(id, Math.round(5 + (i/files.length)*90), `Converting ${i+1}/${files.length}…`);
        results.push(await ZiphayAudio.convertAudio(files[i], fmt, br));
      }
    }
    else if (id === 'aud-compress') {
      const mode = document.getElementById('mode-aud-compress').value;
      setProgress(id, 5, 'Loading FFmpeg…');
      results = [await ZiphayAudio.compressAudio(files[0], mode, pct => setProgress(id, 5 + pct*0.9, `Compressing… ${pct}%`))];
    }
    else if (id === 'aud-trim') {
      const start = parseFloat(document.getElementById('start-aud-trim').value) || 0;
      const end   = parseFloat(document.getElementById('end-aud-trim').value) || 0;
      setProgress(id, 5, 'Loading FFmpeg…');
      results = [await ZiphayAudio.trimAudio(files[0], start, end, pct => setProgress(id, 5 + pct*0.9, `Trimming… ${pct}%`))];
    }
    else if (id === 'aud-merge') {
      setProgress(id, 5, 'Loading FFmpeg…');
      results = [await ZiphayAudio.mergeAudio(files, pct => setProgress(id, 5 + pct*0.9, `Merging… ${pct}%`))];
    }
    else if (id === 'aud-split') {
      const splitAt = parseFloat(document.getElementById('time-aud-split').value) || 30;
      setProgress(id, 5, 'Loading FFmpeg…');
      results = await ZiphayAudio.splitAudio(files[0], splitAt, pct => setProgress(id, 5 + pct*0.9, `Splitting… ${pct}%`));
    }
    else if (id === 'aud-extract') {
      const fmt = document.getElementById('fmt-aud-extract').value;
      setProgress(id, 5, 'Loading FFmpeg…');
      results = [await ZiphayAudio.extractAudioFromVideo(files[0], fmt, pct => setProgress(id, 5 + pct*0.9, `Extracting… ${pct}%`))];
    }
    else if (id === 'aud-denoise') {
      setProgress(id, 5, 'Analyzing noise profile…');
      results = [await ZiphayAudio.denoiseAudio(files[0], pct => setProgress(id, 5 + pct*0.9, `Denoising… ${pct}%`))];
    }
    else if (id === 'aud-enhance') {
      setProgress(id, 5, 'Processing voice…');
      results = [await ZiphayAudio.enhanceVoice(files[0], pct => setProgress(id, 5 + pct*0.9, `Enhancing… ${pct}%`))];
    }
    else if (id === 'aud-silence') {
      setProgress(id, 5, 'Scanning for silence…');
      results = [await ZiphayAudio.removeSilence(files[0], -40, pct => setProgress(id, 5 + pct*0.9, `Removing silence… ${pct}%`))];
    }
    else if (id === 'aud-podcast') {
      setProgress(id, 5, 'Optimizing podcast…');
      results = [await ZiphayAudio.optimizePodcast(files[0], pct => setProgress(id, 5 + pct*0.9, `Optimizing… ${pct}%`))];
    }
    else if (id === 'aud-music') {
      setProgress(id, 10, 'Analyzing BPM & Key…');
      const analysis = await ZiphayAudio.analyzeBPM(files[0]);
      document.getElementById('bpm-val').textContent = analysis.bpm;
      document.getElementById('key-val').textContent = analysis.key;
      document.getElementById('dur-val').textContent = analysis.duration.toFixed(1) + 's';
      setProgress(id, 100, 'Analysis complete!');
      setTimeout(() => { hideProgress(id); btn.disabled = false; }, 400);
      return; /* No download for analysis */
    }
    else if (id === 'aud-meta') {
      const meta = {
        title:  document.getElementById('meta-title').value,
        artist: document.getElementById('meta-artist').value,
        album:  document.getElementById('meta-album').value,
        year:   document.getElementById('meta-year').value,
      };
      setProgress(id, 5, 'Loading FFmpeg…');
      results = [await ZiphayAudio.editMetadata(files[0], meta, pct => setProgress(id, 5 + pct*0.9, `Writing tags… ${pct}%`))];
    }
    else if (id === 'aud-presets') {
      const preset = document.getElementById('preset-aud-presets').value;
      setProgress(id, 5, 'Loading FFmpeg…');
      results = [await ZiphayAudio.exportPreset(files[0], preset, pct => setProgress(id, 5 + pct*0.9, `Exporting… ${pct}%`))];
    }

    setProgress(id, 100, 'Done!');
    const endTime = performance.now();
    setTimeout(() => { 
      hideProgress(id); 
      showResult(id, results); 
      btn.disabled = false; 
      
      // Update Audio Analytics Panel if this is an audio tool
      if (document.getElementById('card-' + id)?.dataset.cat === 'audio' && document.getElementById('ap-orig')) {
        const arr = Array.isArray(results) ? results : [results];
        const totalOrig = arr.reduce((s,r) => s + (r.origSize||0), 0);
        const totalNew = arr.reduce((s,r) => s + (r.newSize||0), 0);
        
        document.getElementById('ap-orig').textContent = totalOrig ? ZiphayConverter.fmtBytes(totalOrig) : '--';
        document.getElementById('ap-opt').textContent = totalNew ? ZiphayConverter.fmtBytes(totalNew) : '--';
        
        if (totalOrig && totalNew && totalOrig > totalNew) {
          const ratio = Math.round((1 - (totalNew / totalOrig)) * 100);
          document.getElementById('ap-ratio').textContent = ratio + '%';
          document.getElementById('ap-saved').textContent = ZiphayConverter.fmtBytes(totalOrig - totalNew);
        } else {
          document.getElementById('ap-ratio').textContent = '--';
          document.getElementById('ap-saved').textContent = '--';
        }
        
        document.getElementById('ap-dur').textContent = arr.length;
        document.getElementById('ap-speed').textContent = ((endTime - startTime) / 1000).toFixed(1) + 's';
      }
    }, 400);

  } catch (err) {
    console.error('[Ziphay Converter]', err);
    showError(id, err.message || 'Conversion failed. Please try again.');
  }
}

/* ── Category filter ── */
document.querySelectorAll('.cat-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    
    // Toggle standard cards
    document.querySelectorAll('.conv-card').forEach(c => {
      const isAudioCard = c.dataset.cat === 'audio';
      const isHidden = (cat !== 'all' && c.dataset.cat !== cat) || (cat === 'all' && isAudioCard);
      c.classList.toggle('hidden', isHidden);
      
      // Remove inline style if present (from initial load)
      c.style.display = ''; 
    });
    
    // Toggle Audio Studio specific header/footer
    const audHeader = document.getElementById('audioHeader');
    const audFooter = document.getElementById('audioFooter');
    if (audHeader) audHeader.style.display = (cat === 'audio') ? 'block' : 'none';
    if (audFooter) audFooter.style.display = (cat === 'audio') ? 'block' : 'none';
    
    // Re-trigger 3D tilt attach if elements were hidden
    if (cat === 'audio') {
       window.dispatchEvent(new Event('resize'));
    }
  });
});

/* ── Theme toggle ── */
document.getElementById('themeBtn').addEventListener('click', function () {
  const h = document.documentElement, d = h.getAttribute('data-theme') === 'dark';
  h.setAttribute('data-theme', d ? 'light' : 'dark');
  this.textContent = d ? '☀️' : '🌙';
});

/* ── Scroll-to-top (CSP-safe, replaces inline onclick) ── */
const stb = document.getElementById('scrollTopBtn');
if (stb) {
  stb.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', () => {
    stb.classList.toggle('show', window.scrollY > 300);
  }, { passive: true });
}

/* ── Utilities ── */
function escHtml(s)     { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function truncate(s, n) { return s.length > n ? s.slice(0,n-1)+'…' : s; }

/* ═══ PREMIUM ANIMATION HOOKS ═══ */

/* Nav scroll compact */
const pgNav = document.querySelector('.pg-nav');
if (pgNav) {
  window.addEventListener('scroll', () => {
    pgNav.classList.toggle('nav-compact', window.scrollY > 40);
  }, { passive: true });
}

/* 3D tilt on converter cards */
document.querySelectorAll('.conv-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(800px) rotateY(${x*6}deg) rotateX(${-y*6}deg) translateY(-2px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.transition = 'transform .5s cubic-bezier(.16,1,.3,1)';
    setTimeout(() => card.style.transition = '', 500);
  });
});

/* Magnetic hover on convert buttons */
document.querySelectorAll('.conv-btn, .cr-dl, .cr-all').forEach(btn => {
  btn.addEventListener('mousemove', e => {
    const r = btn.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    btn.style.transform = `translate(${x*0.1}px, ${y*0.1}px)`;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = '';
    btn.style.transition = 'transform .4s cubic-bezier(.16,1,.3,1)';
    setTimeout(() => btn.style.transition = '', 400);
  });
});

/* Category tab click ripple */
document.querySelectorAll('.cat-tab').forEach(tab => {
  tab.addEventListener('click', function(e) {
    const ripple = document.createElement('span');
    ripple.style.cssText = 'position:absolute;border-radius:50%;background:rgba(255,255,255,.2);transform:scale(0);animation:catRipple .5s ease forwards;pointer-events:none;';
    const r = this.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - r.left - size/2) + 'px';
    ripple.style.top = (e.clientY - r.top - size/2) + 'px';
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  });
});


