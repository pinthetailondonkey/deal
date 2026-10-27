import qrcode from 'qrcode-generator';

// A QR is just another transport for the bytes the tap code already
// carries — the paste, the picture, and later NFC all hold the same
// object. This library never reads or decodes a code; it only draws one,
// and it refuses honestly when a paper is too much for a picture: the
// caller falls back to the copy-paste walk.
export function buildQr(text) {
  try {
    const qr = qrcode(0, 'L');
    qr.addData(String(text), 'Byte');
    qr.make();
    return { size: qr.getModuleCount(), isDark: (row, col) => qr.isDark(row, col) };
  } catch {
    return null; // too much paper — the paste still carries it
  }
}
