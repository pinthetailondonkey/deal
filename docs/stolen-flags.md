# Stolen flags on the Deal app — the wiring plan

Written 2026-10-27 night, after the engine surface landed
(deal-engine @ 8870f72, `src/stolen.js`) and BEFORE the app can use it:
the app's engine pin holds at 9e3bb43 by founder ruling until the
post-purge review settles. This doc is the one-day job's blueprint, so
when the pin bump is ruled the wiring is a day, not a design session.

Written to ADAPT to the pending attack round on stolen.js — the screens
below do not change shape if a finding reworks engine internals; only
the named calls would move (see "What a finding could change").

## Where a flag comes from

- Only an owner can fire it: the card shows "Flag stolen" exactly where
  "Sell → tap paper" shows — `titleMine` true, chain checks. The filer
  is whoever the chain's tip names; the engine takes the filer key from
  the signature, never from a field (`signStolenFlag(secretKey, tipHop,
  claim, at)`).
- The flag flies on the CURRENT TIP hop — the tip the owner actually
  holds — and stays bound to that hop forever. When the paper later
  sells, the flag rides the chain history the buyer is reading.
- The flag object rides the TITLE in storage: `flags: [flag, ...]`,
  present-or-absent (absent array = no flags, honest). `bundleFor`,
  show papers and sell papers all carry it, so every reader sees what
  the paper carries.
- The claim is one required text box: "Say what happened." The words
  are the filer's responsibility; the engine only refuses emptiness.

## Screen: the title card (owner view)

- Unflagged: today's locked surface, untouched — "Real owner ✓ /
  History: N lines, clean", Sell, Show, and the new ghost button
  "Flag stolen".
- Flagged: the headline changes to
  **"Flagged stolen — you said so on <date>."**
  History lines stay. The Sell button DISAPPEARS: a flagged title does
  not sell from this app. That is an app-side gate (the engine's
  chains don't know about flags), and the split is stated here on
  purpose. Show still works — a stranger must be able to see the flag.

## Screen: Look (the stranger's view)

- The look reads every flag on the bundle through `flagOnChain` +
  `stolenStatus` (one thin wrapper in paper.js, same rule as custody:
  zero flag math app-side).
- An OPEN flag is the loudest line on the screen:
  **"Flagged stolen — do not buy."**
  under it the filer's claim words and the date filed. The verdict line
  ("This paper does not check" / "Real paper ✓") still renders — the
  flag does not hide whether the chain itself checks.
- A RESOLVED flag stops screaming but never vanishes:
  **"A stolen flag was filed on <date> and withdrawn on <date>."**
  (or "…was cleared on <date>." / "…was overturned on <date>.") The
  buyer's decision stays theirs; the app's only job is to show it.

## Screen: Receive

- A bundle carrying an OPEN flag cannot come to you. App-side gate on
  adoption, copy:
  **"This paper is flagged stolen. It cannot come to you until the flag
  is stood down."**
- The form itself is not blocked — the error line replaces the success
  line, and the buyer can still Look. A flagged paper is information,
  not a lock on reading.

## Screen: standing a flag down, and the arbiter leg

- "Stand it down" (owner card view): `signStolenResolution([sk], flag,
  'withdrawn', now)` — the filer's hand alone, permanently on the
  record. The headline flips to the resolved wording above.
- Resolutions ride the title too: `resolutions: [{ resolution,
  arbiterKeys }]`. The arbiterKeys array is the ONE set the verifying
  door accepted, stored beside the resolution, never self-declared —
  the dispute.js round-three rule, carried over.
- Arbiter leg, v0 scope: Deal has no arbiter directory. A cleared or
  overturned verdict arrives as a PASTED resolution code from the
  arbiter — the same copy-paste walk as every other paper. Screen: a
  "Paste the arbiter's word" box on the flagged card; verify against
  the named arbiter key; headline updates. What an arbiter IS in Deal
  (who gets to clear a theft) stays a founder call — round-5 hole #4's
  police-report leg lives outside this code, as the engine comment
  says.

## What a finding could change (adaptation notes)

- A reworked `flagOnChain` signature/return: only paper.js's one
  wrapper changes. No screen reshuffle.
- Engine-side storage requirements for resolutions: the app's flags and
  resolutions arrays already ride the bundle; nothing moves.
- A finding that reworks the receive gate's honesty: the Look verdict
  remains the true surface; the receive gate is app-side and cheap to
  move or drop.
- A finding that reworks `stolenStatus` ordering: the screens read only
  "open vs resolved, verdict, history" — ordering is engine business.

## Pin-bump day mechanics (so it really is one day)

1. Bump `deal/package.json` engine ref 9e3bb43 → the ruled head; npm
   install; engine tests re-run from node_modules (106/106 expected).
2. Commit 1: the pin bump. Nothing else in it.
3. Commit 2: the wiring — paper.js wrapper (flags/resolutions on
   bundleFor, the inspect readout), App.jsx screens per above, selftest
   cells: flag → show shows the flag; withdraw → resolved history
   renders; a forged flag refuses in Look; receive refuses an open
   flag. Gates green, push.

Copy list (verbatim, app voice): "Flag stolen" · "Say what happened." ·
"Flagged stolen — you said so on <date>." · "Flagged stolen — do not
buy." · "A stolen flag was filed on <date> and withdrawn on <date>." ·
"…was cleared on <date>." · "…was overturned on <date>." · "This paper
is flagged stolen. It cannot come to you until the flag is stood down." ·
"Stand it down" · "Paste the arbiter's word".
