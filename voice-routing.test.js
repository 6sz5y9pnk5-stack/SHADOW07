'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
test('browser speech recognition is not gated by getUserMedia permission probe', () => {
  const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const handler = script.slice(script.indexOf("$('mic').addEventListener('click'"), script.indexOf("$('speakToggle').addEventListener"));
  assert.match(handler, /recognition\.start\(\)/);
  assert.doesNotMatch(handler, /if\(!micPermissionPassed\)/);
});
test('iPhone keyboard dictation fallback is explained in visible UI', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  assert.match(html, /iPhoneキーボードのマイク/);
  assert.match(script, /iPhoneキーボードのマイク/);
  assert.match(html, /ブラウザー音声認識/);
});
test('permission probe is explicitly distinguished from speech recognition', () => {
  const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  assert.match(script, /この検査は getUserMedia の取得可否のみです/);
});
