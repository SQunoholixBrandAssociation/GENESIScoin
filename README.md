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

📑 System Allocation Addresses (BSC Mainnet)

All initial allocations (1,000,000,000,000 GENc) are distributed to predefined system wallets.  
These addresses are excluded from dividends, airdrops, and bonus eligibility.

| Role / Allocation     | Address                                    | Notes              |
|-----------------------|--------------------------------------------|--------------------|
| Owner (no fee)        | 0x969E4A73407684495d6EaF7e2db2B1A9b7265652 | GENc Owner         |
| Deployer (no fee)     | 0xE16888dc939e3fE0837A4DF6e8B54615823E37B3 | Deployer wallet    |
| DevG                  | 0xF744D5516026abb2F62A2D37b8846488894B5485 | Development        |
| TeamG                 | 0xBBb1d5323e89bafCF41e1ff1695ce4bE7b07eea5 | Team allocation    |
| LP                    | 0x436945Ec6b1d8d64b6081d403B704d6850BbA71C | Liquidity pool     |
| Marketing             | 0x49a94bc3a17E857dC2f0DE1fd4Dc7cdF8115967a | Marketing fund     |
| Community             | 0xBC6b28715e4c9fe375110ce1D894dFDE41F04D4C | Community fund     |
| Secure / Audit        | 0x3B9fA0D1069CE2c77b47116EF0bFee459FeA2F28 | Security reserve   |
| Level UP              | 0xF637f2cfb94155D0fDf38D867d3B7A09b6C1d69e | Future scaling     |
| Project Expansion     | 0x5718dAacFe5dEbd008715aFB492CbdcfC8e14b53 | Expansion fund     |
| B100D Fee - gas Ops   | 0xE1a86188C2FCc15B4D92526bC5bb4694De2EC9b3 | Ops gas reserve    |
| Burn                  | 0x544d271A6148bC360c881fB13DcDd184db73e00b | Burn wallet        |
| Dividend Pool         | 0xF20b08f5912F88248a6B14641240E47e6D7Ecf43 | BNB dividends      |
| Airdrop Pool          | 0x4360F93ad9aAC1AA1a3A88cbA5E4413B864510c6 | Airdrops           |
| LP Backup             | 0xe3CAD52409d75B19D328FC106654054EF474Edef | Reserve LP         |
| LP Main               | 0xAa8C86ab32f38b39da1a93ab52F0f62Ba41d5108 | Primary LP         |
| Future Project / SBA  | 0x36B7F9d8aAEA18EE6C3beD5c8AB22B3c570794C3 | SBA exp./GENc evol.|
| Project Partners      | 0x9CBFB132eB3101c211ed831e611248dF16156b9E | Partnerships       |
| Event / Expo          | 0x641B8885776D2DaeB74CFD2e26F1F5ac79a2fACF | Events, expos      |
| DevG GENc             | 0xEc73057B30F89465d20a8E690E2905eA515EabFc | Development GENc   |
| TeamG GENc            | 0x2C09f7Cd841FdE308Ab823745d25649A6Ef8469A | Team GENc          |
| Marketing GENc        | 0x74b56c00aD719F39D84d1d01A496F1df3866d44E | Marketing GENc     |

🔒 All above are **excluded** from dividend/airdrop trackers and marked as `nofee` system addresses.

⏳ Current Status
All allocation funds are already in their destination wallets.
A 3-month lock on system allocation wallets is planned, giving enough time to deliver the first version of the Asset Manager — taking over custody and timed releases.

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
