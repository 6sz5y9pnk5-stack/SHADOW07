'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const readApp = () => ['index.html','script.js','storage.js'].map(read).join('\n');

test('no inline scripts remain; CSP does not depend on per-script hashes', () => {
  const html = read('index.html');
  const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i);
  assert.ok(match, 'CSP meta tag must exist');
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].filter(m => m[1].trim().length > 0);
  assert.equal(inline.length, 0, 'all scripts must be external files (split build)');
  assert.doesNotMatch(match[1], /'sha256-/, 'no stale hash entries should remain in CSP');
  assert.match(match[1], /script-src\s+'self'/);
  for (const f of ['storage.js', 'script.js']) assert.ok(html.includes('./' + f), f + ' must be referenced by index.html');
});

test('local inference module is included in the service worker shell and server allowlist', () => {
  const sw = read('service-worker.js');
  const server = read('server.js');
  assert.match(sw, /['"]\.\/local-llm\.js['"]/);
  assert.match(server, /['"]\/local-llm\.js['"]/);
});

test('local inference is not falsely marked ready in static source', () => {
  const source = read('local-llm.js');
  assert.match(source, /state\.status='ready'/);
  assert.match(source, /state\.status='error'/);
  assert.match(source, /webgpu_unavailable/);
  assert.match(source, /secure_context_required/);
});

test('CSP self-audit describes permitted external model-download connections accurately', () => {
  const html = readApp();
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1] || '';
  assert.match(csp, /connect-src[^;]*https:\/\/esm\.run/);
  assert.match(html, /CSP接続先の明示/);
  assert.match(html, /端末内AIの初回取得には外部通信が必要です/);
  assert.doesNotMatch(html, /外部接続なしの設計/);
});

test('embedded historical handoff does not contradict the active CSP policy', () => {
  const html = readApp();
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1] || '';
  assert.match(csp, /connect-src[^;]*https:\/\/esm\.run/);
  assert.doesNotMatch(html, /CSP retains connect-src ['"]none['"]/i);
  assert.match(html, /actual module\/model retrieval and inference remain unverified/i);
});

test('CSP contains no duplicate directives that could silently discard intended sources', () => {
  const html = read('index.html');
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1] || '';
  const directives = csp.split(';').map(x => x.trim().split(/\s+/)[0]).filter(Boolean);
  const duplicates = directives.filter((name, index) => directives.indexOf(name) !== index);
  assert.deepEqual(duplicates, [], `duplicate CSP directives: ${duplicates.join(', ')}`);
  assert.match(csp, /worker-src\s+'self'\s+blob:/);
});


test('SHA256SUMS manifest matches every listed file in the candidate', () => {
  const manifestPath = path.join(root, '..', 'SHA256SUMS.txt');
  const manifest = fs.readFileSync(manifestPath, 'utf8').trim().split(/\r?\n/);
  assert.ok(manifest.length > 0, 'manifest must not be empty');
  for (const line of manifest) {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
    assert.ok(match, `invalid manifest line: ${line}`);
    const [, expected, relative] = match;
    const target = path.resolve(path.dirname(manifestPath), relative);
    assert.ok(target.startsWith(path.resolve(path.dirname(manifestPath)) + path.sep), `path escapes candidate: ${relative}`);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    assert.equal(actual, expected, `checksum mismatch: ${relative}`);
  }
});
