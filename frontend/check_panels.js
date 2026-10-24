const fs = require('fs');
const html = fs.readFileSync('frontend/index.html', 'utf8');
const ids = ['compressPanel', 'upscalePanel', 'denoisePanel', 'bgRemovePanel'];
const missing = ids.filter(id => !html.includes('id="' + id + '"'));
console.log('Missing IDs:', missing);
