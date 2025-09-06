# GENESIScoin (GENc) – The Autonomous Token System of SBA Digital LAB 2025

GENESIScoin (GENc) is the first engineered unit of the SQUNOHOLIX BRAND ASSOCIATION (SBA) — a modular, autonomous, and fully verifiable token system running on the BNB Smart Chain.

No promises. Just proof.
 
Every payout, airdrop, bonus and dividend is governed by bots, enforced by smart contracts, and written immutably into chain history.

---

## 🔐 Core Contracts (BSC Mainnet)

- GEN Token (GENc): [0xb0ad142296952305679f691D646B3F9e3d589349](https://bscscan.com/token/0xb0ad142296952305679f691D646B3F9e3d589349)
- Pre-Sale Contract: [0x44f03E1EC6BDEf231cA7B654E5EaeFc2D79E36fa](https://bscscan.com/address/0x44f03E1EC6BDEf231cA7B654E5EaeFc2D79E36fa)
- Public Sale Contract: [0x0C10f15B226526Bad708010C4632CFA1f6a44FC1](https://bscscan.com/address/0x0C10f15B226526Bad708010C4632CFA1f6a44FC1)

---

## 📦 System Components

### 🔁 Pre-Sale System
- 5 Stages with progressive pricing and instant bonuses
- Fully on-chain with wallet caps, supply checks, and auto stage closure
- Bonus logic tied to Pre-Sale phase
- 100% automated daily fund distribution (BNB → LP / Dev / Audit / Community / etc.)

### 🎯 B100D Program
- 100-day loyalty program (0.1 BNB entry fee)
- Daily reward: 150,000 GENc per qualified user
- Final Bonus from unclaimed pool distributed proportionally
- Balance drops = instant eject, permanent disqualification

### 📈 Public Sale + Bonus Phases
- 4 bonus phases over 300+ days
- Daily LP-buy-based rewards (EligibleBot)
- Daily caps per phase, enforced on-chain
- Phase 4 enables rollover from unused Phase 1–3 caps

---

## 💰 Automated Reward Systems

### ✅ BNB Dividend Engine
- Tax-fueled dividend pool
- On-chain `process()` triggers automatic payouts
- No staking. No claiming. Just hold.

### ✅ GENc Dividend Engine
- Cycle-based progressive payout system
- Snapshot-based combo rewards (2%–10% of initialHold)
- Bots: `divT`, `divV` validate holding and eject if needed

### ✅ Daily LP Bonus (Public Sale)
- Bot: `eliB` (EligibleBot) listens to LP purchases
- Triggers on-chain bonus if address meets phase requirements
- One bonus per address per day

---

## 🪂 Airdrop System

- Real-time tracking via `airT` (Airdrop Tracker)
- Eligibility: ≥ 1M GENc via Pre-Sale or LP buy
- Manual CLI distribution via `airdropConsole.js`
- Supports proportional or fixed-amount airdrops (200 users/tx)
- Logs: `trackedHolders.json`, `airdropLog.json`

---

## 🤖 Bots in the System

| Bot Name     | Function |
|--------------|----------|
| **oraB**     | Oracle Bot — triggers contract transitions & price feeds |
| **divT**     | Dividend Tracker — holds eligibility list |
| **divV**     | Dividend Verifier — snapshot + combo logic engine |
| **eliB**     | EligibleBot — public sale bonus trigger |
| **b100d**    | B100D Bot — registration + eject logic |
| **finB**     | Final Bonus Bot — batch distributes Final Bonus |
| **airT**     | Airdrop Tracker — watches buys, updates eligible list |
| **airdropConsole.js** | CLI tool for executing airdrops manually |

---

## 📊 Tokenomics

- **Total Supply**: 1,000,000,000,000 GENc (non-mintable)
- **Buy Tax**: 7% | **Sell Tax**: 10% | **Transfer**: 2%

| Component        | Buy | Sell | Transfer |
|------------------|-----|------|----------|
| Burn             | 1%  | 1%   | 1%       |
| Liquidity        | 1%  | 4%   | 0%       |
| Development      | 1%  | 1%   | 0%       |
| Marketing        | 1%  | 1%   | 0%       |
| TeamG            | 1%  | 1%   | 0%       |
| BNB Rewards      | 2%  | 2%   | 1%       |

Auto-burn is manual-only (via multisender), LP injection is automatic at swap threshold (0.5%).

---

## 🧱 Modular Infrastructure

- 🔥 Asset Manager planned for full LP custody automation  
  Until deployment, all LP buyback tokens (generated per 100,000 USDT equivalent in BNB, injected as ~1,000,000,000 GENc) will be **manually burned**.  
  This is the official interim policy defined in the Whitepaper and will be followed until the automated Asset Manager module is live.

- 📈 Governance: community voting every 200 days (Tax Council)
- 🧰 Recovery tools: multisend, manualSwap, batch payout functions
- 🔐 All smart contracts are auditable and deployed via certified infrastructure

---

## 📁 Documentation & Proofs

- [`WhitePaper_GENESIScoin.pdf`](WhitePaper_GENESIScoin.pdf)
- [`TechnicalMechanics_GENESIScoin.pdf`](TechnicalMechanics_GENESIScoin.pdf)
- [`GENESIScoin_Proof-Testnet.pdf`](GENESIScoin_Proof-Testnet.pdf)


## 🌐 Links

- 🌐 Website: [https://squnoholix.com](https://squnoholix.com)
- 🌐 GENESIScoin: [https://squnoholix.com/genesiscoin](https://squnoholix.com/genesiscoin)

-  X (Twitter): [https://x.com/GENcProtocol](https://x.com/GENcProtocol)
-  YouTube: [https://www.youtube.com/@SQUNOHOLIX_Impact](https://www.youtube.com/@SQUNOHOLIX_Impact)
-  Reddit: [https://www.reddit.com/r/SQ_LAB/](https://www.reddit.com/r/SQ_LAB/)
-  Reddit: [https://www.reddit.com/r/SBAholix/](https://www.reddit.com/r/SBAholix/)
-  Medium: [https://medium.com/@squnoholix.brand.association](https://medium.com/@squnoholix.brand.association)
-  GitHub: [https://github.com/SQunoholixBrandAssociation/GENESIScoin](https://github.com/SQunoholixBrandAssociation/GENESIScoin)

---

## 🔒 Audit & Security

- All contracts are fully verified on **BscScan**.  
- Deployment via 20lab token generator.”- External third-party audit: **pending**.  
- Security features include:
  - Non-mintable total supply  
  - Manual-only auto-burn  
  - Excluded system addresses from dividend/airdrop trackers  
  - Max wallet and max transaction limits  
  - Event-driven bots enforcing payouts and governance  

---

## Contracts & License

| Contract           | Address                                      | SPDX License | Notes |
|--------------------|----------------------------------------------|--------------|-------|
| GENESIScoin.sol    | 0xb0ad142296952305679f691D646B3F9e3d589349   | No License   | Core token contract. Published for verification and audit purposes only. Reuse not permitted. |
| PreSaleGENc.sol    | 0x44f03E1EC6BDEf231cA7B654E5EaeFc2D79E36fa   | MIT          | Pre-Sale contract. Open-source. |
| PublicSaleGENc.sol | 0x0C10f15B226526Bad708010C4632CFA1f6a44FC1   | MIT          | Public Sale contract. Open-source. |

### License Policy
- **MIT License** applies to PreSaleGENc.sol and PublicSaleGENc.sol.  
- **No License** applies to GENESIScoin.sol. This contract is released only for transparency and auditing purposes.  
- The repository is therefore **mixed-license**: MIT for sale modules, restricted license for the GEN core.  

### ABI

The Application Binary Interface (ABI) is not included in this repository.  
For transparency and accuracy, the verified ABI is always available directly via [BscScan](https://bscscan.com/token/0xb0ad142296952305679f691D646B3F9e3d589349) under the **Contract → Code** tab.  
This ensures developers always work with the canonical, verified interface.
---

> “GENc doesn’t ask for trust. It proves itself block by block.”  
> — DL. SYSROOT LOG 003 | SBA Formation 2025
