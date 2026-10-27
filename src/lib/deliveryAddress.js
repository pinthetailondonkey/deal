// The buyer's physical shipping address — OPTIONAL on a Deal (founder
// order 2026-10-27: physical-goods deals may carry a plain address,
// present-or-absent handled honestly). Local shape checks only: no
// autocomplete, no third-party address lookup, ever. The plain words ride
// the tap code's own bytes; the burn-once sealed carrier is a Cipher
// mechanism and never appears here.
//
// The form's six fields keep Cipher checkout's names so the two lanes read
// alike; the sealed shape is the shared field shape, Deal's own names.

// A US written recognizably still earns the US shape checks.
const US_REASON = /^\s*(?:u\.?\s?s\.?\s?|usa|united states(?: of america)?)\s*$/i;
// US → two-letter state, postal five digits or five-plus-four.
const US_REGION = /^[A-Za-z]{2}$/;
const US_POSTAL = /^\d{5}(?:-\d{4})?$/;

export function emptyDelivery() {
  return { name: '', street: '', city: '', state: '', postalCode: '', country: 'US' };
}

// Map the form onto the field shape. Called only after the checks pass.
export function addressFromForm(form) {
  const value = form || {};
  return {
    name: String(value.name || '').trim(),
    lines: [String(value.street || '').trim()].filter(Boolean),
    city: String(value.city || '').trim(),
    region: String(value.state || '').trim(),
    postal: String(value.postalCode || '').trim(),
    country: String(value.country || '').trim(),
  };
}

// One miss per broken field, in form order; an empty list means the
// address may ride the tap code. A blank form is simply absent, not
// broken — the seller is told "no address was handed over", plainly.
export function deliveryMisses(form) {
  const value = form || {};
  const isUs = US_REASON.test(String(value.country || ''));
  const misses = [];
  if (!String(value.name || '').trim()) {
    misses.push({ field: 'name', message: 'Who is this going to?' });
  }
  if (!String(value.street || '').trim()) {
    misses.push({ field: 'street', message: 'We need a street.' });
  }
  if (!String(value.city || '').trim()) {
    misses.push({ field: 'city', message: 'Which city?' });
  }
  if (!String(value.state || '').trim()) {
    misses.push({ field: 'state', message: 'Add the state.' });
  } else if (isUs && !US_REGION.test(String(value.state || '').trim())) {
    misses.push({ field: 'state', message: 'Check the state — two letters.' });
  }
  const postal = String(value.postalCode || '').trim();
  if (!postal || (isUs && !US_POSTAL.test(postal))) {
    misses.push({ field: 'postalCode', message: 'Check the postal code.' });
  }
  if (!String(value.country || '').trim()) {
    misses.push({ field: 'country', message: 'Which country?' });
  }
  return misses;
}

// A passed-in address object (already in the field shape) checked again at
// the reading side — the seller shows what the buyer handed over and can
// say plainly when it does not check out.
export function addressMisses(address) {
  const shape = address || {};
  return deliveryMisses({
    name: shape.name,
    street: Array.isArray(shape.lines) ? shape.lines[0] : shape.street,
    city: shape.city,
    state: shape.region,
    postalCode: shape.postal,
    country: shape.country,
  });
}

// The words a sell panel shows, one line per line of the address.
export function addressWords(address) {
  const shape = address || {};
  const lines = [
    shape.name,
    ...(Array.isArray(shape.lines) ? shape.lines : [shape.street].filter(Boolean)),
    shape.city,
    [shape.region, shape.postal].filter(Boolean).join(' '),
    shape.country,
  ];
  return lines.filter((line) => String(line || '').trim());
}
