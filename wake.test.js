'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const wake = require('./wake.js');
test('wake word alone', () => { assert.deepEqual(wake.parse('シャドウ'), { rest: '' }); });
test('wake word with command', () => { assert.equal(wake.parse('シャドウ、今日の予定を教えて').rest, '今日の予定を教えて'); });
test('variant spellings', () => { assert.equal(wake.parse('シャドー おはよう').rest, 'おはよう'); assert.ok(wake.parse('shadow')); });
test('no wake word', () => { assert.equal(wake.parse('こんにちは'), null); assert.equal(wake.parse(''), null); });
test('greeting text', () => { assert.equal(wake.GREETING, 'はい、主。お傍におります。何なりと'); });
