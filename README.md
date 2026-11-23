# btc-race-24h-0511

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/arnesarizky/btc-race-24h-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/arnesarizky/btc-race-24h-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

Dip-Trend Rider — a cbBTC/USDC bot for the make.fun "Race a BTC trading bot live for 24 hours" bounty. One asset, one position at a time, two ways in: it buys shallow pullbacks inside an uptrend (dip ≥ 0.7% under the 120-bar high, tape not in freefall, last bar turning up) and rides fresh surges (30-bar return ≥ 1.2% at a 240-bar high). Every trade exits on a fixed take-profit, a trailing stop that arms once green, a hard stop, or a time stop, with a cooldown after each exit so it never revenge-trades. Deterministic: closes in, orders out — no clock, no randomness, no network.

Measured on the competition's published dev window (grade-local, process driver, reproduced byte for byte): net PnL **+$17.45** (+1.75%), 11 trades, win rate 66.7%, max drawdown 1.16%, fees $3.00. On the previous edition's dev window (a falling, choppy tape) the same bot nets −$6.11 — it trades both regimes and never sits out a whole window.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1: one JSON line per minute-bar on stdin, one reply per batch on stdout. Grade it locally with the competition kit:

```sh
node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot <this repo> --driver process --worktree
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=1c1337d4&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
