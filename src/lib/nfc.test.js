// NFC carry, tested without hardware: the pure record decoder pins the
// NDEF text-record shape both ways, refuse-shapes, and multi-record
// finding — the radio-facing paths only exist where a browser says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeFromNdefMessage } from './nfc.js';

const TAG = (payload, recordType = 'text') => ({
  records: [{ recordType, data: { buffer: payload.buffer } }],
});

const utf8TextPayload = (lang, text) => {
  const langBytes = new TextEncoder().encode(lang);
  const textBytes = new TextEncoder().encode(text);
  const out = new Uint8Array(1 + langBytes.length + textBytes.length);
  out[0] = langBytes.length; // utf-8, no extra flags
  out.set(langBytes, 1);
  out.set(textBytes, 1 + langBytes.length);
  return out;
};

test('nfc: a text record hands over the bytes the write put on it', () => {
  const payload = utf8TextPayload('en', 'the sell paper base64');
  assert.equal(codeFromNdefMessage(TAG(payload)), 'the sell paper base64');
});

test('nfc: utf-16 text records decode too, language tag sliced off', () => {
  const lang = 'en';
  const text = 'plain words';
  const textBytes = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i += 1) textBytes.set([text.charCodeAt(i), 0], i * 2);
  const payload = new Uint8Array(1 + lang.length + textBytes.length);
  payload[0] = lang.length | 0x80; // bit 7 set: utf-16le
  payload.set(new TextEncoder().encode(lang), 1);
  payload.set(textBytes, 1 + lang.length);
  assert.equal(codeFromNdefMessage(TAG(payload)), 'plain words');
});

test('nfc: non-text records are skipped, not fatal', () => {
  const message = {
    records: [
      { recordType: 'url', data: { buffer: utf8TextPayload('en', 'https://x').buffer } },
      { recordType: 'text', data: { buffer: utf8TextPayload('en', 'the paper').buffer } },
    ],
  };
  assert.equal(codeFromNdefMessage(message), 'the paper');
});

test('nfc: refuse-shapes answer nothing, never crash the listener', () => {
  assert.equal(codeFromNdefMessage(null), null);
  assert.equal(codeFromNdefMessage({}), null);
  assert.equal(codeFromNdefMessage({ records: [null] }), null);
  assert.equal(
    codeFromNdefMessage(TAG(utf8TextPayload('en', ''))), null,
    'an empty text record is a nothing record');
  assert.equal(
    codeFromNdefMessage({ records: 'not-an-array' }), null,
    'garbage in, null out');
});
