import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, drawIconRGBA } from '../lib/icon.js';

test('hexToRgb parses 6-digit hex with or without hash', () => {
  assert.deepEqual(hexToRgb('#16a34a'), { r: 0x16, g: 0xa3, b: 0x4a });
  assert.deepEqual(hexToRgb('dc2626'), { r: 0xdc, g: 0x26, b: 0x26 });
});

test('drawIconRGBA has the right length and a colored, opaque center', () => {
  const size = 16;
  const rgba = drawIconRGBA(size, '#16a34a');
  assert.equal(rgba.length, size * size * 4);
  const c = Math.floor((size - 1) / 2);
  const i = (c * size + c) * 4;
  assert.deepEqual([rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]], [0x16, 0xa3, 0x4a, 255]);
});

test('drawIconRGBA leaves the corner fully transparent', () => {
  const size = 16;
  const rgba = drawIconRGBA(size, '#16a34a');
  assert.equal(rgba[3], 0); // top-left pixel alpha
});
