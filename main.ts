// Dip-Trend Rider — a cbBTC/USDC bot for the make.fun 24h BTC race.
//
// One asset, one position at a time, two ways in, one disciplined way out.
// The market this bot is built for pays a long-only trader in two places:
// shallow pullbacks inside an uptrend, and the first leg of a fresh surge.
// It never chases a falling knife and never sits in cash while the tape
// trends up, because both of those lose the race window.
//
//   DIP: the close has pulled back at least DIP_PCT under the 120-bar high,
//     the 60-bar tape is not in freefall, and the last bar turned back up.
//     Buy most of the stack and ride the snap-back.
//   SURGE: the 30-bar return is hot (>= SURGE_MOM) and the close prints a
//     fresh 240-bar high. Buy a smaller stake and ride the leg.
//
// Every exit is decided from the entry close and the best close since
// entry: a fixed take-profit, a trailing stop that arms once the trade is
// comfortably green, a hard stop, and a time stop so a dead trade never
// becomes a bag. A cooldown after every exit stops revenge trading.
// Orders are capped at 1% slippage; nothing trades until 120 bars of
// history exist. Deterministic: closes in, orders out — no clock, no
// randomness, no network, no files.
//
// Sizing note: a full-size round trip pays ~26 bps in fee, slippage and
// pool impact, so both entries demand moves several times that before
// they fire.

import { runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// History.
const WARMUP = 120; // bars before any trade; also the dip lookback
const TREND_LOOKBACK = 240; // regime + surge-high lookback
const MOM_LOOKBACK = 30; // surge momentum window
const TAPE_LOOKBACK = 60; // dip freefall filter window

// Entries.
const DIP_PCT = 0.007; // pullback under the 120-bar high that counts as a dip
const DIP_TAPE_MIN = -0.012; // 60-bar return must be above this (no freefall)
const DIP_SIZE = 0.65; // fraction of cash staked on a dip
const SURGE_MOM = 0.012; // 30-bar return that counts as a hot tape
const SURGE_SIZE = 0.45; // fraction of cash staked on a surge

// Exits, per engine: take-profit, trailing-stop arm + trail, hard stop, max hold.
interface ExitPlan {
  tp: number;
  trailArm: number;
  trail: number;
  stop: number;
  maxHold: number;
}
const DIP_EXIT: ExitPlan = { tp: 0.014, trailArm: 0.007, trail: 0.006, stop: 0.009, maxHold: 300 };
const SURGE_EXIT: ExitPlan = { tp: 0.02, trailArm: 0.01, trail: 0.008, stop: 0.01, maxHold: 240 };

const COOLDOWN = 40; // bars after an exit before any new entry
const MAX_SLIPPAGE_BPS = 100;

const closes: number[] = [];

interface OpenTrade {
  entry: number; // close of the bar the buy was decided on
  peak: number; // best close since entry
  held: number; // bars held
  plan: ExitPlan;
}
let trade: OpenTrade | null = null;
let cooldownUntil = -1;

function highOver(n: number): number {
  let hi = 0;
  const start = Math.max(0, closes.length - n);
  for (let i = start; i < closes.length; i++) {
    if (closes[i] > hi) hi = closes[i];
  }
  return hi;
}

function retOver(n: number): number {
  if (closes.length <= n) return 0;
  const now = closes[closes.length - 1];
  const then = closes[closes.length - 1 - n];
  return now / then - 1;
}

function turningUp(): boolean {
  const n = closes.length;
  return n >= 4 && closes[n - 1] > closes[n - 2] && closes[n - 2] >= closes[n - 3];
}

await runBars({
  onBatch(state) {
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    const price = Number(close);
    if (!(price > 0)) return [];
    closes.push(price);
    const bar = closes.length - 1;
    const pos = state.positions.get(SYMBOL);
    const holding = pos !== undefined && pos.qty > 0n;

    // Manage the open trade first: exits are checked every bar.
    if (holding && trade !== null) {
      trade.held += 1;
      if (price > trade.peak) trade.peak = price;
      const gain = price / trade.entry - 1;
      const fromPeak = price / trade.peak - 1;
      const p = trade.plan;
      const done =
        gain >= p.tp ||
        (gain >= p.trailArm && fromPeak <= -p.trail) ||
        gain <= -p.stop ||
        trade.held >= p.maxHold;
      if (done) {
        trade = null;
        cooldownUntil = bar + COOLDOWN;
        return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      return [];
    }
    if (holding && trade === null) {
      // A position we did not open (should not happen): flatten it.
      return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
    }
    if (trade !== null) trade = null; // position closed out from under us

    // No position: look for an entry.
    if (closes.length < WARMUP || bar < cooldownUntil) return [];
    if (state.cash <= 0n) return [];

    const dip = price <= highOver(WARMUP) * (1 - DIP_PCT);
    const tapeOk = retOver(TAPE_LOOKBACK) > DIP_TAPE_MIN;
    if (dip && tapeOk && turningUp()) {
      const notional = (state.cash * BigInt(Math.round(DIP_SIZE * 100))) / 100n;
      if (notional <= 0n) return [];
      trade = { entry: price, peak: price, held: 0, plan: DIP_EXIT };
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies BuyInput];
    }

    const freshHigh = price >= highOver(TREND_LOOKBACK);
    const hot = retOver(MOM_LOOKBACK) >= SURGE_MOM;
    if (freshHigh && hot) {
      const notional = (state.cash * BigInt(Math.round(SURGE_SIZE * 100))) / 100n;
      if (notional <= 0n) return [];
      trade = { entry: price, peak: price, held: 0, plan: SURGE_EXIT };
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies BuyInput];
    }

    return [];
  },
});
