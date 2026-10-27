// The QR draws the same bytes the paste carries — and falls back honestly
// when a paper is too much for one picture, rather than lying with a blank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQr } from './qr.js';

test('a tap code draws as a picture', () => {
  const paper = buildQr('00'.repeat(32));
  assert.ok(paper);
  assert.ok(paper.size >= 21, 'even the smallest code fills 21 modules');
  assert.equal(typeof paper.isDark(0, 0), 'boolean');
});

test('a paper too large for one picture is refused, not blanked', () => {
  // type-40/L holds ~2953 bytes; a long chain beyond that must walk by paste
  assert.equal(buildQr('a'.repeat(6000)), null);
});
