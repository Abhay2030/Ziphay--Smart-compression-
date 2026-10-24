const fs = require('fs');
const html = fs.readFileSync('frontend/index.html', 'utf8');
const ids = ['dropZone', 'fileInput', 'fileChips', 'dropTitleSpan', 'dropSub', 'actionBtn', 'idleState', 'processingState', 'resultBox', 'progressFill', 'pctLabel', 'procLabel', 'procDetail', 'timeEst', 'resultFiles'];
const missing = ids.filter(id => !html.includes('id="' + id + '"'));
console.log('Missing IDs:', missing);
