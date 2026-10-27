import { useEffect, useMemo, useRef, useState } from 'react';
import { bytesToHex, hexToBytes } from 'deal-engine/src/canonical.js';
import { generateKey } from 'deal-engine/src/keys.js';
import {
  bundleFor,
  decodeCode,
  encodeCode,
  identityCodeOf,
  keysFromIdentityCode,
  inspectTitle,
  mintTitle,
  papersCodeOf,
  receiveTitle,
  sellTitle,
  titlesFromPapersCode,
  titleMine,
  titleOwner,
} from './lib/paper.js';
import { buildQr } from './lib/qr.js';
import {
  addressFromForm,
  addressMisses,
  addressWords,
  deliveryMisses,
  emptyDelivery,
} from './lib/deliveryAddress.js';

// Deal v0 — the locked human surface: every title reads "Real owner,
// clean history." One master key lives on this device; the engine derives
// per-item keys from it, and every transfer is a flip hop dual-signed by
// giver and receiver. The tap (NFC/QR) will carry the same bytes these
// copy-paste codes carry; the paper does not change shape.
const KEYS_STORE = 'deal.identity.v0';
const TITLES_STORE = 'deal.titles.v0';
const DELIVERY_STORE = 'deal.delivery.v0';

function loadKeys() {
  try {
    const raw = localStorage.getItem(KEYS_STORE);
    if (raw) return JSON.parse(raw);
    const master = generateKey();
    const keys = { sk: bytesToHex(master.secretKey), pk: master.publicKey };
    localStorage.setItem(KEYS_STORE, JSON.stringify(keys));
    return keys;
  } catch (error) {
    console.error('[deal] Identity storage is unavailable:', error);
    return null;
  }
}

function loadTitles() {
  try {
    return JSON.parse(localStorage.getItem(TITLES_STORE) || '[]');
  } catch {
    return [];
  }
}

function loadDelivery() {
  try {
    const raw = localStorage.getItem(DELIVERY_STORE);
    const delivery = raw ? JSON.parse(raw) : null;
    return delivery && !Array.isArray(delivery) ? delivery : null;
  } catch {
    return null;
  }
}

function saveTitles(titles) {
  try {
    localStorage.setItem(TITLES_STORE, JSON.stringify(titles));
  } catch (error) {
    console.error('[deal] Titles could not be saved:', error);
  }
}

export default function App() {
  const [keys] = useState(loadKeys);
  const [titles, setTitles] = useState(loadTitles);
  const [name, setName] = useState('');
  const [sellFor, setSellFor] = useState(null);
  const [buyerCode, setBuyerCode] = useState('');
  const [sellCode, setSellCode] = useState('');
  const [receiveCode, setReceiveCode] = useState('');
  const [receiveError, setReceiveError] = useState('');
  const [lookOpen, setLookOpen] = useState(false);
  const [lookCode, setLookCode] = useState('');
  const [lookResult, setLookResult] = useState(null);
  const [showFor, setShowFor] = useState(null);
  const [showPaper, setShowPaper] = useState('');
  const [delivery, setDelivery] = useState(loadDelivery);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState(emptyDelivery);
  const [deliveryFails, setDeliveryFails] = useState([]);
  const [flash, setFlash] = useState('');
  const [backupOpen, setBackupOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreId, setRestoreId] = useState('');
  const [restorePapers, setRestorePapers] = useState('');
  const [restoreError, setRestoreError] = useState('');

  useEffect(() => {
    // The one item everyone already owns: the phone itself is this
    // device's first title (the anchor-item decision). Never after a
    // restore — the owner's code brings their identity, and their papers
    // bring the history; minting on top of a restored owner would write a
    // fresh life over an ongoing one.
    if (keys && loadTitles().length === 0 && !localStorage.getItem(KEYS_STORE + '.restored')) {
      const phone = mintTitle(keys, 'This phone');
      setTitles([phone]);
      saveTitles([phone]);
      try { localStorage.setItem(KEYS_STORE + '.restored', '1'); } catch { /* flags are a convenience, not the record */ }
    }
  }, [keys]);

  if (!keys) {
    return (
      <main className="screen">
        <h1>Deal</h1>
        <p role="alert">Storage is off, so titles have nowhere to live. Try a browser that keeps private data.</p>
      </main>
    );
  }

  const update = (next) => {
    setTitles(next);
    saveTitles(next);
  };

  const mint = (event) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    update([mintTitle(keys, clean), ...titles]);
    setName('');
  };

  const showCode = (values) => {
    setFlash('Code copied under it. Hand it over.');
    navigator.clipboard?.writeText(values).catch(() => {});
  };

  const sell = (title) => {
    setSellCode('');
    setBuyerCode('');
    setSellFor(title.name);
  };

  const makeSell = (event) => {
    event.preventDefault();
    const title = titles.find((row) => row.name === sellFor);
    const buyer = receivePublicFromCode(buyerCode);
    if (!title || !buyer) return;
    const bundle = sellTitle(keys, title, buyer.pk);
    update(titles.map((row) => (row === title ? { ...row, soldTo: buyer.pk } : row)));
    const code = encodeCode(bundle);
    setSellCode(code);
    showCode(code);
  };

  const receive = (event) => {
    event.preventDefault();
    setReceiveError('');
    try {
      const bought = receiveTitle(keys, decodeCode(receiveCode));
      update([bought, ...titles.filter((row) => row.itemId !== bought.itemId)]);
      setReceiveCode('');
      setFlash('Title received and countersigned. Real owner.');
    } catch (error) {
      setReceiveError(error.message);
    }
  };

  const look = (event) => {
    event.preventDefault();
    setLookResult(null);
    try {
      setLookResult({ ...inspectTitle(decodeCode(lookCode)), looked: true });
    } catch (error) {
      setLookResult({ ok: false, reason: error.message, looked: true });
    }
  };

  const show = (title) => {
    setShowPaper(encodeCode(bundleFor(title)));
    setShowFor(title.name);
  };

  // The tap code a seller reads: their key, and — only when the buyer put
  // an address on this device — the plain delivery words riding beside it.
  // Absent stays absent until the buyer saves one, present-or-absent honest.
  const tapCode = delivery
    ? encodeCode({ tap: 1, pk: keys.pk, delivery })
    : keys.pk;

  const saveDelivery = (event) => {
    event.preventDefault();
    const misses = deliveryMisses(deliveryForm);
    setDeliveryFails(misses);
    if (misses.length > 0) return;
    const address = addressFromForm(deliveryForm);
    try {
      localStorage.setItem(DELIVERY_STORE, JSON.stringify(address));
    } catch (error) {
      console.error('[deal] Delivery address could not be saved:', error);
    }
    setDelivery(address);
    setFlash('Your tap code carries the address now.');
  };

  const removeDelivery = () => {
    try {
      localStorage.removeItem(DELIVERY_STORE);
    } catch (error) {
      console.error('[deal] Delivery address could not be removed:', error);
    }
    setDelivery(null);
    setDeliveryFails([]);
    setFlash('The address is off the tap code.');
  };

  const restore = (event) => {
    event.preventDefault();
    setRestoreError('');
    try {
      const restoredKeys = keysFromIdentityCode(restoreId);
      const restoredTitles = restorePapers.trim() ? titlesFromPapersCode(restorePapers) : [];
      try {
        localStorage.setItem(KEYS_STORE, JSON.stringify(restoredKeys));
        localStorage.setItem(KEYS_STORE + '.restored', '1');
        localStorage.setItem(TITLES_STORE, JSON.stringify(restoredTitles));
      } catch (error) {
        console.error('[deal] Restored identity could not be written:', error);
      }
      setTitles(restoredTitles);
      window.location.reload();
    } catch (error) {
      setRestoreError(error.message);
    }
  };

  // What the pasted buyer code carries, read live while the seller types:
  // their key always, the delivery words when the buyer put one on.
  const buyerRead = useMemo(
    () => (buyerCode.trim() ? receivePublicFromCode(buyerCode) : null),
    [buyerCode],
  );

  return (
    <main className="screen">
      <header className="header">
        <h1>Deal</h1>
        <p className="tagline">A car title for everything, moved by tapping two phones.</p>
        <p className="fact">
          Your tap code {flash && <span className="flash"> · {flash}</span>}
        </p>
        <Textarea readOnly code={tapCode} onCopy={() => showCode(tapCode)} rows={2} />
        <Qr text={tapCode} />
      </header>

      <form className="mint" onSubmit={mint}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New title — name the item"
          aria-label="Item name"
          maxLength={80}
        />
        <button type="submit" disabled={!name.trim()}>Issue title</button>
      </form>

      <section className="wall" aria-label="Title wall">
        {titles.map((title) => {
          const state = titleOwner(title);
          const mine = titleMine(keys, title);
          return (
            <article key={`${title.name}-${title.itemId}`} className="card">
              <h2>{title.name}</h2>
              {title.soldTo ? (
                <>
                  <p className="fact">Sold — the paper moved on. History keeps the line.</p>
                  <p className="fact">History: {title.hops.length + 1} lines, clean</p>
                </>
              ) : state.ok && mine.mine ? (
                <>
                  <p className="fact verified">Real owner ✓</p>
                  <p className="fact">History: {title.hops.length} {title.hops.length === 1 ? 'line' : 'lines'}, clean</p>
                  <button type="button" className="ghost" onClick={() => sell(title)}>Sell → tap paper</button>
                  <button type="button" className="ghost" onClick={() => show(title)}>Show → show paper</button>
                </>
              ) : state.ok ? (
                <p className="fact">Held by someone else — the history stays readable here</p>
              ) : (
                <p className="fact error">Paperwork does not check ({state.reason})</p>
              )}
            </article>
          );
        })}
      </section>

      {sellFor && (
        <section className="panel" aria-label="Sell">
          <h3>Sell “{sellFor}”</h3>
          <p className="fact">Paste the buyer's tap code:</p>
          <form onSubmit={makeSell}>
            <Textarea value={buyerCode} onChange={setBuyerCode} rows={2} />
            <button type="submit" disabled={!buyerCode.trim()}>Make the sell paper</button>
          </form>
          {buyerRead?.delivery ? (
            <>
              <p className="fact verified">Ship to:</p>
              {addressWords(buyerRead.delivery).map((line) => <p className="fact" key={line}>{line}</p>)}
              {addressMisses(buyerRead.delivery).length > 0 && (
                <p className="fact error">This address does not check out — confirm it with the buyer.</p>
              )}
            </>
          ) : buyerRead && (
            <p className="fact">No delivery address was handed over. Ask for it if this must ship.</p>
          )}
          {sellCode && (
            <>
              <p className="fact">Sell paper ready — the buyer pastes this:</p>
              <Textarea readOnly code={sellCode} onCopy={() => showCode(sellCode)} rows={6} />
              <Qr text={sellCode} />
            </>
          )}
          <button type="button" className="ghost" onClick={() => setSellFor(null)}>Done</button>
        </section>
      )}

      {showFor && (
        <section className="panel" aria-label="Show a title">
          <h3>Show “{showFor}”</h3>
          <p className="fact">Show paper ready — the buyer pastes it and reads the title. It owns nothing, buys nothing.</p>
          <Textarea readOnly code={showPaper} onCopy={() => showCode(showPaper)} rows={8} />
          <Qr text={showPaper} />
          <button type="button" className="ghost" onClick={() => setShowFor(null)}>Done</button>
        </section>
      )}

      <section className="panel" aria-label="Look at a title">
        <h3>Look at a title</h3>
        <p className="fact">Before you buy — the seller's show paper tells you what you would be holding. Looking owns nothing and saves nothing.</p>
        <form onSubmit={look}>
          <Textarea value={lookCode} onChange={setLookCode} rows={6} placeholder="Paste the show paper" />
          <button type="submit" disabled={!lookCode.trim()}>Check the paper</button>
        </form>
        {lookResult?.looked && (lookResult.ok ? (
          <>
            <p className="fact verified">Real paper ✓</p>
            <p className="fact">{lookResult.name} — History: {lookResult.lines} {lookResult.lines === 1 ? 'line' : 'lines'}, clean</p>
            <p className="fact">Holder: <code>{lookResult.holder}</code></p>
            <p className="fact">Check that holder against the seller's tap code. Same code, same person — then it is safe to buy.</p>
          </>
        ) : (
          <p className="fact error">This paper does not check ({lookResult.reason}). Do not buy on it.</p>
        ))}
      </section>

      <section className="panel" aria-label="Receive">
        <h3>Receive a title</h3>
        <form onSubmit={receive}>
          <Textarea value={receiveCode} onChange={setReceiveCode} rows={6} placeholder="Paste the sell paper" />
          <button type="submit" disabled={!receiveCode.trim()}>Tap in and own it</button>
        </form>
        {receiveError && <p className="error" role="alert">{receiveError}</p>}
      </section>

      <footer className="foot">
        <p>Early build. Tap codes ride copy-paste and the camera today; NFC replaces the walk next.</p>
        <p className="backup-row">
          <button type="button" className="ghost" onClick={() => { setBackupOpen(!backupOpen); setRestoreOpen(false); setDeliveryOpen(false); }}>Owner's code</button>
          <button type="button" className="ghost" onClick={() => { setRestoreOpen(!restoreOpen); setBackupOpen(false); setDeliveryOpen(false); }}>Say it back to this phone</button>
          <button type="button" className="ghost" onClick={() => { setDeliveryOpen(!deliveryOpen); setBackupOpen(false); setRestoreOpen(false); setDeliveryForm(delivery ? { ...emptyDelivery(), street: (delivery.lines && delivery.lines[0]) || '', name: delivery.name || '', city: delivery.city || '', state: delivery.region || '', postalCode: delivery.postal || '', country: delivery.country || 'US' } : emptyDelivery()); }}>Delivery address</button>
        </p>
        {deliveryOpen && (
          <section className="panel" aria-label="Delivery address">
            <h3>Delivery address</h3>
            <p className="fact">Optional — only for things that must physically ship. The words ride your tap code, plain; nothing here talks to the internet.</p>
            <form onSubmit={saveDelivery}>
              {DELIVERY_FIELDS.map((field) => (
                <input
                  key={field.key}
                  value={deliveryForm[field.key]}
                  onChange={(event) => setDeliveryForm({ ...deliveryForm, [field.key]: event.target.value })}
                  placeholder={field.placeholder}
                  aria-label={field.label}
                  maxLength={field.key === 'street' ? 60 : 40}
                />
              ))}
              <button type="submit">{delivery ? 'Rewrite the address on my tap code' : 'Put it on my tap code'}</button>
            </form>
            {deliveryFails.map((miss) => (
              <p className="fact error" key={miss.field} role="alert">{miss.message}</p>
            ))}
            {delivery && (
              <>
                <p className="fact verified">The tap code carries this address now:</p>
                {addressWords(delivery).map((line) => <p className="fact" key={line}>{line}</p>)}
                <button type="button" className="ghost" onClick={removeDelivery}>Take it back off</button>
              </>
            )}
          </section>
        )}
        {backupOpen && (
          <section className="panel" aria-label="Owner's code">
            <h3>Your owner's code</h3>
            <p className="fact">This code IS you — the only proof anyone needs that a title's history is your history. Write it somewhere a stolen phone can't follow.</p>
            <Textarea readOnly code={identityCodeOf(keys)} onCopy={() => showCode(identityCodeOf(keys))} rows={2} />
            <p className="fact">Your papers (the titles and their chains) save separately:</p>
            <Textarea readOnly code={papersCodeOf(titles)} onCopy={() => showCode(papersCodeOf(titles))} rows={4} />
          </section>
        )}
        {restoreOpen && (
          <section className="panel" aria-label="Restore">
            <h3>Say the code back to this phone</h3>
            <p className="fact">Owner's code:</p>
            <form onSubmit={restore}>
              <Textarea value={restoreId} onChange={setRestoreId} rows={2} placeholder="Paste the owner's code" />
              <p className="fact">And the papers, if you carry them:</p>
              <Textarea value={restorePapers} onChange={setRestorePapers} rows={4} placeholder="Paste the papers backup (optional)" />
              <button type="submit" disabled={!restoreId.trim()}>Become this owner here</button>
            </form>
            {restoreError && <p className="error" role="alert">{restoreError}</p>}
          </section>
        )}
      </footer>
    </main>
  );
}

// A QR is the tap code a camera can read instead of the copy-paste walk.
// The bytes are the same object either way; nothing here reads a scan.
// A paper too large for one picture falls back to the paste, honestly.
function Qr({ text }) {
  const canvasRef = useRef(null);
  const paper = useMemo(() => buildQr(text), [text]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !paper) return;
    const cell = 5;
    const margin = 4;
    const size = (paper.size + margin * 2) * cell;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    for (let row = 0; row < paper.size; row++) {
      for (let col = 0; col < paper.size; col++) {
        if (paper.isDark(row, col)) {
          ctx.fillRect((col + margin) * cell, (row + margin) * cell, cell, cell);
        }
      }
    }
  }, [paper]);
  if (!paper) return <p className="fact">Too much paper for one picture — the paste still carries it.</p>;
  return <canvas className="qr" ref={canvasRef} aria-label="Sign the same paper for a camera" role="img" />;
}

function Textarea({ value, onChange, code, onCopy, rows, readOnly, placeholder }) {
  const text = value ?? code ?? '';
  return (
    <div className="code-field">
      <textarea
        value={text}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        rows={rows || 3}
        placeholder={placeholder}
        aria-label={placeholder || 'Code'}
      />
      {onCopy && <button type="button" className="ghost" onClick={onCopy}>Copy</button>}
    </div>
  );
}

// The delivery form's six fields, Money Moves' words — nothing clever,
// nothing remote, plain misses under the fields.
const DELIVERY_FIELDS = [
  { key: 'name', placeholder: 'Who is this going to?', label: 'Name' },
  { key: 'street', placeholder: 'Street', label: 'Street' },
  { key: 'city', placeholder: 'City', label: 'City' },
  { key: 'state', placeholder: 'State', label: 'State' },
  { key: 'postalCode', placeholder: 'Postal code', label: 'Postal code' },
  { key: 'country', placeholder: 'Country', label: 'Country' },
];

// A tap code on the buyer side is their public key — the engine's own hex —
// or, when the buyer put a delivery address on this device, the same key
// riding a small envelope. The paste works across any messenger; NFC and QR
// carry the same bytes.
function receivePublicFromCode(code) {
  const text = String(code || '').trim().toLowerCase();
  if (/^[0-9a-f]{64}$/.test(text)) return { pk: text, delivery: null };
  try {
    const bundle = decodeCode(text);
    const pk = String(bundle?.pk || '').toLowerCase();
    if (/^[0-9a-f]{64}$/.test(pk)) {
      return { pk, delivery: bundle.delivery || null };
    }
  } catch {
    // not an envelope; the plain key check above already had its chance
  }
  return null;
}
