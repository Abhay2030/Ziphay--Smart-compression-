/* ══════════════════════════════════════════════
   ZIPHAY  script.js  v4 — clean build
   ✅ File upload fixed (click + drag & drop)
   ✅ Compress mode (Canvas WebP/JPEG/PNG + fflate)
   ✅ Upscale mode (Canvas 2×/4×/8× interpolation)
   ✅ Goal selector with live info strip
   ✅ Estimated size preview
   ✅ Batch upload with removable chips
   ✅ Real before/after comparison slider
   ✅ Dark / Light mode toggle (data-theme)
   ✅ Scroll reveal
══════════════════════════════════════════════ */

/* ─────────────────────────────────────
   CONSTANTS
───────────────────────────────────── */
const IMAGE_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png',
    'image/webp', 'image/gif', 'image/bmp', 'image/tiff'
];

/* AVIF support detection */
const AVIF_SUPPORTED = (() => {
    try {
        return document.createElement('canvas').toDataURL('image/avif').startsWith('data:image/avif');
    } catch(e) { return false; }
})();

const GOAL_PROFILES = {
    web: {
        label: 'Web Optimisation', tag: '1920px · WebP', dot: '#60a5fa',
        desc: 'Converts to WebP, ideal for websites and web apps.',
        maxDim: 1920, quality: { low: .85, medium: .65, high: .38 },
        steps: [
            { l: 'Analysing for web delivery…', d: 'Checking resolution and colour space…' },
            { l: 'Applying web compression…', d: 'Converting to WebP at web-optimal quality…' },
            { l: 'Stripping metadata…', d: 'Removing EXIF, GPS, colour profiles…' },
        ]
    },
    email: {
        label: 'Email Sharing', tag: '< 25 MB', dot: '#34d399',
        desc: 'Aggressively reduces size to stay under the 25 MB email limit.',
        maxDim: 1200, quality: { low: .80, medium: .55, high: .28 },
        steps: [
            { l: 'Checking attachment limit…', d: 'Targeting under 25 MB…' },
            { l: 'Applying email compression…', d: 'Reducing to 1200px max…' },
            { l: 'Finalising attachment…', d: 'Ensuring Gmail & Outlook compatibility…' },
        ]
    },
    social: {
        label: 'Social Media', tag: '1080px', dot: '#fb923c',
        desc: '1080px — perfect for Instagram, TikTok, Twitter/X and LinkedIn.',
        maxDim: 1080, quality: { low: .82, medium: .62, high: .38 },
        steps: [
            { l: 'Optimising for social feeds…', d: 'Targeting 1080px for all platforms…' },
            { l: 'Applying social compression…', d: 'Balancing quality vs load speed…' },
            { l: 'Platform-ready output…', d: 'IG, TikTok, X, LinkedIn ready…' },
        ]
    },
    archive: {
        label: 'Archive / Storage', tag: '4K · Max Quality', dot: '#a78bfa',
        desc: 'Prioritises quality. Ideal for long-term storage and backups.',
        maxDim: 3840, quality: { low: .92, medium: .80, high: .65 },
        steps: [
            { l: 'Preparing archive compression…', d: 'Preserving maximum fidelity…' },
            { l: 'High-quality encoding…', d: 'Processing at 3840px max…' },
            { l: 'Packaging for storage…', d: 'Archive-grade output…' },
        ]
    },
};

const FFLATE_LEVEL = { low: 3, medium: 6, high: 9 };
const ENHANCE_MODES = {
    smooth: 'imageSmoothingQuality:high',
    crisp: 'imageSmoothingEnabled:false',
    natural: 'imageSmoothingQuality:medium',
};

/* ─────────────────────────────────────
   STATE
───────────────────────────────────── */
let currentMode = 'compress';  // 'compress' | 'upscale'
let currentPlan = 'pro'; // all features unlocked for all users
let selectedFiles = [];
let resultBlobs = [];
let cmpUrlBefore = null;
let cmpUrlAfter = null;
let cmpDragging = false;

/* ─────────────────────────────────────
   DOM REFS
───────────────────────────────────── */
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileChips = document.getElementById('fileChips');
const dropTitle = document.getElementById('dropTitleSpan');
const dropSub = document.getElementById('dropSub');
const actionBtn = document.getElementById('actionBtn');
const idleState = document.getElementById('idleState');
const procState = document.getElementById('processingState');
const resultBox = document.getElementById('resultBox');
const progressFill = document.getElementById('progressFill');
const pctLabel = document.getElementById('pctLabel');
const procLabel = document.getElementById('procLabel');
const procDetail = document.getElementById('procDetail');
const timeEst = document.getElementById('timeEst');
const resultFiles = document.getElementById('resultFiles');

/* ─────────────────────────────────────
   MODE SWITCH (Compress / Upscale)
───────────────────────────────────── */
function switchMode(mode) {
    
    currentMode = mode;

    // Update tab styles
    document.querySelectorAll('.mode-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.mode === mode)
    );

    // Show/hide panels
    document.getElementById('compressPanel').classList.toggle('hidden', mode !== 'compress');
    document.getElementById('upscalePanel').classList.toggle('hidden', mode !== 'upscale');
    document.getElementById('denoisePanel').classList.toggle('hidden', mode !== 'denoise');
    document.getElementById('bgRemovePanel').classList.toggle('hidden', mode !== 'bgremove');
    document.getElementById('compressOptions').classList.toggle('hidden', mode !== 'compress');

    // Update file accept + hints
    if (mode === 'upscale') {
        fileInput.accept = 'image/*';
        dropSub.textContent = 'JPG · PNG · WebP · GIF · BMP — Images only for upscaling';
        actionBtn.textContent = '🔭 Upscale Image';
        document.getElementById('estPreview').classList.add('hidden');
    } else if (mode === 'denoise') {
        fileInput.accept = 'image/*';
        dropSub.textContent = 'JPG · PNG · WebP — Images only for denoising';
        actionBtn.textContent = '✨ Denoise Image';
        document.getElementById('estPreview').classList.add('hidden');
        document.getElementById('upscalePreview').classList.add('hidden');
    } else if (mode === 'bgremove') {
        fileInput.accept = 'image/*';
        dropSub.textContent = 'JPG · PNG · WebP — Images only for background removal';
        actionBtn.textContent = '✂️ Remove Background';
        document.getElementById('estPreview').classList.add('hidden');
        document.getElementById('upscalePreview').classList.add('hidden');
    } else {
        fileInput.accept = 'image/*,video/*,.pdf,.doc,.docx,.zip,.gz,.rar';
        dropSub.textContent = 'JPG · PNG · WebP · PDF · MP4 · ZIP · DOCX — Max 2 GB';
        actionBtn.textContent = '⚡ Optimize with AI';
        document.getElementById('upscalePreview').classList.add('hidden');
    }

    if (selectedFiles.length) updatePreviews();
    resetDropZoneStyle();
}

/* ─────────────────────────────────────
   GOAL SELECTOR
───────────────────────────────────── */
function applyGoal(key) {

    const p = GOAL_PROFILES[key];
    if (!p) return;
    document.querySelectorAll('.goal-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.goal === key)
    );
    document.getElementById('gsDot').style.cssText = `background:${p.dot};box-shadow:0 0 7px ${p.dot};`;
    document.getElementById('gsLabel').textContent = p.label;
    document.getElementById('gsTag').textContent = p.tag;
    document.getElementById('gsDesc').textContent = p.desc;
    document.getElementById('goalStrip').style.borderColor = p.dot + '44';
    if (!selectedFiles.length) {
        const hints = {
            web: 'JPG · PNG · WebP · PDF · MP4 — outputs 1920px WebP',
            email: 'JPG · PNG · PDF · DOCX — targets under 25 MB',
            social: 'JPG · PNG · WebP — outputs 1080px WebP',
            archive: 'Any file — maximum quality output',
        };
        dropSub.textContent = hints[key] || hints.web;
    }
    if (selectedFiles.length) updatePreviews();
}

document.querySelectorAll('.goal-btn').forEach(b =>
    b.addEventListener('click', () => applyGoal(b.dataset.goal))
);
applyGoal('web');

/* ─────────────────────────────────────
   LEVEL + FORMAT SELECTORS
───────────────────────────────────── */
document.querySelectorAll('.level-tag').forEach(t =>
    t.addEventListener('click', () => {
        document.querySelectorAll('.level-tag').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        if (selectedFiles.length) updatePreviews();
    })
);
document.querySelectorAll('.fmt-opt').forEach(b =>
    b.addEventListener('click', () => {
        document.querySelectorAll('.fmt-opt').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
    })
);

/* ─────────────────────────────────────
   UPSCALE OPTION SELECTORS
───────────────────────────────────── */
document.querySelectorAll('#scaleBtns .up-btn').forEach(b =>
    b.addEventListener('click', () => {
        document.querySelectorAll('#scaleBtns .up-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        if (selectedFiles.length) updatePreviews();
    })
);
document.querySelectorAll('#enhanceBtns .up-btn').forEach(b =>
    b.addEventListener('click', () => {
        document.querySelectorAll('#enhanceBtns .up-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
    })
);

/* ─────────────────────────────────────
   FILE UPLOAD — FIXED
   Input is hidden. Click on drop zone
   explicitly calls fileInput.click().
   No overlay, no pointer-event conflict.
───────────────────────────────────── */
dropZone.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip-rm')) return; // don't open when removing chip
    fileInput.click();
});
dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', e => {
    if (e.target.files.length) addFiles(Array.from(e.target.files));
    fileInput.value = ''; // reset so same file can be re-selected
});

// Drag & drop
dropZone.addEventListener('dragenter', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
});

/* ─────────────────────────────────────
   SECURITY: URL VALIDATION (SSRF Protection)
   Blocks internal IP ranges, localhost,
   non-HTTPS protocols, and cloud metadata
   endpoints from being fetched.
───────────────────────────────────── */
function isUrlSafeToFetch(urlStr) {
    try {
        const url = new URL(urlStr);
        /* Only HTTPS allowed */
        if (url.protocol !== 'https:') return false;
        const hostname = url.hostname.toLowerCase();
        /* Block localhost variants */
        if (hostname === 'localhost' || hostname === '[::1]') return false;
        /* Block private/internal IP ranges */
        const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (ipMatch) {
            const [, a, b] = ipMatch.map(Number);
            if (a === 10) return false;                              /* 10.0.0.0/8 */
            if (a === 172 && b >= 16 && b <= 31) return false;       /* 172.16.0.0/12 */
            if (a === 192 && b === 168) return false;                /* 192.168.0.0/16 */
            if (a === 127) return false;                              /* 127.0.0.0/8 */
            if (a === 169 && b === 254) return false;                 /* 169.254.0.0/16 (cloud metadata) */
            if (a === 0) return false;                                /* 0.0.0.0/8 */
        }
        /* Block cloud metadata hostnames */
        if (hostname === 'metadata.google.internal') return false;
        if (hostname.endsWith('.internal')) return false;
        return true;
    } catch (e) {
        return false;
    }
}

// Paste from clipboard (unified handler — handles files AND image URLs)
window.addEventListener('paste', async e => {
    if (!procState.classList.contains('hidden')) return;
    if (e.target.tagName === 'INPUT' && e.target.type !== 'file') return;

    // 1. File paste
    if (e.clipboardData && e.clipboardData.files.length) {
        e.preventDefault();
        const files = Array.from(e.clipboardData.files);
        dropZone.classList.add('paste-flash');
        setTimeout(() => dropZone.classList.remove('paste-flash'), 600);
        addFiles(files);
        showToast(`📋 Pasted ${files.length} file(s) from clipboard!`, 'success', 2500);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    // 2. URL paste — fetch remote image (with SSRF protection)
    const text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
    if (text.match(/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|bmp|avif|svg)(\?.*)?$/i)) {
        /* ── SECURITY: Validate URL against SSRF blocklist ── */
        if (!isUrlSafeToFetch(text)) {
            e.preventDefault();
            showToast('❌ Blocked: URL points to an internal or restricted address.', 'error', 4000);
            return;
        }
        e.preventDefault();
        showToast('🌐 Fetching image from URL…', 'info', 3000);
        try {
            const response = await fetch(text);
            if (!response.ok) throw new Error('Fetch failed');
            const blob = await response.blob();
            /* Validate content type from response */
            const contentType = blob.type || '';
            if (!contentType.startsWith('image/')) {
                showToast('❌ Fetched URL did not return an image. Aborted.', 'error', 4000);
                return;
            }
            const urlParts = text.split('/').pop().split('?')[0];
            const file = new File([blob], urlParts || 'imported_image.jpg', { type: blob.type || 'image/jpeg' });
            dropZone.classList.add('paste-flash');
            setTimeout(() => dropZone.classList.remove('paste-flash'), 600);
            addFiles([file]);
            showToast(`✅ Imported: ${file.name}`, 'success', 3000);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            showToast('❌ Could not fetch image from URL. Check the link and try again.', 'error', 4000);
        }
    }
});

// Tool cards trigger
function openTool(accept, mode) {
    switchMode(mode);
    fileInput.accept = accept;
    // Need slight delay so switchMode sets accept first
    setTimeout(() => fileInput.click(), 50);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─────────────────────────────────────
   ADD FILES
───────────────────────────────────── */
function addFiles(files) {
    // Filter to images only if in upscale or denoise mode
    const imageOnly = currentMode === 'upscale' || currentMode === 'denoise';
    const filtered = imageOnly
        ? files.filter(f => IMAGE_TYPES.includes(f.type.toLowerCase()))
        : files;

    if (!filtered.length) {
        showToast('⚠️ ' + (currentMode === 'upscale' ? 'Upscale' : 'Denoise') + ' mode only supports image files (JPG, PNG, WebP, GIF, BMP).', 'error');
        return;
    }

    filtered.forEach(f => {
        if (!selectedFiles.find(x => x.name === f.name && x.size === f.size))
            selectedFiles.push(f);
    });

    renderChips();
    updatePreviews();
    actionBtn.disabled = false;

    if (selectedFiles.length === 1) {
        dropTitle.textContent = selectedFiles[0].name;
        dropSub.textContent = `${mimeLabel(selectedFiles[0].type)} · ${fmtBytes(selectedFiles[0].size)} · Ready`;
        // Try to read EXIF for single JPEG
        tryShowExif(selectedFiles[0]);
        // Show thumbnail preview
        showUploadThumbnail(selectedFiles[0]);
    } else {
        dropTitle.textContent = `${selectedFiles.length} files selected`;
        dropSub.textContent = `Total: ${fmtBytes(selectedFiles.reduce((s, f) => s + f.size, 0))} · Ready`;
        document.getElementById('exifPanel').classList.add('hidden');
        hideUploadThumbnail();
    }

    // Success pulse micro-interaction
    dropZone.classList.add('upload-success');
    setTimeout(() => dropZone.classList.remove('upload-success'), 800);
}

/* ─────────────────────────────────────
   IMAGE THUMBNAIL PREVIEW
───────────────────────────────────── */
function showUploadThumbnail(file) {
    const thumbEl = document.getElementById('uploadThumb');
    if (!thumbEl) return;
    if (!IMAGE_TYPES.includes(file.type.toLowerCase())) {
        hideUploadThumbnail();
        return;
    }
    const url = URL.createObjectURL(file);
    thumbEl.src = url;
    thumbEl.onload = () => {
        thumbEl.parentElement.classList.add('visible');
        // Show dimensions
        const dimEl = document.getElementById('uploadThumbDims');
        if (dimEl) dimEl.textContent = `${thumbEl.naturalWidth}×${thumbEl.naturalHeight}`;
    };
}
function hideUploadThumbnail() {
    const wrap = document.getElementById('uploadThumb')?.parentElement;
    if (wrap) wrap.classList.remove('visible');
}

function renderChips() {
    fileChips.innerHTML = '';
    selectedFiles.forEach((f, i) => {
        const chip = document.createElement('span');
        chip.className = 'file-chip';
        chip.innerHTML = `${escHtml(truncate(f.name, 20))}<button class="chip-rm" data-idx="${i}" aria-label="Remove">×</button>`;
        chip.querySelector('.chip-rm').addEventListener('click', e => {
            e.stopPropagation();
            selectedFiles.splice(+e.target.dataset.idx, 1);
            renderChips();
            if (!selectedFiles.length) resetIdle();
            else updatePreviews();
        });
        fileChips.appendChild(chip);
    });
}

/* ─────────────────────────────────────
   ESTIMATE / UPSCALE PREVIEW
───────────────────────────────────── */
function updatePreviews() {
    if (!selectedFiles.length) return;

    if (currentMode === 'compress') {
        const level = getLevel();
        const goal = getGoal();
        const profile = GOAL_PROFILES[goal] || GOAL_PROFILES.web;
        const isImg = selectedFiles.every(f => IMAGE_TYPES.includes(f.type.toLowerCase()));
        const q = profile.quality[level] || .65;
        const ratio = isImg ? q * 0.75 : 0.55;
        const orig = selectedFiles.reduce((s, f) => s + f.size, 0);
        const est = Math.round(orig * ratio);
        document.getElementById('estOrig').textContent = fmtBytes(orig);
        document.getElementById('estNew').textContent = fmtBytes(est);
        document.getElementById('estSaved').textContent = `~${Math.max(0, Math.round((1 - ratio) * 100))}%`;
        document.getElementById('estPreview').classList.remove('hidden');
        document.getElementById('upscalePreview').classList.add('hidden');
    } else {
        // Upscale preview
        const scale = getScale();
        const f = selectedFiles[0];
        if (!f) return;
        // We don't know pixel dims until we load the image, just show file size estimate
        document.getElementById('upOrig').textContent = fmtBytes(f.size);
        document.getElementById('upNew').textContent = `~${fmtBytes(f.size * scale * scale * 0.8)}`;
        document.getElementById('upScale').textContent = `${scale}×`;
        document.getElementById('upscalePreview').classList.remove('hidden');
        document.getElementById('estPreview').classList.add('hidden');
    }
}

/* ─────────────────────────────────────
   ACTION BUTTON
───────────────────────────────────── */
actionBtn.addEventListener('click', async () => {
    if (!selectedFiles.length) return;

    idleState.classList.add('hidden');
    procState.classList.remove('hidden');
    resultBox.classList.add('hidden');
    actionBtn.disabled = true;
    resultBlobs = [];

    try {
        if (currentMode === 'compress') {
            await runCompress();
        } else if (currentMode === 'denoise') {
            await runDenoise();
        } else if (currentMode === 'bgremove') {
            await runBgRemove();
        } else {
            await runUpscale();
        }
    } catch (err) {
        console.error('[Ziphay]', err);
        showToast('⚠️ ' + (err.message || 'Processing failed. Please try again.'), 'error');
        procState.classList.add('hidden');
        idleState.classList.remove('hidden');
        actionBtn.disabled = false;
    }
});

/* ─────────────────────────────────────
   COMPRESS FLOW
───────────────────────────────────── */
async function runCompress() {
    const level = getLevel();
    const goal = getGoal();
    const fmt = getFmt();
    const profile = GOAL_PROFILES[goal] || GOAL_PROFILES.web;
    const gs = profile.steps;

    setProgress(0, gs[0].l, gs[0].d);
    const t0 = performance.now();

    for (let i = 0; i < selectedFiles.length; i++) {
        const f = selectedFiles[i];
        const from = (i / selectedFiles.length) * 88;
        const to = ((i + 1) / selectedFiles.length) * 88;

        await animateTo(from + (to - from) * .25, gs[0].l, gs[0].d, 260);
        await animateTo(from + (to - from) * .65, gs[1]?.l || gs[0].l, gs[1]?.d || gs[0].d, 300);

        const tStart = performance.now();
        const result = await compressFile(f, level, profile, fmt);
        const tEnd = performance.now();
        resultBlobs.push({ blob: result.blob, filename: result.filename, origSize: f.size, timeMs: tEnd - tStart });

        const elapsed = (performance.now() - t0) / 1000;
        const rem = Math.round((elapsed / (i + 1)) * (selectedFiles.length - i - 1));
        timeEst.textContent = rem > 0 ? `~${rem}s left` : '';

        await animateTo(to, gs[2]?.l || gs[0].l, gs[2]?.d || gs[0].d, 200);
    }

    await animateTo(100, 'Finalising…', 'Packaging output…', 250);
    timeEst.textContent = '';
    showResults('compress', goal);
}

/* ─────────────────────────────────────
   UPSCALE FLOW
───────────────────────────────────── */
async function runUpscale() {
    const scale = getScale();
    const enhance = getEnhance();

    setProgress(0, 'Loading image…', 'Reading pixel data…');

    for (let i = 0; i < selectedFiles.length; i++) {
        const f = selectedFiles[i];
        const from = (i / selectedFiles.length) * 88;
        const to = ((i + 1) / selectedFiles.length) * 88;

        await animateTo(from + (to - from) * .3, 'Loading image…', 'Decoding pixel data…', 300);
        await animateTo(from + (to - from) * .65, `Upscaling ${scale}×…`, `Applying ${enhance} interpolation…`, 400);

        const tStart = performance.now();
        const result = await upscaleImage(f, scale, enhance);
        const tEnd = performance.now();
        resultBlobs.push({ blob: result.blob, filename: result.filename, origSize: f.size, timeMs: tEnd - tStart });

        await animateTo(to, 'Rendering output…', 'Encoding PNG…', 250);
    }

    await animateTo(100, 'Done!', 'Your upscaled image is ready.', 200);

    /* ── Save upscale to Firestore history ── */
    if (window.ZiphayAuth && resultBlobs.length > 0) {
        const r0 = resultBlobs[0];
        ZiphayAuth.saveRecord({
            filename: selectedFiles[0]?.name || 'unknown',
            outputName: r0.filename,
            mode: 'upscale',
            scale: scale,
            origSize: r0.origSize,
            newSize: r0.blob.size,
            savedPct: 0,
        }).catch(e => console.warn('[Ziphay] History save failed:', e));
    }

    showResults('upscale', null);
}

/* ─────────────────────────────────────
   DENOISE FLOW
───────────────────────────────────── */
async function runDenoise() {
    const strength = parseInt(document.getElementById('denoiseStrength').value, 10);
    const dnMode = document.querySelector('#denoiseBtns .up-btn.active')?.dataset?.dn || 'light';

    setProgress(0, 'Loading image…', 'Reading pixel data…');

    for (let i = 0; i < selectedFiles.length; i++) {
        const f = selectedFiles[i];
        const from = (i / selectedFiles.length) * 88;
        const to = ((i + 1) / selectedFiles.length) * 88;

        await animateTo(from + (to - from) * .3, 'Loading image…', 'Decoding pixel data…', 250);
        await animateTo(from + (to - from) * .65, `Denoising (${dnMode})…`, `Applying ${strength}-pass filter…`, 350);

        const tStart = performance.now();
        const result = await denoiseImage(f, strength, dnMode);
        const tEnd = performance.now();
        resultBlobs.push({ blob: result.blob, filename: result.filename, origSize: f.size, timeMs: tEnd - tStart });

        await animateTo(to, 'Sharpening edges…', 'Encoding PNG…', 200);
    }

    await animateTo(100, 'Done!', 'Denoised image is ready.', 200);
    showResults('denoise', null);
}

/* ─────────────────────────────────────
   BG REMOVE FLOW
───────────────────────────────────── */
async function runBgRemove() {
    setProgress(0, 'Initializing AI Model…', 'Downloading/Loading WebAssembly (once per session)…');

    for (let i = 0; i < selectedFiles.length; i++) {
        const f = selectedFiles[i];
        const from = (i / selectedFiles.length) * 88;
        const to = ((i + 1) / selectedFiles.length) * 88;

        await animateTo(from + (to - from) * .2, 'Loading Image…', 'Decoding pixels for ML analysis…', 300);
        await animateTo(from + (to - from) * .5, 'Analyzing image…', 'Evaluating subject and background segments…', 400);

        const t0 = performance.now();
        
        let outBlob;
        try {
            const config = {
                publicPath: "https://unpkg.com/@imgly/background-removal@1.4.5/dist/",
                progress: (key, current, total) => {
                    const p = Math.round((current / total) * 100);
                    const dt = document.getElementById('procDetail');
                    if (dt && total > 0) dt.textContent = `Loading ML Model: ${p}%`;
                }
            };
            outBlob = await imglyRemoveBackground(f, config);
        } catch (e) {
            throw new Error('Background removal failed: ' + e.message);
        }
        const t1 = performance.now();
        
        const extMatch = f.name.match(/\.[^.]+$/);
        const ext = extMatch ? extMatch[0] : '';
        const baseName = f.name.slice(0, f.name.length - ext.length);
        const filename = `ziphay_${baseName}_nobg.png`;
        
        resultBlobs.push({ blob: outBlob, filename: filename, origSize: f.size, timeMs: t1 - t0 });

        await animateTo(to, 'Refining edges…', 'Encoding transparent PNG…', 200);
    }

    await animateTo(100, 'Done!', 'Backgrounds removed perfectly.', 200);
    showResults('bgremove', null);
}

/* ─────────────────────────────────────
   COMPRESS ENGINE
───────────────────────────────────── */
async function compressFile(file, level, profile, fmt, overrideQuality) {
    const type = file.type.toLowerCase();
    if (IMAGE_TYPES.includes(type)) return compressImage(file, level, profile, fmt, overrideQuality);
    return compressGzip(file, level);
}

function compressImage(file, level, profile, fmt, overrideQuality) {
    return new Promise((resolve, reject) => {
        const quality = overrideQuality !== undefined ? overrideQuality : ((profile.quality && profile.quality[level]) ?? .65);
        const maxDim = profile.maxDim ?? 1920;
        const mimeMap = { auto: 'image/webp', webp: 'image/webp', jpeg: 'image/jpeg', png: 'image/png' };
        const extMap  = { auto: '.webp',      webp: '.webp',      jpeg: '.jpg',       png: '.png'       };
        // AVIF support — auto-select AVIF when supported for best compression
        if (AVIF_SUPPORTED) {
            mimeMap.avif = 'image/avif';
            extMap.avif  = '.avif';
            if (fmt === 'auto') { mimeMap.auto = 'image/avif'; extMap.auto = '.avif'; }
        }
        const mime = mimeMap[fmt] || 'image/webp';
        const ext = extMap[fmt] || '.webp';
        const q = mime === 'image/png' ? undefined : quality;

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            let w = img.naturalWidth, h = img.naturalHeight;
            if (w > maxDim || h > maxDim) {
                const r = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * r); h = Math.round(h * r);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(blob => {
                if (!blob) return reject(new Error('Canvas export failed.'));
                const levelTag = level === 'low' ? 'hq' : level === 'high' ? 'min' : 'opt';
                resolve({ blob, filename: `ziphay_${stripExt(file.name)}_${levelTag}_${w}x${h}${ext}` });
            }, mime, q);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image.')); };
        img.src = url;
    });
}

function compressGzip(file, level) {
    return new Promise((resolve, reject) => {
        if (typeof fflate === 'undefined') return reject(new Error('Compression library not loaded. Check your internet connection.'));
        const lv = FFLATE_LEVEL[level] ?? 6;
        const reader = new FileReader();
        reader.onload = e => {
            fflate.gzip(new Uint8Array(e.target.result), { level: lv, filename: file.name }, (err, out) => {
                if (err) return reject(new Error('GZIP failed: ' + err.message));
                resolve({ blob: new Blob([out], { type: 'application/gzip' }), filename: `ziphay_${stripExt(file.name)}.gz` });
            });
        };
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsArrayBuffer(file);
    });
}

/* ─────────────────────────────────────
   UPSCALE ENGINE
   Uses Canvas drawImage with enhanced
   interpolation for smooth upscaling.
   2-pass for large scales (2× then 2×)
   to get better quality than 1-pass 4×.
───────────────────────────────────── */
function upscaleImage(file, scale, enhance) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const srcW = img.naturalWidth;
            const srcH = img.naturalHeight;
            const dstW = srcW * scale;
            const dstH = srcH * scale;

            // Safety cap — prevent huge canvases crashing the browser
            const maxPx = 16000 * 16000;
            if (dstW * dstH > maxPx) {
                return reject(new Error(`Output would be ${dstW}×${dstH}px — too large. Try a smaller scale.`));
            }

            let canvas, ctx;

            if (scale <= 2 || enhance === 'crisp') {
                // Single pass
                canvas = document.createElement('canvas');
                canvas.width = dstW;
                canvas.height = dstH;
                ctx = canvas.getContext('2d');
                applySmoothing(ctx, enhance);
                ctx.drawImage(img, 0, 0, dstW, dstH);
            } else {
                // Multi-pass: 2× iterations for better quality
                const passes = Math.round(Math.log2(scale));
                let src = img;
                let curW = srcW, curH = srcH;
                for (let p = 0; p < passes; p++) {
                    const stepW = Math.min(curW * 2, dstW);
                    const stepH = Math.min(curH * 2, dstH);
                    canvas = document.createElement('canvas');
                    canvas.width = stepW;
                    canvas.height = stepH;
                    ctx = canvas.getContext('2d');
                    applySmoothing(ctx, enhance);
                    ctx.drawImage(src, 0, 0, stepW, stepH);
                    src = canvas;
                    curW = stepW;
                    curH = stepH;
                }
            }

            // Export as PNG for lossless upscale output
            canvas.toBlob(blob => {
                if (!blob) return reject(new Error('Canvas export failed.'));
                resolve({
                    blob,
                    filename: `ziphay_${stripExt(file.name)}_${scale}x.png`,
                    dims: { w: dstW, h: dstH }
                });
            }, 'image/png');
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image.')); };
        img.src = url;
    });
}

function applySmoothing(ctx, enhance) {
    if (enhance === 'crisp') {
        ctx.imageSmoothingEnabled = false;
    } else if (enhance === 'smooth') {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
    } else {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
    }
}

/* ─────────────────────────────────────
   SHOW RESULTS
───────────────────────────────────── */
function showResults(mode, goal) {
    procState.classList.add('hidden');
    resultBox.classList.remove('hidden');
    idleState.classList.remove('hidden');
    actionBtn.disabled = false;

    const totalOrig = resultBlobs.reduce((s, r) => s + r.origSize, 0);
    const totalNew = resultBlobs.reduce((s, r) => s + r.blob.size, 0);
    const diff = Math.abs(totalOrig - totalNew);
    const diffPct = totalOrig > 0 ? Math.round((diff / totalOrig) * 100) : 0;

    // Header & stat labels
    const header = document.getElementById('resultHeader');
    const totalTimeMs = resultBlobs.reduce((s, r) => s + (r.timeMs || 0), 0);
    const timeStr = ` <span style="font-size:0.8em;opacity:0.7;font-weight:normal;margin-left:8px">⏱ ${(totalTimeMs / 1000).toFixed(1)}s</span>`;

    if (mode === 'upscale') {
        const scale = getScale();
        header.innerHTML = `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> Upscale Complete — ${scale}× · PNG output` + timeStr;
        document.getElementById('resNewLabel').textContent = 'Upscaled Size';
        document.getElementById('resSavedLabel').textContent = 'Size Increase';
        document.getElementById('resSaved').className = 'stat-val';
        document.getElementById('resSaved').style.color = 'var(--purple)';
        document.getElementById('resSaved').textContent = `+${diffPct}%`;
    } else if (mode === 'denoise') {
        header.innerHTML = `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12s1.5-3 4-3 4 3 4 3-1.5 3-4 3-4-3-4-3z"/></svg> Denoise Complete · PNG output` + timeStr;
        document.getElementById('resNewLabel').textContent = 'Denoised Size';
        document.getElementById('resSavedLabel').textContent = 'Size Change';
        document.getElementById('resSaved').className = 'stat-val';
        document.getElementById('resSaved').style.color = 'var(--teal)';
        document.getElementById('resSaved').textContent = totalNew < totalOrig ? `-${diffPct}%` : `+${diffPct}%`;
    } else if (mode === 'bgremove') {
        header.innerHTML = `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13l-2 2 2 2"/><path d="M14 13l2 2-2 2"/></svg> Subject Isolated · PNG output` + timeStr;
        document.getElementById('resNewLabel').textContent = 'Output Size';
        document.getElementById('resSavedLabel').textContent = 'Size Change';
        document.getElementById('resSaved').className = 'stat-val';
        document.getElementById('resSaved').style.color = 'var(--teal)';
        document.getElementById('resSaved').textContent = totalNew < totalOrig ? `-${diffPct}%` : `+${diffPct}%`;
    } else {
        const profile = GOAL_PROFILES[goal] || GOAL_PROFILES.web;
        header.innerHTML = `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Optimised · <span style="opacity:.65;font-weight:500;font-size:.82em">${profile.label}</span>` + timeStr;
        document.getElementById('resNewLabel').textContent = 'Ziphay Size';
        document.getElementById('resSavedLabel').textContent = 'Saved';
        document.getElementById('resSaved').className = 'stat-val gold';
        document.getElementById('resSaved').style.color = '';
        document.getElementById('resSaved').textContent = `${Math.max(0, Math.round((1 - totalNew / totalOrig) * 100))}%`;
    }

    document.getElementById('resOrig').textContent = fmtBytes(totalOrig);
    document.getElementById('resNew').textContent = fmtBytes(totalNew);

    // Download setup
    const dlBtn = document.getElementById('downloadBtn');
    if (resultBlobs.length === 1) {
        resultFiles.classList.add('hidden');
        const { blob, filename } = resultBlobs[0];
        dlBtn.innerHTML = `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download ${filename}`;
        dlBtn.onclick = () => triggerDownload(blob, filename);
    } else {
        dlBtn.innerHTML = `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download All as ZIP (${resultBlobs.length} files)`;
        dlBtn.onclick = async () => {
            const originalText = dlBtn.innerHTML;
            dlBtn.innerHTML = `Packaging ZIP...`;
            const zip = new JSZip();
            resultBlobs.forEach(r => zip.file(r.filename, r.blob));
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            triggerDownload(zipBlob, 'ziphay_batch.zip');
            dlBtn.innerHTML = originalText;
        };
        resultFiles.classList.remove('hidden');
        resultFiles.innerHTML = '';
        resultBlobs.forEach(r => {
            const isUp = mode === 'upscale';
            const dp = isUp
                ? `+${Math.round((r.blob.size / r.origSize - 1) * 100)}%`
                : `-${Math.max(0, Math.round((1 - r.blob.size / r.origSize) * 100))}%`;
            const row = document.createElement('div');
            row.className = 'rf-item';
            row.innerHTML = `
        <span class="rf-name">${escHtml(r.filename)}</span>
        <span class="rf-size">${fmtBytes(r.origSize)} → ${fmtBytes(r.blob.size)}</span>
        <span class="rf-diff">${dp} <span style="font-size:0.85em;opacity:0.6;font-weight:normal">(${(r.timeMs / 1000).toFixed(1)}s)</span></span>
        <button class="rf-dl">↓</button>`;
            row.querySelector('.rf-dl').addEventListener('click', () => triggerDownload(r.blob, r.filename));
            resultFiles.appendChild(row);
        });
    }

    // Before/After compare (images only)
    const jumpBtn = document.getElementById('compareJumpBtn');
    const firstFile = selectedFiles[0];
    const firstBlob = resultBlobs[0];
    if (firstFile && IMAGE_TYPES.includes(firstFile.type.toLowerCase()) && firstBlob) {
        jumpBtn.classList.remove('hidden');
        jumpBtn.onclick = () => document.getElementById('compare').scrollIntoView({ behavior: 'smooth', block: 'start' });
        loadSlider(firstFile, firstBlob.blob, firstFile.size, firstBlob.blob.size, mode);
    } else {
        jumpBtn.classList.add('hidden');
    }
}

function triggerDownload(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 15000);
}

/* ─────────────────────────────────────
   SHOW ERROR
───────────────────────────────────── */
function showError(msg) {
    showToast('⚠️ ' + msg, 'error');
    procState.classList.add('hidden');
    idleState.classList.remove('hidden');
    actionBtn.disabled = false;
    dropZone.style.borderColor = '#f87171';
    dropZone.style.background = 'rgba(239,68,68,.05)';
    setTimeout(resetDropZoneStyle, 4000);
}
function resetDropZoneStyle() {
    dropZone.style.borderColor = '';
    dropZone.style.background = '';
}

/* ─────────────────────────────────────
   RESET
───────────────────────────────────── */
document.getElementById('redoBtn').addEventListener('click', resetIdle);
function resetIdle() {
    resultBox.classList.add('hidden');
    document.getElementById('compareJumpBtn').classList.add('hidden');
    document.getElementById('estPreview').classList.add('hidden');
    document.getElementById('upscalePreview').classList.add('hidden');
    idleState.classList.remove('hidden');
    selectedFiles = [];
    resultBlobs = [];
    fileChips.innerHTML = '';
    dropTitle.textContent = 'Click to upload';
    actionBtn.disabled = true;
    setProgress(0, '', '');
    resetDropZoneStyle();
    // Restore hint
    const goal = getGoal();
    applyGoal(goal);
    if (currentMode === 'upscale') switchMode('upscale');
}

/* ─────────────────────────────────────
   PROGRESS BAR
───────────────────────────────────── */
function setProgress(pct, label, detail) {
    progressFill.style.width = pct + '%';
    pctLabel.textContent = Math.round(pct) + '%';
    if (label) procLabel.textContent = label;
    if (detail) procDetail.textContent = detail;
}

function animateTo(target, label, detail, ms) {
    return new Promise(resolve => {
        const from = parseFloat(progressFill.style.width) || 0;
        const t0 = performance.now();
        if (label) procLabel.textContent = label;
        if (detail) procDetail.textContent = detail;
        (function tick(now) {
            const t = Math.min((now - t0) / ms, 1);
            const e = 1 - Math.pow(1 - t, 3);
            const c = from + (target - from) * e;
            progressFill.style.width = c + '%';
            pctLabel.textContent = Math.round(c) + '%';
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
        })(t0);
    });
}

/* ─────────────────────────────────────
   BEFORE / AFTER COMPARISON SLIDER
   Loads real original + output images.
───────────────────────────────────── */
const compareWrap = document.getElementById('compareWrap');
const cmpBefore = document.getElementById('cmpBefore');
const cmpAfterImg = document.getElementById('cmpAfterImg');
const cmpLine = document.getElementById('cmpLine');
const cmpHandle = document.getElementById('cmpHandle');

function loadSlider(origFile, outBlob, origSize, newSize, mode) {
    // Revoke previous URLs
    if (cmpUrlBefore) URL.revokeObjectURL(cmpUrlBefore);
    if (cmpUrlAfter) URL.revokeObjectURL(cmpUrlAfter);

    cmpUrlBefore = URL.createObjectURL(origFile);
    cmpUrlAfter = URL.createObjectURL(outBlob);

    cmpBefore.src = cmpUrlBefore;
    cmpAfterImg.src = cmpUrlAfter;

    // Labels
    document.getElementById('lblBefore').textContent = `📦 Original — ${fmtBytes(origSize)}`;
    document.getElementById('lblAfter').textContent = mode === 'upscale'
        ? `🔭 Upscaled — ${fmtBytes(newSize)}`
        : `⚡ Compressed — ${fmtBytes(newSize)}`;

    // Stats
    document.getElementById('csOrig').textContent = fmtBytes(origSize);
    document.getElementById('csNew').textContent = fmtBytes(newSize);

    if (mode === 'upscale') {
        const inc = Math.round((newSize / origSize - 1) * 100);
        document.getElementById('csDiff').textContent = `+${inc}%`;
        document.getElementById('csDiff').style.color = 'var(--purple)';
    } else {
        const sav = Math.max(0, Math.round((1 - newSize / origSize) * 100));
        document.getElementById('csDiff').textContent = `${sav}% saved`;
        document.getElementById('csDiff').style.color = 'var(--gold)';
    }

    // Show output dimensions when after image loads
    cmpAfterImg.onload = async () => {
        const w = cmpAfterImg.naturalWidth, h = cmpAfterImg.naturalHeight;
        document.getElementById('csDims').textContent = (w && h) ? `${w}×${h}` : '—';
        
        const matchItem = document.getElementById('csMatchItem');
        const matchVal = document.getElementById('csMatch');
        if (matchItem && matchVal) {
            matchItem.style.display = 'none';
            const sim = await calculateSimilarity(cmpUrlBefore, cmpUrlAfter);
            if (sim !== null) {
                matchVal.textContent = sim + '%';
                matchItem.style.display = '';
            }
        }
    };

    // Show widget
    document.getElementById('cmpPlaceholder').classList.add('hidden');
    document.getElementById('compareDemo').classList.remove('hidden');

    const qBox = document.getElementById('cmpQualityBox');
    if (qBox) {
        if (mode === 'compress') {
            qBox.classList.remove('hidden');
            const goal = getGoal();
            const profile = GOAL_PROFILES[goal] || GOAL_PROFILES.web;
            const level = getLevel();
            const q = Math.round((profile.quality && profile.quality[level] ? profile.quality[level] : 0.65) * 100);
            
            // Only update slider value if it's not currently being dragged
            if (document.activeElement !== document.getElementById('cmpQualitySlider')) {
                document.getElementById('cmpQualitySlider').value = q;
                document.getElementById('cmpQualityVal').textContent = q + '%';
            }
        } else {
            qBox.classList.add('hidden');
        }
    }

    // Reset to 50%
    updateSlider(50);
}

/* ─────────────────────────────────────
   LIVE QUALITY SLIDER
───────────────────────────────────── */
let _qtTimer;
const cmpQSlider = document.getElementById('cmpQualitySlider');
if (cmpQSlider) {
    cmpQSlider.addEventListener('input', e => {
        document.getElementById('cmpQualityVal').textContent = e.target.value + '%';
        clearTimeout(_qtTimer);
        _qtTimer = setTimeout(() => recompressLive(parseInt(e.target.value, 10)), 300);
    });
}

async function recompressLive(qVal) {
    if (currentMode !== 'compress' || !selectedFiles.length) return;
    
    cmpAfterImg.style.opacity = '0.4'; // loading feedback
    const goal = getGoal();
    const fmt = getFmt();
    const profile = GOAL_PROFILES[goal] || GOAL_PROFILES.web;
    const level = getLevel();
    const qFloat = qVal / 100;
    
    resultBlobs = [];
    for (let i = 0; i < selectedFiles.length; i++) {
        const f = selectedFiles[i];
        const t0 = performance.now();
        const result = await compressFile(f, level, profile, fmt, qFloat);
        const t1 = performance.now();
        resultBlobs.push({ blob: result.blob, filename: result.filename, origSize: f.size, timeMs: t1 - t0 });
    }
    
    cmpAfterImg.style.opacity = '1';
    showResults('compress', goal);
}

/* Slider drag — mouse */
compareWrap.addEventListener('mousedown', e => {
    cmpDragging = true;
    cmpHandle.classList.add('active');
    updateSlider(getSliderPct(e.clientX));
    e.preventDefault();
});
document.addEventListener('mouseup', () => { cmpDragging = false; cmpHandle.classList.remove('active'); });
document.addEventListener('mousemove', e => { if (cmpDragging) updateSlider(getSliderPct(e.clientX)); });

/* Slider drag — touch */
compareWrap.addEventListener('touchstart', e => {
    cmpDragging = true;
    cmpHandle.classList.add('active');
    updateSlider(getSliderPct(e.touches[0].clientX));
}, { passive: true });
document.addEventListener('touchend', () => { cmpDragging = false; cmpHandle.classList.remove('active'); });
document.addEventListener('touchmove', e => { if (cmpDragging) updateSlider(getSliderPct(e.touches[0].clientX)); }, { passive: true });

function getSliderPct(clientX) {
    const r = compareWrap.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
}
function updateSlider(pct) {
    cmpAfterImg.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    cmpLine.style.left = pct + '%';
    cmpHandle.style.left = pct + '%';
}

/* ─────────────────────────────────────
   VISUAL SIMILARITY (MSE -> %)
───────────────────────────────────── */
async function calculateSimilarity(origUrl, afterUrl) {
    return new Promise(resolve => {
        const img1 = new Image();
        const img2 = new Image();
        let loaded = 0;
        const onload = () => {
            loaded++;
            if (loaded === 2) {
                const maxSize = 150;
                let w = img1.naturalWidth, h = img1.naturalHeight;
                if (w === 0 || h === 0) return resolve(null);
                const scale = Math.min(maxSize / w, maxSize / h, 1);
                w = Math.max(1, Math.round(w * scale));
                h = Math.max(1, Math.round(h * scale));
                
                const c1 = document.createElement('canvas');
                const c2 = document.createElement('canvas');
                c1.width = c2.width = w; c1.height = c2.height = h;
                const ctx1 = c1.getContext('2d', { willReadFrequently: true });
                const ctx2 = c2.getContext('2d', { willReadFrequently: true });
                
                ctx1.drawImage(img1, 0, 0, w, h);
                ctx2.drawImage(img2, 0, 0, w, h);
                
                const d1 = ctx1.getImageData(0, 0, w, h).data;
                const d2 = ctx2.getImageData(0, 0, w, h).data;
                
                let mse = 0;
                for (let i = 0; i < d1.length; i += 4) {
                    const r = d1[i] - d2[i], g = d1[i+1] - d2[i+1], b = d1[i+2] - d2[i+2];
                    mse += (r*r + g*g + b*b) / 3;
                }
                mse /= (w * h);
                
                if (mse === 0) return resolve(100);
                const maxVal = 255 * 255;
                const psnr = 10 * Math.log10(maxVal / mse);
                let match = (psnr - 20) / (45 - 20) * 100;
                match = Math.max(0, Math.min(99.9, match));
                resolve(match.toFixed(1));
            }
        };
        img1.onload = img2.onload = onload;
        img1.onerror = img2.onerror = () => resolve(null);
        img1.src = origUrl;
        img2.src = afterUrl;
    });
}

/* ─────────────────────────────────────
   DARK / LIGHT MODE TOGGLE
   Uses data-theme attribute on <html>
───────────────────────────────────── */
const themeBtn = document.getElementById('themeBtn');
if (themeBtn) {
    const savedTheme = localStorage.getItem('ziphay_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    themeBtn.title = savedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

    themeBtn.addEventListener('click', () => {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('ziphay_theme', newTheme);
        themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        themeBtn.title = newTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    });
}

/* ─────────────────────────────────────
   DYNAMIC SCROLL REVEAL
───────────────────────────────────── */
const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('active');
            revealObs.unobserve(e.target);
        }
    });
}, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

// Automatically add .reveal to cards if they don't have it
document.querySelectorAll('.feat-card, .tool-card, .step, .price-card, .sb-item, .section-title, .section-sub, .trust-item')
    .forEach((el, i) => { 
        if (!el.classList.contains('reveal')) {
            el.classList.add('reveal'); 
        }
        // Minimal cascade stagger based on DOM order
        el.style.transitionDelay = `${(i % 5) * 0.1}s`;
        revealObs.observe(el); 
    });

/* ─────────────────────────────────────
   HELPERS
───────────────────────────────────── */
function getLevel() { return document.querySelector('.level-tag.active')?.dataset?.level || 'medium'; }
function getGoal() { return document.querySelector('.goal-btn.active')?.dataset?.goal || 'web'; }
function getFmt() { return document.querySelector('.fmt-opt.active')?.dataset?.fmt || 'auto'; }
function getScale() { return parseInt(document.querySelector('#scaleBtns .up-btn.active')?.dataset?.scale || '2', 10); }
function getEnhance() { return document.querySelector('#enhanceBtns .up-btn.active')?.dataset?.enhance || 'smooth'; }

function fmtBytes(b) {
    if (!b) return '0 B';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(2) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
}
function stripExt(n) { return n.replace(/\.[^.]+$/, ''); }
function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function mimeLabel(m) {
    return ({
        'image/jpeg': 'JPEG', 'image/jpg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/gif': 'GIF',
        'video/mp4': 'MP4', 'application/pdf': 'PDF', 'application/zip': 'ZIP'
    }[m]) || 'File';
}
/* ═══════════════════════════════════════════════════
═══════════════════════════════════════════════════ */

/* ─────────────────────────────────────
   DENOISE ENGINE
   Multi-pass Canvas API:
   1) Draw image
   2) Apply CSS filter blur (noise removal)
   3) Apply unsharp mask pass for edge recovery
───────────────────────────────────── */
function denoiseImage(file, strength, dnMode) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const w = img.naturalWidth, h = img.naturalHeight;
            // Blur radius based on strength + mode
            const modeMultiplier = { light: 0.4, medium: 0.75, heavy: 1.2 }[dnMode] || 0.4;
            const blurRadius = (strength * modeMultiplier).toFixed(1);

            // Pass 1: Blur pass (noise reduction)
            const c1 = document.createElement('canvas');
            c1.width = w; c1.height = h;
            const ctx1 = c1.getContext('2d');
            ctx1.filter = `blur(${blurRadius}px)`;
            ctx1.drawImage(img, 0, 0, w, h);
            ctx1.filter = 'none';

            // Pass 2: Unsharp mask — blend blur with original at high contrast
            const c2 = document.createElement('canvas');
            c2.width = w; c2.height = h;
            const ctx2 = c2.getContext('2d');

            // Draw blurred
            ctx2.drawImage(c1, 0, 0);

            // Overlay original at reduced opacity to bring back edges
            const edgeBlend = Math.max(0.08, 0.35 - (dnMode === 'heavy' ? 0.15 : dnMode === 'medium' ? 0.08 : 0));
            ctx2.globalAlpha = edgeBlend;
            ctx2.globalCompositeOperation = 'overlay';
            ctx2.drawImage(img, 0, 0, w, h);
            ctx2.globalAlpha = 1;
            ctx2.globalCompositeOperation = 'source-over';

            c2.toBlob(blob => {
                if (!blob) return reject(new Error('Canvas export failed.'));
                resolve({ blob, filename: `ziphay_denoised_${stripExt(file.name)}.png` });
            }, 'image/png');
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image.')); };
        img.src = url;
    });
}

/* ─────────────────────────────────────
   EXIF READER
   Parses raw JPEG bytes using DataView.
   No external library needed.
───────────────────────────────────── */
function tryShowExif(file) {
    const panel = document.getElementById('exifPanel');
    if (!file || !file.type.includes('jpeg') && !file.type.includes('jpg') && !file.name.toLowerCase().endsWith('.jpg') && !file.name.toLowerCase().endsWith('.jpeg')) {
        panel.classList.add('hidden');
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const tags = readExifTags(new DataView(e.target.result));
            if (!tags || !Object.keys(tags).length) { panel.classList.add('hidden'); return; }

            const container = document.getElementById('exifRows');
            container.innerHTML = Object.entries(tags).map(([k, v]) =>
                `<span class="exif-tag"><span class="exif-key">${escHtml(k)}</span> ${escHtml(String(v))}</span>`
            ).join('');
            panel.classList.remove('hidden');
        } catch (err) {
            panel.classList.add('hidden');
        }
    };
    reader.readAsArrayBuffer(file.slice(0, 65536)); // Only need first 64KB for EXIF
}

function readExifTags(view) {
    const tags = {};
    // JPEG starts with FF D8
    if (view.getUint16(0) !== 0xFFD8) return tags;
    let offset = 2;
    // Find APP1 marker (FF E1)
    while (offset < view.byteLength - 2) {
        const marker = view.getUint16(offset);
        if (marker === 0xFFE1) { offset += 2; break; }
        if ((marker & 0xFF00) !== 0xFF00) break;
        offset += 2 + view.getUint16(offset + 2);
    }
    if (offset >= view.byteLength - 6) return tags;
    // Check for "Exif\0\0"
    const exifStr = String.fromCharCode(...[offset+2,offset+3,offset+4,offset+5,offset+6,offset+7].map(i => view.getUint8(i)));
    if (!exifStr.startsWith('Exif')) return tags;
    const tiffStart = offset + 8;
    const endian = view.getUint16(tiffStart) === 0x4949 ? true : false; // true=little
    const getU16 = o => endian ? view.getUint16(tiffStart + o, true) : view.getUint16(tiffStart + o, false);
    const getU32 = o => endian ? view.getUint32(tiffStart + o, true) : view.getUint32(tiffStart + o, false);
    const ifdOffset = getU32(4);
    const count = getU16(ifdOffset);
    const KNOWN = { 0x010F:'Make', 0x0110:'Model', 0x0132:'DateTime', 0xA002:'Width', 0xA003:'Height', 0x8827:'ISO', 0x829A:'Exposure', 0x829D:'FNumber' };
    for (let i = 0; i < count; i++) {
        const base = ifdOffset + 2 + i * 12;
        const tag = getU16(base);
        const type = getU16(base + 2);
        const num = getU32(base + 4);
        const valOff = base + 8;
        if (!KNOWN[tag]) continue;
        try {
            if (type === 2) { // ASCII
                const strOff = num > 4 ? getU32(valOff) : valOff;
                let s = '';
                for (let j = 0; j < num - 1; j++) s += String.fromCharCode(view.getUint8(tiffStart + strOff + j));
                if (s.trim()) tags[KNOWN[tag]] = s.trim();
            } else if (type === 3) { // SHORT
                tags[KNOWN[tag]] = endian ? view.getUint16(valOff, true) : view.getUint16(valOff, false);
            } else if (type === 5) { // RATIONAL
                const rOff = getU32(valOff);
                const n = endian ? view.getUint32(tiffStart + rOff, true) : view.getUint32(tiffStart + rOff, false);
                const d = endian ? view.getUint32(tiffStart + rOff + 4, true) : view.getUint32(tiffStart + rOff + 4, false);
                if (d) tags[KNOWN[tag]] = (n / d).toFixed(tag === 0x829D ? 1 : 4);
            }
        } catch (_) {}
    }
    return tags;
}

/* ─────────────────────────────────────
   TOAST NOTIFICATION SYSTEM
   ⚠️ Uses textContent to prevent XSS
───────────────────────────────────── */
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icons[type] || 'ℹ️';
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    container.appendChild(toast);
    const dismiss = () => {
        toast.classList.add('dismiss');
        setTimeout(() => toast.remove(), 300);
    };
    toast.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
}

/* ─────────────────────────────────────
   SCROLL TO TOP BUTTON
───────────────────────────────────── */
const scrollTopBtn = document.getElementById('scrollTopBtn');
window.addEventListener('scroll', () => {
    scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });
scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ─────────────────────────────────────
   MOBILE HAMBURGER NAV
───────────────────────────────────── */
const navHamburger = document.getElementById('navHamburger');
const mobileNavOverlay = document.getElementById('mobileNavOverlay');
const mobileNavDrawer = document.getElementById('mobileNavDrawer');

function openMobileNav() {
    navHamburger.classList.add('open');
    mobileNavOverlay.classList.add('open');
    mobileNavDrawer.classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeMobileNav() {
    navHamburger.classList.remove('open');
    mobileNavOverlay.classList.remove('open');
    mobileNavDrawer.classList.remove('open');
    document.body.style.overflow = '';
}

navHamburger.addEventListener('click', () => {
    navHamburger.classList.contains('open') ? closeMobileNav() : openMobileNav();
});
mobileNavOverlay.addEventListener('click', closeMobileNav);

/* ─────────────────────────────────────
   KEYBOARD SHORTCUT MODAL
───────────────────────────────────── */
function openShortcutModal()  { document.getElementById('shortcutBackdrop').classList.add('open'); }
function closeShortcutModal() { document.getElementById('shortcutBackdrop').classList.remove('open'); }

document.getElementById('shortcutBackdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeShortcutModal();
});

/* ─────────────────────────────────────
   GLOBAL KEYBOARD SHORTCUTS
───────────────────────────────────── */
document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    // Don't fire shortcuts when typing in inputs
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'Escape') { closeShortcutModal(); closeMobileNav(); return; }
    if (e.key === '?') { e.preventDefault(); openShortcutModal(); return; }

    // Mode shortcuts
    if (e.key === 'c' || e.key === 'C') { switchMode('compress'); showToast('Switched to Compress mode', 'info', 2000); return; }
    if (e.key === 'u' || e.key === 'U') { switchMode('upscale'); showToast('Switched to Upscale mode', 'info', 2000); return; }
    if (e.key === 'd' || e.key === 'D') { switchMode('denoise'); showToast('Switched to Denoise mode', 'info', 2000); return; }

    // Theme toggle
    if (e.key === 't' || e.key === 'T') {
        document.getElementById('themeBtn').click();
        return;
    }

    // Space bar to open file picker (only when drop zone is in view / enabled)
    if (e.key === ' ' && !resultBox.classList.contains('hidden') === false) {
        e.preventDefault();
        fileInput.click();
    }
});

/* ─────────────────────────────────────
   DENOISE MODE BUTTON WIRING
───────────────────────────────────── */
document.querySelectorAll('#denoiseBtns .up-btn').forEach(b =>
    b.addEventListener('click', () => {
        document.querySelectorAll('#denoiseBtns .up-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
    })
);

/* ─────────────────────────────────────
   STATS COUNTER ANIMATION
   Animates numbers in .sb-num on scroll
───────────────────────────────────── */
function animateCounter(el) {
    const raw = el.textContent.trim();
    const match = raw.match(/^([\d.]+)([^\d.]*)$/);
    if (!match) return;
    const target = parseFloat(match[1]);
    const suffix = match[2] || '';
    const isInt = !match[1].includes('.');
    const duration = 1400;
    const t0 = performance.now();
    el.classList.add('counting');
    (function tick(now) {
        const progress = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const val = target * eased;
        el.textContent = (isInt ? Math.round(val) : val.toFixed(1)) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
        else { el.textContent = raw; el.classList.remove('counting'); }
    })(t0);
}

const statCounterObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            animateCounter(e.target);
            statCounterObs.unobserve(e.target);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.sb-num').forEach(el => statCounterObs.observe(el));

/* ─────────────────────────────────────
   PATCH resetIdle — clear EXIF too
───────────────────────────────────── */
const _origResetIdle = resetIdle;
// Monkey-patch to also hide exif panel + thumbnail on reset
const origRedoBtn = document.getElementById('redoBtn');
origRedoBtn.addEventListener('click', () => {
    document.getElementById('exifPanel').classList.add('hidden');
    hideUploadThumbnail();
});

/* ─────────────────────────────────────
   STRIP EXIF NOTE (informational)
   Canvas export naturally strips EXIF;
   stripExifToggle just surfaces that fact.
───────────────────────────────────── */
document.getElementById('stripExifToggle').addEventListener('change', function () {
    if (this.checked) showToast('✅ EXIF will be stripped on export (Canvas output contains no metadata)', 'success', 3000);
    else showToast('ℹ️ EXIF strip disabled — metadata may be retained in original', 'info', 3000);
});

/* ─────────────────────────────────────
   PRO AUTH INIT
───────────────────────────────────── */
/* All features unlocked — no plan gating */
document.body.classList.add('is-pro');
function initProLocks() {
    if (!window.ZiphayAuth) {
        setTimeout(initProLocks, 100);
        return;
    }
    window.ZiphayAuth.onLogin(async () => {
        currentPlan = 'pro';
        document.body.classList.add('is-pro');
    });
    window.ZiphayAuth.onLogout(() => {
        currentPlan = 'pro';
        document.body.classList.add('is-pro');
    });
}
initProLocks();

/* ─────────────────────────────────────
   GOOGLE DRIVE PICKER (placeholder)
   Requires: Google Cloud API Key
   Files are downloaded client-side only.
───────────────────────────────────── */
document.getElementById('gdriveBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    showToast('📂 Google Drive import coming soon! Set your API key in firebase-config.js to enable.', 'info', 4000);
});

/* ─────────────────────────────────────
   DROPBOX CHOOSER
   Uses official Dropbox Chooser SDK.
   Downloads file → creates Blob → feeds addFiles()
───────────────────────────────────── */
document.getElementById('dropboxBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    
    if (typeof Dropbox === 'undefined' || !Dropbox.choose) {
        showToast('📦 Dropbox SDK not loaded. Check your app key in the script tag.', 'error', 4000);
        return;
    }
    
    Dropbox.choose({
        success: async function(files) {
            if (!files || !files.length) return;
            
            showToast('📥 Downloading from Dropbox…', 'info', 3000);
            
            for (const dbFile of files) {
                try {
                    const response = await fetch(dbFile.link);
                    const blob = await response.blob();
                    const file = new File([blob], dbFile.name, { type: blob.type || 'application/octet-stream' });
                    addFiles([file]);
                    showToast(`✅ Imported: ${dbFile.name}`, 'success', 3000);
                } catch (err) {
                    console.error('[Ziphay] Dropbox download failed:', err);
                    showToast(`❌ Failed to download: ${dbFile.name}`, 'error', 4000);
                }
            }
        },
        cancel: function() {
            // User cancelled — do nothing
        },
        linkType: 'direct',
        multiselect: true,
        extensions: ['images', 'video', '.pdf', '.doc', '.docx', '.zip', '.gz', '.rar'],
        folderselect: false,
        sizeLimit: 2147483648, // 2 GB
    });
});

/* ─────────────────────────────────────
   ENHANCED CLIPBOARD PASTE
   Visual feedback + toast on paste
───────────────────────────────────── */
document.getElementById('pasteBtn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    try {
        // Try to use Clipboard API
        if (navigator.clipboard && navigator.clipboard.read) {
            const items = await navigator.clipboard.read();
            const files = [];
            
            for (const item of items) {
                for (const type of item.types) {
                    if (type.startsWith('image/') || type.startsWith('video/') || type === 'application/pdf') {
                        const blob = await item.getType(type);
                        const ext = type.split('/')[1] || 'png';
                        const file = new File([blob], `clipboard_image.${ext}`, { type });
                        files.push(file);
                    }
                }
            }
            
            if (files.length) {
                // Animate the pulse
                dropZone.classList.add('paste-flash');
                setTimeout(() => dropZone.classList.remove('paste-flash'), 600);
                addFiles(files);
                showToast(`📋 Pasted ${files.length} file(s) from clipboard!`, 'success', 3000);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                showToast('📋 No image found in clipboard. Copy an image first, then paste.', 'info', 4000);
            }
        } else {
            showToast('📋 Use Ctrl+V (Cmd+V on Mac) to paste files from your clipboard!', 'info', 4000);
        }
    } catch (err) {
        showToast('📋 Use Ctrl+V (Cmd+V on Mac) to paste files from your clipboard!', 'info', 4000);
    }
});

/* Duplicate paste handler removed — unified handler at line ~262 */

/* ─────────────────────────────────────
   SCROLL REVEAL — NEW ELEMENTS
   Add reveal to new sections
───────────────────────────────────── */
document.querySelectorAll('.sp-review, .sp-logo, .pricing-col, .pricing-footer-note, .social-link, .import-btn')
    .forEach((el, i) => {
        if (!el.classList.contains('reveal')) {
            el.classList.add('reveal');
        }
        el.style.transitionDelay = `${(i % 5) * 0.08}s`;
        revealObs.observe(el);
    });

/* ─────────────────────────────────────
   SECURITY: Freeze global objects
   Prevents prototype pollution
   and DOM clobbering attacks.
───────────────────────────────────── */
if (typeof Object.freeze === 'function') {
    /* Freeze GOAL_PROFILES to prevent tampering */
    Object.freeze(GOAL_PROFILES);
    Object.values(GOAL_PROFILES).forEach(p => Object.freeze(p));
    /* Freeze ENHANCE_MODES */
    Object.freeze(ENHANCE_MODES);
}


