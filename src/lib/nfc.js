// NFC carry for the tap codes: the same bytes the paste and the picture
// hold, riding the tap. The letter of the hardware: one phone WRITES the
// paper (as if to a tag), the other phone CATCHES what comes over the
// antenna; both sides run the ordinary paper paths — nothing here
// verifies, signs, or decodes a bundle. Phones that cannot tap NFC say so
// plainly and keep the copy-paste walk; no path is withheld behind the
// missing radio.
export function nfcSupported() {
  return typeof window !== 'undefined' && typeof window.NDEFReader === 'function';
}

// What an antenna hands over is a message of typed records; the paper
// rides the standard TEXT record. Pure, so the tests can pin it without
// hardware: status byte's low six bits are the language tag's length,
// and bit 7 picks UTF-16 — the text starts after the language tag.
export function codeFromNdefMessage(message) {
  try {
    for (const record of message?.records || []) {
      const payload = record?.data?.buffer ? new Uint8Array(record.data.buffer) : record?.data;
      if (!payload || record.recordType !== 'text') continue;
      const status = payload[0];
      if (status === undefined) continue;
      const langLength = status & 0x3f;
      if (payload.length <= 1 + langLength) continue;
      const textBytes = payload.slice(1 + langLength);
      const text = new TextDecoder(status & 0x80 ? 'utf-16le' : 'utf-8').decode(textBytes);
      if (text) return text;
    }
  } catch {
    // a mangled record is a nothing record — keep listening
  }
  return null;
}

// Hold-the-phones read session. One at a time; stop() ends it. Every
// failure reaches the caller as words, never as silence.
export function startNfcRead({ onCode, onFail }) {
  if (!nfcSupported()) {
    onFail?.('This phone cannot tap NFC.');
    return () => {};
  }
  let reader;
  let stopped = false;
  try {
    reader = new window.NDEFReader();
  } catch (error) {
    onFail?.('This phone cannot tap NFC.');
    return () => {};
  }
  const handleError = (error) => {
    if (stopped) return;
    const name = error?.name || '';
    if (name === 'AbortError') return; // our own stop, or the user walked away
    if (name === 'NotAllowedError') onFail?.('NFC was declined. Allow it, or walk the paste.');
    else if (name === 'NotSupportedError') onFail?.('This phone cannot tap NFC.');
    else if (name === 'NotReadableError') onFail?.('The NFC radio is busy — try once more.');
    else onFail?.('NFC would not read. The paste still carries the paper.');
  };
  reader.onerror = handleError;
  reader.onreading = (event) => {
    if (stopped) return;
    const code = codeFromNdefMessage(event.message);
    if (code) onCode(code);
    else onFail?.('Nothing readable came over the tap.');
  };
  reader
    .scan()
    .catch((error) => (stopped ? null : handleError(error)));
  return () => {
    stopped = true;
    try { reader.abort?.(); } catch { /* already gone */ }
  };
}

// Write the bytes out, verbatim — the caller's stream, one text record.
// The user gesture (the button click) is required by the browser and by
// common sense: nothing writes because a screen loaded.
export async function writeNfc(text) {
  if (!nfcSupported()) {
    throw new Error('This phone cannot tap NFC — the copy-paste walk still carries it.');
  }
  try {
    const reader = new window.NDEFReader();
    await reader.write(String(text), { overwrite: true });
  } catch (error) {
    const name = error?.name || '';
    if (name === 'NotAllowedError') throw new Error('NFC was declined. Allow it, or walk the paste.');
    if (name === 'NotSupportedError') throw new Error('This phone cannot tap NFC — the copy-paste walk still carries it.');
    if (name === 'NotReadableError' || name === 'NetworkError') throw new Error('The write could not start — try once more.');
    throw new Error('NFC would not write. The paste still carries the paper.');
  }
}
