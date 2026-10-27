# The spend loop — the user's own card as a tool

Design only, no code. Written 2026-10-27 night on the founder's queue.
This is the shape of the M slice: how a person who has a card but no
wallet comes to hold value, without Deal ever touching the money path.

## The ruling it walks

- 2026-10-27, card-rail ruling: "deal is for credit cards/debit no
  crypto," then on the consequences: "thats fine i plan to go legal w
  it if it takes off" — fees, KYC and chargebacks are ACCEPTED costs;
  the founder intends legal operation.
- Same day, superseding: "deal should work with all crypto not just btc
  and xmr" — crypto rails stay in; cards become an embedded add-on
  (the processor buys coin; the last step lands on-chain; the buyer
  never needs a wallet of their own).
- Engine consequence @ 4cbe149: `units.js` ASSETS is the one
  row-per-rail config table; the engine consents to a settlement
  record, it never talks to a chain. Depth, address format and watcher
  hooks live app-side and watcher-side by design.

## The loop, in five moves

1. The user tops up THEIR OWN balance with their own card, at a card
   service of their choosing. Deal holds no card, no processor
   relationship, no KYC file: it is not a seller of money movement, it
   is the place the value's PAPERS live after the money settles.
2. The card service converts card money into the rail the deal names.
   The card service speaks its own states; Deal repeats them plainly
   and adds nothing of its own.
3. The converted amount lands on-chain as the deal's settlement input.
   THIS is where money becomes paper: from here on, the coin exists.
4. The watcher sees it land. Deal's law is Cipher's law: the card
   service's balance screen is not a chain confirmation, and neither
   is the processor's webhook. Only a watcher's word is "seen" and
   "confirmed" (BTC 3, XMR 10, overridable — the engine tolerates any
   chain; the watcher plumbing is per-rail and the ASSETS table is
   where its class is named).
5. Watcher confirmation gates the hop signature, never the reverse:
   the title's custody line for a funded hop is signed only after the
   watcher names the value confirmed. THE IRON RULE, verbatim:

   > watcher confirmation gates the hop signature, never the reverse.

## Why the tool framing carries the chargeback risk

A title hop funded by a reversible rail used to be unresolved modeling
debt: within a chargeback window (~180 days), "the money settled" could
un-settle while the paper says otherwise. The spend loop re-routes
that entire risk:

- The card funded the USER'S OWN BALANCE. The card risk is a wallet
  risk, the user's own prepay account, not the deal's.
- The deal itself settles on-chain, irreversible, already-watched. No
  deal ever wraps the chargeback window, because no deal ever depends
  on card money directly.
- A clawed-back top-up therefore lands as the user's own wallet debt
  (their balance goes negative or is held true), never as a broken
  title. Titles stay "clean history" — they never contained a claim a
  stranger's dispute could reach into.

This is the change in how the world does business the founder asked
for, at the money edge: the card is a door INTO value, never the value
itself.

## What the states speak (the contract)

- Card-service states are relayed VERBATIM: "pending, declined,
  settled" are the service's words in its own vocabulary; Deal adds no
  synonyms and never says "confirmed by us" about card money. There is
  exactly one "confirmed" in Deal, and it is the watcher's, on-chain.
- The funding pipeline inside Deal follows the payment path Cipher
  already runs: created → address issued → seen → confirmed. Skips
  nothing. The card's "settled" only ever feeds the "created" end; it
  never substitutes for "seen" or "confirmed".
- A receipt on a funded deal names one transaction (the on-chain one),
  exactly as Deal names one transaction everywhere.

## What this slice is NOT

- Not a processor integration: no SDK, no merchant account, nothing in
  the repo that can move card money. The processor appears only as a
  human choice on a founder card (below).
- Not an unattended bridge: "watcher confirmation gates the hop
  signature" means no hop signs itself because a webhook said nice
  things.
- Not a Deal-branded wallet: the balance is the user's at the card
  service; Deal renders the truth of it, never custody of it.

## Founder decision cards (for the morning batch)

1. **Processor pick** — which card service (the converter of card money
   into deal-rail coin). A real company choice with real terms; needs
   the founder's hands, not a lane's shortlist.
2. **Legal entity** — merchant/account paper for the go-legal plan:
   who the processor requires to exist (company, sole prop, trust) and
   in which jurisdiction.
3. **State-words contract** — relay the card service's states verbatim
   (this doc's position), or map them onto a fixed minimal set Deal
   owns? Deal's position: verbatim; a founder ruling locks it.
4. **Wallet-debt treatment** — when a top-up is clawed back after the
   coin already landed: negative wallet balance (spend from it until
   true) vs freeze-until-true-up. Both honest; copy differs and their
   tone is a founder call.
5. **Chargeback-debt surfacing** — where on the screen the wallet debt
   line lives (balance card vs a quiet ledger line), and the founder's
   words for it.
6. **Fee display** — show the processor's fees as the service's own
   line (their words, their numbers) vs Deal-computed totals per rule.
   Deal's position: the service's words; two "10% s" on one screen is
   how lies start.

## The rulings (2026-10-28, all seven, FINAL — relayed by conductor)

Every card above is answered; nothing here is a proposal anymore.

1. **Processor: shortlist path.** Deal researches real processors with
   terms on paper; the founder picks from the shortlist and can veto
   any name. Lane proposes, founder signs.
2. **Legal entity: the processor's own terms decide.** No early
   filings, no guessed jurisdiction — the processor's requirements
   pick this for us in practice.
3. **Money words: VERBATIM.** The card service's states are repeated
   in their own words; Deal never owns synonyms for card states;
   "confirmed" means only the watcher, on-chain. Locked as this doc's
   position said. (Part of the recurring-fight trio that went
   verbatim 3-for-3.)
4. **Clawback: FREEZE.** A charged-back top-up locks the wallet until
   topped back to true. A negative balance will never appear on
   screen.
5. **Debt line: balance card, first place, plain words** — under the
   freeze treatment above.
6. **Fees: the card service's own fee line.** Their words, their
   numbers; no Deal-computed totals.
7. **Theft clearing: ship now, arbiter later.** v0 ships
   filer-withdraw-only clearance (what the built engine code does);
   named-arbiter clearance/overturn can land in a later version; no
   arbiter directory blocks the ship. (Folded into
   docs/stolen-flags.md.)
