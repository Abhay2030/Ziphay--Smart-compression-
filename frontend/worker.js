/* ══════════════════════════════════════════════
   ZIPHAY worker.js — Background Processing
   Handles Canvas operations via OffscreenCanvas
══════════════════════════════════════════════ */

self.onmessage = async function(e) {
    const { id, action, payload } = e.data;

    try {
        let result;
        if (action === 'compressImage') {
            result = await compressImageWorker(payload);
        } else if (action === 'upscaleImage') {
            result = await upscaleImageWorker(payload);
        } else if (action === 'denoiseImage') {
            result = await denoiseImageWorker(payload);
        } else {
            throw new Error(`Unknown action: ${action}`);
        }

        self.postMessage({ id, status: 'success', result });
    } catch (err) {
        self.postMessage({ id, status: 'error', error: err.message });
    }
};

async function compressImageWorker({ file, maxDim, mime, q }) {
    const bitmap = await createImageBitmap(file);
    let w = bitmap.width;
    let h = bitmap.height;

    if (w > maxDim || h > maxDim) {
        const r = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
    }

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await canvas.convertToBlob({ type: mime, quality: q });
    if (!blob) throw new Error('Canvas export failed.');
    
    return { blob, width: w, height: h };
}

async function upscaleImageWorker({ file, scale, enhance }) {
    const bitmap = await createImageBitmap(file);
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const dstW = srcW * scale;
    const dstH = srcH * scale;

    const maxPx = 16000 * 16000;
    if (dstW * dstH > maxPx) {
        throw new Error(`Output would be ${dstW}×${dstH}px — too large. Try a smaller scale.`);
    }

    let canvas, ctx;

    if (scale <= 2 || enhance === 'crisp') {
        canvas = new OffscreenCanvas(dstW, dstH);
        ctx = canvas.getContext('2d');
        applySmoothing(ctx, enhance);
        ctx.drawImage(bitmap, 0, 0, dstW, dstH);
    } else {
        const passes = Math.round(Math.log2(scale));
        let src = bitmap;
        let curW = srcW, curH = srcH;
        
        for (let p = 0; p < passes; p++) {
            const stepW = Math.min(curW * 2, dstW);
            const stepH = Math.min(curH * 2, dstH);
            canvas = new OffscreenCanvas(stepW, stepH);
            ctx = canvas.getContext('2d');
            applySmoothing(ctx, enhance);
            ctx.drawImage(src, 0, 0, stepW, stepH);
            src = canvas; // Use current canvas as source for next pass
            curW = stepW;
            curH = stepH;
        }
    }

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    if (!blob) throw new Error('Canvas export failed.');

    return { blob, width: dstW, height: dstH };
}

async function denoiseImageWorker({ file, strength, dnMode }) {
    // Simplified denoise implementation for the worker
    const bitmap = await createImageBitmap(file);
    const w = bitmap.width;
    const h = bitmap.height;
    
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    
    // Draw original
    ctx.drawImage(bitmap, 0, 0, w, h);
    
    // Simple blur overlay for denoising (simplified for worker)
    ctx.globalAlpha = dnMode === 'heavy' ? 0.4 : 0.2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    for (let i = 0; i < strength; i++) {
        ctx.drawImage(canvas, 1, 1, w, h);
        ctx.drawImage(canvas, -1, -1, w, h);
    }
    
    ctx.globalAlpha = 1.0;
    
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    if (!blob) throw new Error('Canvas export failed.');

    return { blob, width: w, height: h };
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
