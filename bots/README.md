# GENESIScoin — Autonomous Bots System (Zeroized Version)

This repository contains the full code structure of autonomous bots that operate within the GENESIScoin (GENc) ecosystem.  
All operational values and ABI data have been removed and replaced with `PLACEHOLDER`.  
The purpose of this codebase is **to demonstrate the logic flow and modular architecture** — it cannot function without proper configuration.

---

## System Overview

Each bot operates **independently**, reacting only to **on-chain events** emitted by GENc smart contracts.  
All modules are event-driven through WebSocket subscriptions, **except for `oracleBot`**, which runs in a continuous timed loop to provide stable and consistent monitoring across PreSale and Public Sale phases.  
Bots do not control each other — every decision is derived directly from the blockchain state.

---

## Bot List and Roles

|      Bot         |           File(s)          |                                          Description                                                                                                                                |
|------------------|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **oracleBot**    | `oracle.js`                | Updates live BNB/USDT price, closes PreSale stages, triggers whitelist events, B100D start, and initiates Public Sale.                                                              |
| **airdropBot**   | `airT.js`, `AirdropCLI.js` | Dual-module setup: `airT` tracks eligible addresses, `AirdropCLI` executes airdrop distributions. Uses a shared `.env.example`.                                                     |
| **dividendBot**  | `divT.js`, `divV.js`       | Dual-module setup: `divT` (Tracker) monitors addresses eligible for dividends; `divV` (Verifier) manages snapshots and payout cycles from the dividend pool. Shared `.env.example`. |
| **eligibleBot**  | `eliB.js`                  | Handles daily LP purchase bonuses across 4 Public Sale phases. Fully event-driven.                                                                                                  |
| **b100dBot**     | `b100d.js`                 | Controls the B100D 100-day reward program: whitelist management, participant validation, and stage monitoring.                                                                      |
| **finalBBot**    | `finB.js`                  | Executes the final bonus distribution after the B100D program concludes.                                                                                                            |
| **generalBot**   | `generalAM.js`             | Monitors the AssetManager contract after WhitelistClosed. Checks pools (ID 1–6) and automatically releases vesting steps when due. Fully autonomous — no manual calls.              |

---

## Security Model

- All operational values (`PRIVATE_KEY`, `RPC_URL`, `WSS_URL`, thresholds, timings, gas limits) are **zeroized** (`PLACEHOLDER`).  
- This public version **cannot connect to real contracts** or perform any transactions.  
- Only `.env.example` files are included — real `.env` files are excluded.  
- Locally generated artifacts (`trackedHolders.json`, `cycle-metadata.json`, `verifier-state.json`, etc.) are ignored via `.gitignore`.

---

## Local Usage (for demonstration only)

1. Copy any `.env.example` to `.env` and fill in real values.  
2. Replace `PLACEHOLDER` tokens in ABI and constants with actual data.  
3. Run a bot manually, e.g.:
   ```bash
   cd bots/oracleBot
   node oracle.js

---

## Directory Structure

```bash
bots/
├── oracleBot/
│   ├── oracle.js
│   └── .env.example
├── airdropBot/
│   ├── airT.js
│   ├── AirdropCLI.js
│   └── .env.example
├── dividendBot/
│   ├── divT.js
│   ├── divV.js
│   └── .env.example
├── eligibleBot/
│   ├── eliB.js
│   └── .env.example
├── b100dBot/
│   ├── b100d.js
│   └── .env.example
└── finalBBot/
    ├── finB.js
    └── .env.example
