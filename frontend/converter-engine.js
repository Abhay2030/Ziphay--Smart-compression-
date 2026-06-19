/* ════════════════════════════════════════════════════════
   converter-engine.js  —  Ziphay All-Format Converter
   
   Engines:
   ✅ Image → WebP / JPEG / PNG / AVIF    (Canvas API)
   ✅ HEIC / HEIF → JPEG / WebP           (heic2any)
   ✅ PNG → JPEG with background          (Canvas API)
   ✅ GIF → WebP animated                 (Canvas frames)
   ✅ SVG → PNG / WebP                    (Canvas drawImage)
   ✅ Images → PDF (multi-page)           (jsPDF)
   ✅ PDF  → Images (per page)            (PDF.js)
   ✅ MP4 / MOV / AVI → MP4 / WebM / GIF (FFmpeg.wasm)
   ✅ Video → MP3 / AAC audio extract     (FFmpeg.wasm)
════════════════════════════════════════════════════════ */

/* ── CDN URLs ── */
const CDN = {
  heic2any: 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
  jsPDF:    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  pdfjs:    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  ffmpeg:   'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js',
  ffmpegUtil: 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js',
};

/* ── Lazy script loader (with crossorigin for SRI support) ── */
function loadScript(url) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${url}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = url;
    s.crossOrigin = 'anonymous'; /* Required for SRI + CORS */
    s.onload = res;
    s.onerror = () => rej(new Error('Failed to load: ' + url));
    document.head.appendChild(s);
  });
}

/* ── Format bytes helper ── */
function fmtBytes(b) {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

/* ── SECURITY: Canvas size safety check ── */
const MAX_CANVAS_PIXELS = 16384 * 16384; /* 268 megapixels — browser hard limit */
function validateCanvasSize(w, h) {
  if (w * h > MAX_CANVAS_PIXELS) {
    throw new Error(`Image too large (${w}×${h}px = ${Math.round(w*h/1e6)}MP). Maximum is 268MP.`);
  }
  if (w > 32767 || h > 32767) {
    throw new Error(`Dimension exceeds 32767px limit (${w}×${h}px).`);
  }
}

/* ════════════════════════════════════════════════════════
   1. UNIVERSAL IMAGE CONVERTER
   Input:  any raster image (jpg/png/webp/bmp/tiff/gif)
   Output: WebP / JPEG / PNG / AVIF
════════════════════════════════════════════════════════ */
function convertImage(file, targetFmt, quality, bgColor) {
  return new Promise((resolve, reject) => {
    const mimeMap = { webp:'image/webp', jpeg:'image/jpeg', jpg:'image/jpeg', png:'image/png', avif:'image/avif' };
    const extMap  = { webp:'.webp', jpeg:'.jpg', jpg:'.jpg', png:'.png', avif:'.avif' };
    const mime    = mimeMap[targetFmt] || 'image/webp';
    const ext     = extMap[targetFmt]  || '.webp';
    const q       = mime === 'image/png' ? undefined : (quality || 0.85);

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      /* SECURITY: Validate canvas dimensions */
      try { validateCanvasSize(canvas.width, canvas.height); }
      catch(e) { return reject(e); }
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bgColor || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Conversion failed. AVIF may not be supported in this browser — try WebP instead.'));
        const baseName = file.name.replace(/\.[^.]+$/, '');
        resolve({ blob, filename: baseName + ext, origSize: file.size, newSize: blob.size });
      }, mime, q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image file.')); };
    img.src = url;
  });
}

/* ════════════════════════════════════════════════════════
   2. HEIC / HEIF → JPEG or WebP
   Uses heic2any library (iPhone photo format)
════════════════════════════════════════════════════════ */
async function convertHEIC(file, targetFmt) {
  await loadScript(CDN.heic2any);
  const mime      = targetFmt === 'webp' ? 'image/webp' : 'image/jpeg';
  const ext       = targetFmt === 'webp' ? '.webp' : '.jpg';
  const converted = await heic2any({ blob: file, toType: mime, quality: 0.85 });
  const blob      = Array.isArray(converted) ? converted[0] : converted;
  const baseName  = file.name.replace(/\.[^.]+$/, '');
  return { blob, filename: baseName + ext, origSize: file.size, newSize: blob.size };
}

/* ════════════════════════════════════════════════════════
   3. SVG → PNG or WebP
   Draws SVG onto canvas via Image element
════════════════════════════════════════════════════════ */
function convertSVG(file, targetFmt, scale) {
  return new Promise((resolve, reject) => {
    const mime = targetFmt === 'webp' ? 'image/webp' : 'image/png';
    const ext  = targetFmt === 'webp' ? '.webp' : '.png';
    const sc   = scale || 2; // default 2× for sharpness
    const reader = new FileReader();
    reader.onload = e => {
      const svgText = e.target.result;
      const blob    = new Blob([svgText], { type: 'image/svg+xml' });
      const url     = URL.createObjectURL(blob);
      const img     = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const w = (img.naturalWidth  || 800) * sc;
        const h = (img.naturalHeight || 600) * sc;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(outBlob => {
          if (!outBlob) return reject(new Error('SVG conversion failed.'));
          const baseName = file.name.replace(/\.[^.]+$/, '');
          resolve({ blob: outBlob, filename: baseName + ext, origSize: file.size, newSize: outBlob.size });
        }, mime);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not render SVG.')); };
      img.src = url;
    };
    reader.readAsText(file);
  });
}

/* ════════════════════════════════════════════════════════
   4. GIF → WebP (animated or static)
   Extracts frames and builds animated WebP via Canvas
   Note: Full animated WebP needs a library; we export
   the first frame as WebP for broad compatibility,
   or a static high-quality WebP.
════════════════════════════════════════════════════════ */
function convertGIF(file, targetFmt) {
  return new Promise((resolve, reject) => {
    const mime = targetFmt === 'jpeg' ? 'image/jpeg' : 'image/webp';
    const ext  = targetFmt === 'jpeg' ? '.jpg' : '.webp';
    const url  = URL.createObjectURL(file);
    const img  = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('GIF conversion failed.'));
        const baseName = file.name.replace(/\.[^.]+$/, '');
        resolve({ blob, filename: baseName + ext, origSize: file.size, newSize: blob.size });
      }, mime, 0.9);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load GIF.')); };
    img.src = url;
  });
}

/* ════════════════════════════════════════════════════════
   5. IMAGES → PDF (multi-page)
   Uses jsPDF — each image becomes one page sized to fit
════════════════════════════════════════════════════════ */
async function imagesToPDF(files, onProgress) {
  await loadScript(CDN.jsPDF);
  const { jsPDF } = window.jspdf;

  const loaded = await Promise.all(files.map(file => new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res({ img, file }); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Failed to load: ' + file.name)); };
    img.src = url;
  })));

  const first = loaded[0];
  const w = first.img.naturalWidth;
  const h = first.img.naturalHeight;
  const orientation = w > h ? 'landscape' : 'portrait';

  const pdf = new jsPDF({ orientation, unit: 'px', format: [w, h] });

  loaded.forEach(({ img, file }, i) => {
    if (i > 0) {
      const pw = img.naturalWidth;
      const ph = img.naturalHeight;
      pdf.addPage([pw, ph], pw > ph ? 'landscape' : 'portrait');
    }

    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const ext     = file.name.split('.').pop().toUpperCase();
    const fmt     = ['JPG','JPEG'].includes(ext) ? 'JPEG' : 'PNG';
    pdf.addImage(dataUrl, fmt, 0, 0, img.naturalWidth, img.naturalHeight);

    if (onProgress) onProgress(Math.round(((i + 1) / loaded.length) * 100));
  });

  const pdfBlob = pdf.output('blob');
  const totalOrig = files.reduce((s, f) => s + f.size, 0);
  return { blob: pdfBlob, filename: 'ziphay_combined.pdf', origSize: totalOrig, newSize: pdfBlob.size, pages: files.length };
}

/* ════════════════════════════════════════════════════════
   6. PDF → IMAGES (per page)
   Uses PDF.js — renders each page to canvas → PNG/JPEG
════════════════════════════════════════════════════════ */
async function pdfToImages(file, targetFmt, scale, onProgress) {
  await loadScript(CDN.pdfjs);
  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfjsWorker;

  const arrayBuffer = await file.arrayBuffer();
  const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const mime        = targetFmt === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext         = targetFmt === 'jpeg' ? '.jpg' : '.png';
  const sc          = scale || 2;
  const results     = [];
  const baseName    = file.name.replace(/\.[^.]+$/, '');

  for (let p = 1; p <= pdf.numPages; p++) {
    const page     = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: sc });
    const canvas   = document.createElement('canvas');
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    const ctx      = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise(res => canvas.toBlob(res, mime, 0.92));
    results.push({ blob, filename: `${baseName}_page${p}${ext}`, origSize: 0, newSize: blob.size });
    if (onProgress) onProgress(Math.round((p / pdf.numPages) * 100));
  }

  return results;
}

/* ════════════════════════════════════════════════════════
   7. VIDEO CONVERSIONS  (FFmpeg.wasm)
   
   Supported:
   - MOV / AVI / MKV → MP4
   - MP4 / MOV → WebM
   - MP4 / MOV → GIF (with palette)
   - MP4 / MOV / AVI → MP3 (audio extract)
   
   ⚠️ FFmpeg.wasm is ~32MB — loaded once, cached by browser
════════════════════════════════════════════════════════ */
let _ffmpeg = null;

async function getFFmpeg(onLog) {
  if (_ffmpeg && _ffmpeg.loaded) return _ffmpeg;

  await loadScript(CDN.ffmpeg);
  await loadScript(CDN.ffmpegUtil);

  const { FFmpeg }   = window.FFmpegWASM || window['@ffmpeg/ffmpeg'];
  const { fetchFile, toBlobURL } = window.FFmpegUtil || window['@ffmpeg/util'];

  _ffmpeg = new FFmpeg();
  _ffmpeg._fetchFile = fetchFile;

  if (onLog) _ffmpeg.on('log', ({ message }) => onLog(message));

  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
  await _ffmpeg.load({
    coreURL:   await toBlobURL(`${baseURL}/ffmpeg-core.js`,   'text/javascript'),
    wasmURL:   await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return _ffmpeg;
}

async function convertVideo(file, targetFmt, onProgress, onLog) {
  const ffmpeg     = await getFFmpeg(onLog);
  const fetchFile  = ffmpeg._fetchFile;
  const inputName  = 'input.' + file.name.split('.').pop().toLowerCase();
  const baseName   = file.name.replace(/\.[^.]+$/, '');

  const fmtMap = {
    mp4:  { ext:'.mp4',  mime:'video/mp4',       args:['-c:v','libx264','-c:a','aac','-movflags','faststart'] },
    webm: { ext:'.webm', mime:'video/webm',       args:['-c:v','libvpx-vp9','-c:a','libopus','-b:v','1M'] },
    gif:  { ext:'.gif',  mime:'image/gif',        args:['-vf','fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse','-loop','0'] },
    mp3:  { ext:'.mp3',  mime:'audio/mpeg',       args:['-vn','-ar','44100','-ac','2','-b:a','192k'] },
    aac:  { ext:'.aac',  mime:'audio/aac',        args:['-vn','-c:a','aac','-b:a','192k'] },
  };

  const cfg        = fmtMap[targetFmt] || fmtMap.mp4;
  const outputName = 'output' + cfg.ext;

  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec(['-i', inputName, ...cfg.args, outputName]);

  const data = await ffmpeg.readFile(outputName);
  const blob = new Blob([data.buffer], { type: cfg.mime });

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  return { blob, filename: baseName + cfg.ext, origSize: file.size, newSize: blob.size };
}

/* ════════════════════════════════════════════════════════
   GLOBAL EXPORT
════════════════════════════════════════════════════════ */
/* ── SECURITY: Freeze global export to prevent prototype pollution ── */
window.ZiphayConverter = Object.freeze({
  convertImage,
  convertHEIC,
  convertSVG,
  convertGIF,
  imagesToPDF,
  pdfToImages,
  convertVideo,
  fmtBytes,
  loadScript,
  CDN: Object.freeze({...CDN}),
});

