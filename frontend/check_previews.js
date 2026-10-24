const fs = require('fs');
const html = fs.readFileSync('frontend/index.html', 'utf8');
const ids = ['estPreview', 'upscalePreview'];
const missing = ids.filter(id => !html.includes('id="' + id + '"'));
console.log('Missing IDs:', missing);
