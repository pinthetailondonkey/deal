import { canonicalBytes, hexToBytes } from 'deal-engine/src/canonical.js';
import { sign, verify } from 'deal-engine/src/keys.js';
import {
  itemKeyPair,
  HOP_TAG,
  hopBody,
  hopHash,
  signHop,
  verifyHop,
  verifyHopChain,
} from 'deal-engine/src/title.js';

// The paperwork of ownership, driven only by engine calls — no app-side
// signature math. A title roots on a born hop (the item key and its first
// owner both sign the first line) and transfers on flip hops, dual-signed
// by giver and receiver, custody never jumping. The engine enforces all of
// it; this library only stages the objects and the tap codes.

export function mintTitle(keys, name) {
  const itemId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
  const item = itemKeyPair(hexToBytes(keys.sk), itemId);
  const born = signHop([item.secretKey, hexToBytes(keys.sk)], {
    kind: 'born',
    itemKey: item.publicKey,
    priorHead: '',
    from: item.publicKey,
    to: keys.pk,
    at: Date.now(),
  });
  return { name, itemId, hops: [born] };
}

export function titleOwner(title) {
  const chain = verifyHopChain(title?.hops);
  return chain.ok ? { ok: true, owner: chain.tip.body.to, ownerOfHop: chain.tip } : { ok: false, reason: chain.reason };
}

export function titleMine(keys, title) {
  const chain = verifyHopChain(title?.hops);
  if (!chain.ok) return { ok: false, mine: false };
  return { ok: true, mine: chain.tip.body.to === keys.pk };
}

export function sellTitle(keys, title, buyerPk) {
  const chain = verifyHopChain(title.hops);
  if (!chain.ok) throw new Error('This title does not check. It cannot be sold.');
  if (chain.tip.body.to !== keys.pk) throw new Error('You do not hold this title.');
  // A sale starts as the GIVER's signed offer; the engine refuses to call it
  // a hop until the receiver signs too — receiveTitle completes it.
  const body = hopBody({
    kind: 'flip',
    itemKey: chain.tip.body.itemKey,
    priorHead: chain.tip.hash,
    from: keys.pk,
    to: String(buyerPk || '').toLowerCase(),
    at: Date.now(),
  });
  const offer = {
    v: 1,
    tag: HOP_TAG,
    hash: hopHash(body),
    body,
    sigs: { [keys.pk]: sign(hexToBytes(keys.sk), canonicalBytes(body)) },
  };
  return { name: title.name, itemId: title.itemId, hops: [...title.hops, offer] };
}

// The buyer signs their side of the flip on receive — a hop only exists
// once both parties signed it (the engine refuses less).
export function receiveTitle(keys, bundle) {
  const hops = [...(bundle?.hops || [])];
  const flip = hops[hops.length - 1];
  if (!flip || flip.body?.kind !== 'flip' || flip.body?.to !== keys.pk) {
    throw new Error('That paperwork is not addressed to you.');
  }
  const offerBytes = canonicalBytes(hopBody(flip.body));
  const giverSig = flip.sigs?.[flip.body.from];
  if (!giverSig || !verify(giverSig, offerBytes, flip.body.from)) {
    throw new Error('The seller signature does not check. Refused.');
  }
  if (!flip.sigs?.[keys.pk]) {
    hops[hops.length - 1] = { ...flip, sigs: { ...flip.sigs, [keys.pk]: sign(hexToBytes(keys.sk), offerBytes) } };
  }
  const chain = verifyHopChain(hops);
  if (!chain.ok) throw new Error(`The chain does not check (${chain.reason}).`);
  return { name: String(bundle.name || ''), itemId: String(bundle.itemId || ''), hops };
}

// Tap codes: the bundle or a public key riding any transport. QR and NFC
// replace the paste; the bytes do not change.
export function encodeCode(bundle) {
  const bytes = new TextEncoder().encode(JSON.stringify(bundle));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeCode(code) {
  const binary = atob(String(code || '').trim());
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function bundleFor(title) {
  return { name: title.name, itemId: title.itemId, hops: title.hops };
}

export function bundleHistory(title) {
  return title.hops;
}

export { hopHash, verifyHop, verifyHopChain };
