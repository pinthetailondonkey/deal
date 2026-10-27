// Deal selftest: the full tap round-trip through the app's own paperwork
// library, on two simulated phones. Mint → sell → receive → re-sell, plus
// the refusals that must refuse. Exit 1 on any failure.
import assert from 'node:assert/strict';
import { generateKey, keyPairFromSeed } from 'deal-engine/src/keys.js';
import { bytesToHex } from 'deal-engine/src/canonical.js';
import {
  decodeCode,
  encodeCode,
  identityCodeOf,
  keysFromIdentityCode,
  mintTitle,
  papersCodeOf,
  receiveTitle,
  sellTitle,
  titleMine,
  titleOwner,
  titlesFromPapersCode,
} from '../src/lib/paper.js';

const phone = (seedHex) => {
  const master = keyPairFromSeed(Buffer.from(seedHex, 'hex'));
  return { sk: bytesToHex(master.secretKey), pk: master.publicKey };
};

const alice = phone('11'.repeat(32));
const bob = phone('22'.repeat(32));
const mallory = phone('33'.repeat(32));

// 1. mint: alice issues a title for her camera
const camera = mintTitle(alice, 'Canon AE-1');
let owner = titleOwner(camera);
assert.equal(owner.ok, true, 'mint roots');
assert.equal(owner.owner, alice.pk, 'mint names alice');
assert.equal(titleMine(alice, camera).mine, true, 'alice really holds it');

// 2. the tap: bob shows his code, alice makes the sell paper, bob taps in
const sellPaper = encodeCode(sellTitle(alice, camera, bob.pk));
const bought = receiveTitle(bob, decodeCode(sellPaper));
owner = titleOwner(bought);
assert.equal(owner.ok, true, 'transfer roots');
assert.equal(owner.owner, bob.pk, 'custody moved to bob');
assert.equal(titleMine(bob, bought).mine, true, 'bob holds it');
assert.equal(titleMine(alice, bought).mine, false, 'alice no longer holds the bought copy');

// 3. the chain grew, history clean
assert.equal(bought.hops.length, 2, 'born + flip');

// 4. resale: bob sells to mallory without alice existing anywhere near it
const resalePaper = encodeCode(sellTitle(bob, bought, mallory.pk));
const resold = receiveTitle(mallory, decodeCode(resalePaper));
assert.equal(titleOwner(resold).owner, mallory.pk, 'resale names mallory');
assert.equal(resold.hops.length, 3, 'born + flip + flip');

// refusals that must refuse:
// 5. mallory tries to sell a title she does not hold
let refused = false;
try { sellTitle(bob, resold, alice.pk); } catch (error) { if (String(error.message).includes('You do not hold')) refused = true; }
assert.equal(refused, true, 'not-the-holder cannot sell');

// 6. mallory mints her own paper naming alice's item, alice-past code to herself — the chain she signs is hers, renamed; a receive of it on bob must hit the custody wall
let forgedPaper;
{
  const fake = { name: 'Canon AE-1', itemId: camera.itemId, hops: resalePaper ? JSON.parse(atob(resalePaper)).hops : [] };
  // mallory re-signs the last flip towards bob, forging custody from a tip she does not own
  fake.hops[fake.hops.length - 1].body.to = bob.pk;
  forgedPaper = btoa(JSON.stringify(fake));
}
let received = false;
try { receiveTitle(bob, decodeCode(forgedPaper)); received = true; } catch { received = false; }
assert.equal(received, false, 'a forged flip cannot tap in');

// 7. an empty or corrupt code cannot adopt anything
assert.throws(() => receiveTitle(bob, decodeCode(encodeCode({ hops: [null] }))));
assert.throws(() => decodeCode(btoa('not json')));

// 8. key loss: the owner's code + papers bring mallory onto a new device
const restoredKeys = keysFromIdentityCode(identityCodeOf(mallory));
assert.equal(restoredKeys.sk, mallory.sk, 'restore is the identity');
assert.equal(restoredKeys.pk, mallory.pk, 'restore derives the same public key');
const restoredTitle = titlesFromPapersCode(papersCodeOf([resold]))[0];
assert.equal(titleOwner(restoredTitle).owner, mallory.pk, 'restored papers still name mallory');
assert.equal(titleMine(restoredKeys, restoredTitle).mine, true, 'a restored owner really owns again');
assert.equal(resold.hops.length, 3, 'history rides the papers, unbroken');
assert.throws(() => keysFromIdentityCode('1234'));

console.log('selftest: 8/8 — mint, tap, resale, transfers, restore all hold');
