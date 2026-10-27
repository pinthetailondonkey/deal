// The zero-network law for Deal: shipped code taps phones, it never calls out.
// Any network primitive in src or index.html fails this walk. When Deal one
// day needs a host, it crosses Cipher's egress wall instead — named there and
// gated by the founder (docs/NO-IP-LEAKS.md in the Cipher repo).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.endsWith('.test.js')) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

const PATTERNS = [
  /(?:(?:wss?|https?):\/\/|stuns?:|turns?:)[a-z0-9.-]+/gi,
  /\bfetch\s*\(/,
  /\bWebSocket\b/,
  /\bXMLHttpRequest\b/,
  /\bnavigator\.sendBeacon\b/,
  /\bEventSource\b/,
  /\bRTCPeerConnection\b/,
];

test('Deal phones home to nobody: no network primitive in shipped code', () => {
  const files = walk(path.join(ROOT, 'src'));
  files.push(path.join(ROOT, 'index.html'));
  const leaked = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of PATTERNS) {
      if (pattern.test(text)) leaked.push(`${path.relative(ROOT, file)}: ${pattern}`);
    }
  }
  assert.deepEqual(leaked, []);
});
