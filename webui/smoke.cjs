// Bundle smoke test - minimal: just confirm the bundle is syntactically valid JS.
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'pages', 'quote-gallery', 'assets', 'app.js'), 'utf8');

console.log('Bundle size: ' + code.length + ' bytes');

// 1. parse as valid JS
try {
  new Function(code);
  console.log('OK [1/4] bundle parses as valid JS');
} catch (e) {
  console.error('FAIL [1/4]: ' + e.message);
  process.exit(1);
}

// 2. no TODO/placeholders left
const placeholders = ['FIXME', 'TODO', 'XXX', 'PLACEHOLDER'];
for (const p of placeholders) {
  if (code.includes(p)) {
    console.error('FAIL [2/4]: bundle contains placeholder "' + p + '"');
    process.exit(1);
  }
}
console.log('OK [2/4] no placeholders left');

// 3. expected react/antd/feature usage is present
// (minifier may rename local vars, so we look for string literals that survive)
const expectTokens = [
  '"groups"',
  '"overview"',
  '"images/raw"',
  '"images/thumb"',
  '"images/upload"',
  '"images/delete"',
  '"images/move"',
  '"images/rename"',
  '"settings"',
  'AstrBotPluginPage',
];
for (const t of expectTokens) {
  if (!code.includes(t)) {
    console.error('FAIL [3/4]: bundle missing expected token: ' + t);
    process.exit(1);
  }
}
console.log('OK [3/4] expected endpoint strings present');

// 4. size sanity (< 2MB minified)
if (code.length > 2 * 1024 * 1024) {
  console.error('FAIL [4/4]: bundle too large: ' + code.length);
  process.exit(1);
}
console.log('OK [4/4] size within budget');

console.log('All smoke tests passed.');

