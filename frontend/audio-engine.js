/* ════════════════════════════════════════════════════════
   audio-engine.js  —  Ziphay Audio Studio Processing
   
   All 13 audio tools powered by FFmpeg.wasm + WebAudio API.
   Reuses the FFmpeg instance from converter-engine.js.
════════════════════════════════════════════════════════ */

/* ── 1. Audio Format Converter ── */
async function convertAudio(file, targetFmt, bitrate, onProgress) {
  const ffmpeg = await getFFmpegInstance();
  const fetchFile = ffmpeg._fetchFile;
  const inputName = 'input.' + file.name.split('.').pop().toLowerCase();
  const baseName = file.name.replace(/\.[^.]+$/, '');

  const fmtMap = {
    mp3:  { ext:'.mp3',  mime:'audio/mpeg',  args:['-c:a','libmp3lame','-b:a',(bitrate||'192')+'k'] },
    wav:  { ext:'.wav',  mime:'audio/wav',   args:['-c:a','pcm_s16le'] },
    aac:  { ext:'.aac',  mime:'audio/aac',   args:['-c:a','aac','-b:a',(bitrate||'192')+'k'] },
    ogg:  { ext:'.ogg',  mime:'audio/ogg',   args:['-c:a','libvorbis','-b:a',(bitrate||'192')+'k'] },
    flac: { ext:'.flac', mime:'audio/flac',  args:['-c:a','flac'] },
  };
  const cfg = fmtMap[targetFmt] || fmtMap.mp3;
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

/* ── 2. Audio Compressor ── */
async function compressAudio(file, mode, onProgress) {
  const bitrateMap = { high: '192', balanced: '128', max: '64' };
  const br = bitrateMap[mode] || '128';
  return convertAudio(file, 'mp3', br, onProgress);
}

/* ── 3. Audio Trimmer ── */
async function trimAudio(file, startSec, endSec, onProgress) {
  const ffmpeg = await getFFmpegInstance();
  const fetchFile = ffmpeg._fetchFile;
  const ext = file.name.split('.').pop().toLowerCase();
  const inputName = 'input.' + ext;
  const outputName = 'trimmed.' + ext;
  const baseName = file.name.replace(/\.[^.]+$/, '');

  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  const args = ['-i', inputName, '-ss', String(startSec)];
  if (endSec > 0) args.push('-to', String(endSec));
  args.push('-c', 'copy', outputName);
  await ffmpeg.exec(args);
  const data = await ffmpeg.readFile(outputName);
  const blob = new Blob([data.buffer], { type: file.type || 'audio/mpeg' });
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  return { blob, filename: baseName + '_trimmed.' + ext, origSize: file.size, newSize: blob.size };
}

/* ── 4. Audio Merger ── */
async function mergeAudio(files, onProgress) {
  const ffmpeg = await getFFmpegInstance();
  const fetchFile = ffmpeg._fetchFile;
  let listContent = '';
  for (let i = 0; i < files.length; i++) {
    const name = 'merge_' + i + '.' + files[i].name.split('.').pop().toLowerCase();
    await ffmpeg.writeFile(name, await fetchFile(files[i]));
    listContent += "file '" + name + "'\n";
  }
  await ffmpeg.writeFile('list.txt', listContent);
  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
  await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'merged.mp3']);
  const data = await ffmpeg.readFile('merged.mp3');
  const blob = new Blob([data.buffer], { type: 'audio/mpeg' });
  // cleanup
  for (let i = 0; i < files.length; i++) {
    await ffmpeg.deleteFile('merge_' + i + '.' + files[i].name.split('.').pop().toLowerCase());
  }
  await ffmpeg.deleteFile('list.txt');
  await ffmpeg.deleteFile('merged.mp3');
  const totalOrig = files.reduce((s, f) => s + f.size, 0);
  return { blob, filename: 'ziphay_merged.mp3', origSize: totalOrig, newSize: blob.size };
}

/* ── 5. Audio Splitter ── */
async function splitAudio(file, splitTimeSec, onProgress) {
  const ffmpeg = await getFFmpegInstance();
  const fetchFile = ffmpeg._fetchFile;
  const ext = file.name.split('.').pop().toLowerCase();
  const inputName = 'input.' + ext;
  const baseName = file.name.replace(/\.[^.]+$/, '');
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Split into 2 parts at the split point
  const results = [];
  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
  
  await ffmpeg.exec(['-i', inputName, '-to', String(splitTimeSec), '-c', 'copy', 'part1.' + ext]);
  const d1 = await ffmpeg.readFile('part1.' + ext);
  const b1 = new Blob([d1.buffer], { type: file.type || 'audio/mpeg' });
  results.push({ blob: b1, filename: baseName + '_part1.' + ext, origSize: file.size, newSize: b1.size });

  await ffmpeg.exec(['-i', inputName, '-ss', String(splitTimeSec), '-c', 'copy', 'part2.' + ext]);
  const d2 = await ffmpeg.readFile('part2.' + ext);
  const b2 = new Blob([d2.buffer], { type: file.type || 'audio/mpeg' });
  results.push({ blob: b2, filename: baseName + '_part2.' + ext, origSize: file.size, newSize: b2.size });

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile('part1.' + ext);
  await ffmpeg.deleteFile('part2.' + ext);
  return results;
}

/* ── 6. Audio Extractor (from video) ── */
async function extractAudioFromVideo(file, targetFmt, onProgress) {
  const fmtMap = {
    mp3: { ext:'.mp3', mime:'audio/mpeg', args:['-vn','-c:a','libmp3lame','-b:a','192k'] },
    wav: { ext:'.wav', mime:'audio/wav',  args:['-vn','-c:a','pcm_s16le'] },
    aac: { ext:'.aac', mime:'audio/aac',  args:['-vn','-c:a','aac','-b:a','192k'] },
  };
  const cfg = fmtMap[targetFmt] || fmtMap.mp3;
  const ffmpeg = await getFFmpegInstance();
  const fetchFile = ffmpeg._fetchFile;
  const inputName = 'input.' + file.name.split('.').pop().toLowerCase();
  const outputName = 'extracted' + cfg.ext;
  const baseName = file.name.replace(/\.[^.]+$/, '');

  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec(['-i', inputName, ...cfg.args, outputName]);
  const data = await ffmpeg.readFile(outputName);
  const blob = new Blob([data.buffer], { type: cfg.mime });
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  return { blob, filename: baseName + cfg.ext, origSize: file.size, newSize: blob.size };
}

/* ── Helper: get or init FFmpeg ── */
async function getFFmpegInstance() {
  // Reuse the getFFmpeg from converter-engine.js
  if (window.ZiphayConverter && window.ZiphayConverter.CDN) {
    const CDN = window.ZiphayConverter.CDN;
    const loadScript = window.ZiphayConverter.loadScript;
    if (!window._zAudioFFmpeg) {
      await loadScript(CDN.ffmpeg);
      await loadScript(CDN.ffmpegUtil);
      const { FFmpeg } = window.FFmpegWASM || window['@ffmpeg/ffmpeg'];
      const { fetchFile, toBlobURL } = window.FFmpegUtil || window['@ffmpeg/util'];
      const ff = new FFmpeg();
      ff._fetchFile = fetchFile;
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
      await ff.load({
        coreURL: await toBlobURL(baseURL + '/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL(baseURL + '/ffmpeg-core.wasm', 'application/wasm'),
      });
      window._zAudioFFmpeg = ff;
    }
    return window._zAudioFFmpeg;
  }
  throw new Error('Converter engine not loaded');
}

/* ── 7. AI Audio Denoiser (WebAudio spectral gating) ── */
async function denoiseAudio(file, onProgress) {
  const ctx = new OfflineAudioContext(2, 1, 44100);
  const arrayBuf = await file.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuf);

  const duration = audioBuffer.duration;
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  const offCtx = new OfflineAudioContext(numChannels, length, sampleRate);
  const source = offCtx.createBufferSource();
  source.buffer = audioBuffer;

  // Noise gate: highpass at 80Hz + lowpass at 12kHz to remove hiss/hum
  const hp = offCtx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 80; hp.Q.value = 0.7;
  const lp = offCtx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 12000; lp.Q.value = 0.7;
  // Notch at 50Hz/60Hz (electrical hum)
  const notch = offCtx.createBiquadFilter();
  notch.type = 'notch'; notch.frequency.value = 60; notch.Q.value = 30;

  source.connect(hp).connect(lp).connect(notch).connect(offCtx.destination);
  source.start(0);
  if (onProgress) onProgress(30);

  const rendered = await offCtx.startRendering();
  if (onProgress) onProgress(80);

  const wavBlob = audioBufferToWav(rendered);
  if (onProgress) onProgress(100);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return { blob: wavBlob, filename: baseName + '_denoised.wav', origSize: file.size, newSize: wavBlob.size };
}

/* ── 8. AI Voice Enhancer (WebAudio EQ + compression) ── */
async function enhanceVoice(file, onProgress) {
  const arrayBuf = await file.arrayBuffer();
  const tempCtx = new OfflineAudioContext(1, 1, 44100);
  const audioBuffer = await tempCtx.decodeAudioData(arrayBuf);

  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const offCtx = new OfflineAudioContext(numChannels, length, sampleRate);
  const source = offCtx.createBufferSource();
  source.buffer = audioBuffer;

  // Remove rumble below 100Hz
  const hp = offCtx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 100; hp.Q.value = 0.7;
  // Boost presence (2-5kHz)
  const presence = offCtx.createBiquadFilter();
  presence.type = 'peaking'; presence.frequency.value = 3000; presence.gain.value = 4; presence.Q.value = 1;
  // Boost clarity (5-8kHz)
  const clarity = offCtx.createBiquadFilter();
  clarity.type = 'peaking'; clarity.frequency.value = 6000; clarity.gain.value = 2; clarity.Q.value = 1.5;
  // Dynamics compressor
  const comp = offCtx.createDynamicsCompressor();
  comp.threshold.value = -24; comp.knee.value = 12; comp.ratio.value = 4;
  comp.attack.value = 0.003; comp.release.value = 0.25;

  source.connect(hp).connect(presence).connect(clarity).connect(comp).connect(offCtx.destination);
  source.start(0);
  if (onProgress) onProgress(30);

  const rendered = await offCtx.startRendering();
  if (onProgress) onProgress(90);

  const wavBlob = audioBufferToWav(rendered);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return { blob: wavBlob, filename: baseName + '_enhanced.wav', origSize: file.size, newSize: wavBlob.size };
}

/* ── 9. AI Silence Remover ── */
async function removeSilence(file, thresholdDb, onProgress) {
  const arrayBuf = await file.arrayBuffer();
  const tempCtx = new OfflineAudioContext(1, 1, 44100);
  const audioBuffer = await tempCtx.decodeAudioData(arrayBuf);

  const threshold = Math.pow(10, (thresholdDb || -40) / 20);
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const blockSize = Math.floor(sampleRate * 0.05); // 50ms blocks
  const minSilenceBlocks = Math.floor(0.5 / 0.05); // 500ms minimum silence

  // Detect non-silent segments
  const segments = [];
  let inSound = false;
  let segStart = 0;
  let silenceCount = 0;

  for (let i = 0; i < channelData.length; i += blockSize) {
    let rms = 0;
    const end = Math.min(i + blockSize, channelData.length);
    for (let j = i; j < end; j++) rms += channelData[j] * channelData[j];
    rms = Math.sqrt(rms / (end - i));

    if (rms > threshold) {
      if (!inSound) { segStart = i; inSound = true; }
      silenceCount = 0;
    } else {
      silenceCount++;
      if (inSound && silenceCount >= minSilenceBlocks) {
        segments.push([segStart, i - (silenceCount * blockSize)]);
        inSound = false;
      }
    }
    if (onProgress) onProgress(Math.round((i / channelData.length) * 60));
  }
  if (inSound) segments.push([segStart, channelData.length]);

  if (segments.length === 0) {
    throw new Error('Audio appears to be entirely silent at this threshold.');
  }

  // Build output buffer from non-silent segments
  const totalSamples = segments.reduce((s, seg) => s + (seg[1] - seg[0]), 0);
  const numChannels = audioBuffer.numberOfChannels;
  const outCtx = new OfflineAudioContext(numChannels, totalSamples, sampleRate);
  const outBuffer = outCtx.createBuffer(numChannels, totalSamples, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const srcData = audioBuffer.getChannelData(ch);
    const dstData = outBuffer.getChannelData(ch);
    let offset = 0;
    for (const [start, end] of segments) {
      const len = end - start;
      dstData.set(srcData.subarray(start, end), offset);
      offset += len;
    }
  }
  if (onProgress) onProgress(90);

  const wavBlob = audioBufferToWav(outBuffer);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const removedPct = Math.round((1 - totalSamples / audioBuffer.length) * 100);
  return { blob: wavBlob, filename: baseName + '_no_silence.wav', origSize: file.size, newSize: wavBlob.size, removedPct };
}

/* ── 10. Podcast Optimizer (chained pipeline) ── */
async function optimizePodcast(file, onProgress) {
  if (onProgress) onProgress(5);
  const step1 = await denoiseAudio(file, p => { if (onProgress) onProgress(5 + p * 0.3); });
  // Create a File-like from the blob for step2
  const step1File = new File([step1.blob], 'step1.wav', { type: 'audio/wav' });
  const step2 = await enhanceVoice(step1File, p => { if (onProgress) onProgress(35 + p * 0.3); });
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return { blob: step2.blob, filename: baseName + '_podcast_optimized.wav', origSize: file.size, newSize: step2.blob.size };
}

/* ── 11. BPM & Key Detector ── */
async function analyzeBPM(file) {
  const arrayBuf = await file.arrayBuffer();
  const tempCtx = new OfflineAudioContext(1, 1, 44100);
  const audioBuffer = await tempCtx.decodeAudioData(arrayBuf);

  const data = audioBuffer.getChannelData(0);
  const sr = audioBuffer.sampleRate;

  // Onset energy-based BPM via autocorrelation
  const blockSize = Math.floor(sr * 0.02); // 20ms blocks
  const energies = [];
  for (let i = 0; i < data.length; i += blockSize) {
    let e = 0;
    const end = Math.min(i + blockSize, data.length);
    for (let j = i; j < end; j++) e += data[j] * data[j];
    energies.push(e / (end - i));
  }

  // Difference function
  const diff = [];
  for (let i = 1; i < energies.length; i++) {
    diff.push(Math.max(0, energies[i] - energies[i - 1]));
  }

  // Autocorrelation of onset signal
  const minLag = Math.floor(60 / 200 / 0.02); // 200 BPM max
  const maxLag = Math.floor(60 / 60 / 0.02);  // 60 BPM min
  let bestLag = minLag, bestCorr = 0;
  for (let lag = minLag; lag <= Math.min(maxLag, diff.length / 2); lag++) {
    let corr = 0;
    for (let i = 0; i < diff.length - lag; i++) corr += diff[i] * diff[i + lag];
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }
  const bpm = Math.round(60 / (bestLag * 0.02));

  // Simple key detection via chroma
  const keys = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const chroma = new Float32Array(12);
  for (let i = 0; i < data.length; i++) {
    const freq = Math.abs(data[i]) * sr / 2;
    if (freq > 20 && freq < 4000) {
      const noteNum = 12 * Math.log2(freq / 440) + 69;
      const idx = Math.round(noteNum) % 12;
      if (idx >= 0 && idx < 12) chroma[idx] += Math.abs(data[i]);
    }
  }
  let maxChroma = 0, keyIdx = 0;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > maxChroma) { maxChroma = chroma[i]; keyIdx = i; }
  }
  const key = keys[keyIdx] + ' Major';

  return { bpm: Math.max(60, Math.min(200, bpm)), key, duration: audioBuffer.duration };
}

/* ── 12. Metadata Editor (FFmpeg) ── */
async function editMetadata(file, meta, onProgress) {
  const ffmpeg = await getFFmpegInstance();
  const fetchFile = ffmpeg._fetchFile;
  const ext = file.name.split('.').pop().toLowerCase();
  const inputName = 'input.' + ext;
  const outputName = 'tagged.' + ext;

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  const args = ['-i', inputName];
  if (meta.title)  args.push('-metadata', 'title=' + meta.title);
  if (meta.artist) args.push('-metadata', 'artist=' + meta.artist);
  if (meta.album)  args.push('-metadata', 'album=' + meta.album);
  if (meta.year)   args.push('-metadata', 'date=' + meta.year);
  if (meta.genre)  args.push('-metadata', 'genre=' + meta.genre);
  args.push('-c', 'copy', outputName);

  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
  await ffmpeg.exec(args);
  const data = await ffmpeg.readFile(outputName);
  const blob = new Blob([data.buffer], { type: file.type || 'audio/mpeg' });
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return { blob, filename: baseName + '_tagged.' + ext, origSize: file.size, newSize: blob.size };
}

/* ── 13. Creator Export Presets ── */
async function exportPreset(file, preset, onProgress) {
  const presets = {
    youtube:   { fmt:'mp3', bitrate:'320', sr:'48000' },
    spotify:   { fmt:'ogg', bitrate:'192', sr:'44100' },
    apple:     { fmt:'aac', bitrate:'256', sr:'44100' },
    reels:     { fmt:'aac', bitrate:'192', sr:'44100' },
    voiceover: { fmt:'mp3', bitrate:'128', sr:'22050' },
  };
  const p = presets[preset] || presets.youtube;
  const ffmpeg = await getFFmpegInstance();
  const fetchFile = ffmpeg._fetchFile;
  const inputName = 'input.' + file.name.split('.').pop().toLowerCase();
  const fmtArgs = {
    mp3: { ext:'.mp3', mime:'audio/mpeg', codec:'libmp3lame' },
    ogg: { ext:'.ogg', mime:'audio/ogg',  codec:'libvorbis' },
    aac: { ext:'.aac', mime:'audio/aac',  codec:'aac' },
  };
  const fc = fmtArgs[p.fmt] || fmtArgs.mp3;
  const outputName = 'export' + fc.ext;
  const baseName = file.name.replace(/\.[^.]+$/, '');

  if (onProgress) ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec(['-i', inputName, '-c:a', fc.codec, '-b:a', p.bitrate + 'k', '-ar', p.sr, outputName]);
  const data = await ffmpeg.readFile(outputName);
  const blob = new Blob([data.buffer], { type: fc.mime });
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  return { blob, filename: baseName + '_' + preset + fc.ext, origSize: file.size, newSize: blob.size };
}

/* ── WAV Encoder (AudioBuffer → Blob) ── */
function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const dataSize = length * numCh * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  function writeStr(offset, str) { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * numCh * bytesPerSample, true);
  view.setUint16(32, numCh * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch));
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/* ── GLOBAL EXPORT ── */
window.ZiphayAudio = Object.freeze({
  convertAudio,
  compressAudio,
  trimAudio,
  mergeAudio,
  splitAudio,
  extractAudioFromVideo,
  denoiseAudio,
  enhanceVoice,
  removeSilence,
  optimizePodcast,
  analyzeBPM,
  editMetadata,
  exportPreset,
  audioBufferToWav,
});
