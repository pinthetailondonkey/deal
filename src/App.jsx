import { useEffect, useState } from 'react';
import { bytesToHex, hexToBytes } from 'deal-engine/src/canonical.js';
import { generateKey } from 'deal-engine/src/keys.js';
import { coSignRecord, recordBody, signRecord, verifyRecord } from 'deal-engine/src/record.js';

// Deal v0 — the locked human surface, nothing else: every title reads
// "Real owner, clean history." Two seats are held on this device for now:
// the origin seat (signs the first line of a title) and the owner seat
// (holds possession). The engine enforces buyer !== vendor at the byte
// level, so the seats are distinct keys. Transfers between two phones
// arrive next; their paperwork (hop chain) is already engine code.
const KEYS_STORE = 'deal.identity.v0';
const TITLES_STORE = 'deal.titles.v0';

function loadKeys() {
  try {
    const raw = localStorage.getItem(KEYS_STORE);
    if (raw) return JSON.parse(raw);
    const owner = generateKey();
    const origin = generateKey();
    const keys = {
      ownerSk: bytesToHex(owner.secretKey),
      ownerPk: owner.publicKey,
      originSk: bytesToHex(origin.secretKey),
      originPk: origin.publicKey,
    };
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

function saveTitles(titles) {
  try {
    localStorage.setItem(TITLES_STORE, JSON.stringify(titles));
  } catch (error) {
    console.error('[deal] Titles could not be saved:', error);
  }
}

function titlePaperwork(keys, name) {
  const body = recordBody({
    dealId: crypto.randomUUID(),
    vendor: keys.originPk, // the origin seat signs the first line
    buyer: keys.ownerPk, // the owner seat holds possession
    title: name,
    claim: 'first owner',
    currency: 'deal',
    amount: '',
    at: Date.now(),
  });
  const issued = signRecord(hexToBytes(keys.originSk), body);
  return coSignRecord(issued, hexToBytes(keys.ownerSk));
}

export default function App() {
  const [keys] = useState(loadKeys);
  const [titles, setTitles] = useState(loadTitles);
  const [name, setName] = useState('');

  useEffect(() => {
    // The one item everyone already owns: the phone itself is this
    // device's first title (round-5 anchor-item decision).
    if (keys && loadTitles().length === 0) {
      const phone = titlePaperwork(keys, 'This phone');
      setTitles([phone]);
      saveTitles([phone]);
    }
  }, [keys]);

  if (!keys) {
    return (
      <main className="screen">
        <h1>Deal</h1>
        <p role="alert">Storage is off, so titles have nowhere to live. Try a private-data-friendly browser.</p>
      </main>
    );
  }

  const mint = (event) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    const signed = titlePaperwork(keys, clean);
    const next = [signed, ...titles];
    setTitles(next);
    saveTitles(next);
    setName('');
  };

  return (
    <main className="screen">
      <header className="header">
        <h1>Deal</h1>
        <p className="tagline">A car title for everything, moved by tapping two phones.</p>
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
        {titles.map((title) => (
          <article key={title.hash} className="card">
            <h2>{title.body.title}</h2>
            <p className="fact verified">Real owner{verifyRecord(title) ? ' ✓' : ' — paperwork does not check'}</p>
            <p className="fact">First recorded {new Date(title.body.at).toLocaleDateString()}</p>
            <p className="fact">History: 1 line, clean</p>
            <p className="id">{title.hash.slice(0, 16)}</p>
          </article>
        ))}
      </section>

      <footer className="foot">
        <p>Early build. Transfers between two phones arrive next.</p>
      </footer>
    </main>
  );
}
