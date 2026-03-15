<p align="center">
  <img src="assets/GENcoin_logo.png" alt="GENESIScoin logo" width="200"/>
</p>

## GENESIScoin (GENc)

**GENESIScoin (GENc)** is the flagship project of **SQUNOHOLIX BRAND ASSOCIATION Digital LAB**, operating on Binance Smart Chain with a **fixed supply of 100 billion GENc**.  
The contract is **strictly non-mintable** — no `_mint()` function exists, making GENc fully inflation-resistant.

---

## Trading Status (Official Notice)

Trading for GENESIScoin (GENc) is currently disabled by design.  
The token contract allows activation of trading only once, permanently.  
This safeguard ensures system integrity during the Pre-Sale and Whitelist phases.

Once the Oracle closes the Pre-Sale and the Whitelist period (24h) ends,  
the Public Sale Module will be initialized — and trading will be activated.  
After that moment, trading cannot be paused or disabled again.

---

## Contracts

| Contract | Address | Source |
|---|---|---|
| **GENESIScoin (GENc)** | [`0x8d9f95Dd624F581803e06652623897DfeCB82CA6`](https://bscscan.com/address/0x8d9f95Dd624F581803e06652623897DfeCB82CA6) | [`contracts/GENESIScoin.sol`](contracts/GENESIScoin.sol) |
| **PreSaleGENc** | [`0x019A2D76D825914B5b52552e1A1D09F024CC4C58`](https://bscscan.com/address/0x019A2D76D825914B5b52552e1A1D09F024CC4C58) | [`contracts/PreSaleModule.sol`](contracts/PreSaleModule.sol) |
| **PublicSaleGENc** | [`0x74eb74d66e8bd29226228536307BF5588168A8b7`](https://bscscan.com/address/0x74eb74d66e8bd29226228536307BF5588168A8b7) | [`contracts/PublicSaleModule.sol`](contracts/PublicSaleModule.sol) |
| **AssetManager** | [`0x673eC5B98bC6d8A3b633F8D900B4C0832850423D`](https://bscscan.com/address/0x673eC5B98bC6d8A3b633F8D900B4C0832850423D) | [`contracts/AssetMenager.sol`](contracts/AssetMenager.sol) |
| **AssetManager V2** | [`0xa0e6e93cfc4507fc2687fa3aa943f238c28bee97`](https://bscscan.com/address/0xa0e6e93cfc4507fc2687fa3aa943f238c28bee97) | [`contracts/AM v2.sol`](contracts/AM%20v2.sol) |
All contracts are verified on BscScan. Source files in this repository are byte-identical to deployed bytecode.

---

## RM Strategic Model — Release Modules

The **RM Strategic Model** is a series of 10 independent release modules (RM_01 – RM_10), each governing a **50,000,000 GENc** strategic allocation.  
Total allocation: **500,000,000 GENc** — sourced from the **AssetManager V2 Partners Pool**.

Each module operates autonomously: sealed, schedule-locked, and executed exclusively by a dedicated bot (`RM_BOT`).  
Release schedule per module: **TGE 20% (10M GENc) + 8 × 10% (5M GENc) every 30 days**.  
TGE timestamp is derived on-chain from `PreSaleGENc.b100dWhitelistCloseTime` — immutable after set.

The purpose of the RM series is the acquisition of **strategic partners** for the SQUNOHOLIX BRAND ASSOCIATION ecosystem.  
Each module represents a dedicated, verifiable allocation — proof of commitment before any partnership is announced.

| Module | Address | Status | Source |
|---|---|---|---|
| **RM_01** | [`0x40A830b22E4C39D16B8b17e8beD4ED0f7C29E547`](https://bscscan.com/address/0x40A830b22E4C39D16B8b17e8beD4ED0f7C29E547) | ✅ Deployed | [`contracts/RM01.sol`](contracts/RM01.sol) |
| **RM_02** | — | 🔜 Pending | — |
| **RM_03** | — | 🔜 Pending | — |
| **RM_04** | — | 🔜 Pending | — |
| **RM_05** | — | 🔜 Pending | — |
| **RM_06** | — | 🔜 Pending | — |
| **RM_07** | — | 🔜 Pending | — |
| **RM_08** | — | 🔜 Pending | — |
| **RM_09** | — | 🔜 Pending | — |
| **RM_10** | — | 🔜 Pending | — |

> Modules are deployed sequentially as strategic partners are onboarded.  
> Each deployment is a verifiable on-chain event — consistent with **#ProofBeforePromise**.

---

## Key Features

- **Fixed Supply:** 100,000,000,000 GENc — strictly non-mintable.
- **Tokenomics:** Modular Tax Model v1.0 — Buy 7% / Sell 10% / Transfer 2%.
- **Auto-Burn:** Disabled by default, manually triggerable.
- **Liquidity Injection:** Dynamic LP funding system.
- **Dual Dividend System:** BNB rewards from transaction taxes + DividendGENc Pool with progressive cycle logic.
- **B100D Loyalty Program:** 100 days of daily GENc payouts + proportional final bonus based on initial holding.
- **Public Sale Bonus:** 4 phases with daily bonus, per-wallet cap and rollover logic.
- **Airdrop System:** Up to 5B GENc distributed via automated bot infrastructure.
- **Strategic Allocation (RM_01):** 50M GENc release module — TGE 20% + 8 × 5M every 30 days, on-chain schedule referenced from PreSale close timestamp.
- **Vesting (AM / AM V2):** Multi-pool vesting with multisig 2-of-4, armed release with cliffs, milestone releases.

---

## Autonomous Bots System

The GENESIScoin ecosystem operates through a set of autonomous, event-driven bots running as independent Node.js processes on Binance Smart Chain.  
Core protocol state and funds remain on-chain at all times. The automation layer handles monitoring, verification, timing, and execution flow.

| Bot | Function |
|---|---|
| **oracleBot** | BNB price feed, stage closure, whitelist triggers, B100D orchestration, daily fund distribution |
| **b100dBot** | B100D participant tracking, daily payout synchronization |
| **finalBBot** | Final bonus trigger after B100D completion |
| **eligibleBot** | Public Sale daily bonus processing, 4-phase cap enforcement |
| **dividendBot** | Dividend verification and distribution |
| **airdropBot** | Airdrop list execution |
| **generalBot** | AssetManager release orchestration with persistent proof state |
| **v2General** | AssetManager V2 stage release automation |
| **RM-Bot** | RM_01 autonomous release — WS-connected, heartbeat, on-chain schedule |

Full documentation: [`/bots/README.md`](/bots/README.md)

> Note: Source files include intentional placeholders to protect the internal automation architecture of SBA Digital LAB.  
> For security review or audit requests: genesis@squnoholix.com

---

## Repository Structure

```
GENESIScoin/
├── assets/          — Logos and graphical materials
├── bots/            — Autonomous bot system (Node.js)
│   ├── RM-Bot/
│   ├── airdropBot/
│   ├── b100dBot/
│   ├── dividendBot/
│   ├── eligibleBot/
│   ├── finalBot/
│   ├── generalBot/
│   ├── oracleBot/
│   ├── v2General/
│   └── README.md
├── contracts/       — Verified smart contracts (Solidity)
│   ├── GENESIScoin.sol
│   ├── PreSaleModule.sol
│   ├── PublicSaleModule.sol
│   ├── AssetMenager.sol
│   ├── AM v2.sol
│   └── RM01.sol
├── docs/            — Official documentation (PDF)
├── scripts/         — Hardhat deployment scripts
└── README.md
```

---

## Documentation

| Document | Description |
|---|---|
| [White Paper](docs/WhitePaper_GENESIScoin.pdf) | Vision, tokenomics, governance |
| [Technical Mechanics](docs/TechnicalMechanics_GENESIScoin.pdf) | Full contract and bot logic |
| [System Layer](docs/SystemLayer_GENESIScoin.pdf) | Architecture, automation, and verified autonomy layers |
| [Lock & Vesting](docs/Lock&Vesting_GENESIScoin.pdf) | Allocations, lock mechanics, release schedules |
| [ITL vs GENc](docs/ITL%20vs%20GENc%20%E2%80%94%20Theory%20Proven%20On-Chain.pdf) | Internet Trust Layer theory vs. on-chain implementation |

---

## Community & Channels

- X (Twitter): [@GENcoinCore](https://x.com/GENcoinCore)
- Discord: [GENESIScoin Community](https://discord.gg/9q22NAVm)
- Telegram (Announcements): [SBAlaunch](https://t.me/SBAlaunch)
- Telegram (Discussion): [GENcAgora](https://t.me/GENcAgora)
- YouTube: [@SQUNOHOLIX_Impact](https://www.youtube.com/@SQUNOHOLIX_Impact)
- LinkedIn: [squno](https://www.linkedin.com/in/squno/)
- Medium: [SQUNOHOLIX Brand Association](https://medium.com/@squnoholix.brand.association)

---

## Contact

- 📧 genesis@squnoholix.com
- 📧 sba@squnoholix.com

---

## Website

| | |
|---|---|
| Main | [squnoholix.com](https://squnoholix.com) |
| GENESIScoin | [squnoholix.com/genesiscoin](https://squnoholix.com/genesiscoin) |
| Pre-Sale | [squnoholix.com/gencoin](https://squnoholix.com/gencoin) |
| SBA Digital LAB | [squnoholix.com/sbadl](https://squnoholix.com/sbadl) |
| InfoDocs | [squnoholix.com/infodocs](https://squnoholix.com/infodocs) |

---

## License

This repository is published for **transparency, public auditability, and community learning**.  
We encourage developers to study, reference, and build upon individual components of this system.

### ✅ What is permitted

**Using individual modules in your own project** — freely allowed.  
If you integrate a full module (e.g. `PublicSaleGENc`) into your project as-is, please include a note:
> *"This module originates from the [GENESIScoin repository](https://github.com/SQunoholixBrandAssociation/GENESIScoin) by SQUNOHOLIX BRAND ASSOCIATION Digital LAB."*

**Extracting and adapting specific functions** — allowed without restriction.  
Attribution is not required but always appreciated. If you extend or integrate a component in an unusual or non-standard way, we'd genuinely appreciate you sharing the use case or schema once complete — not required, but valued.

**Educational use, research, citations** — freely allowed with attribution to **SQUNOHOLIX BRAND ASSOCIATION Digital LAB**.

### ❌ What is explicitly prohibited

**Reproducing the GENESIScoin system as a competing token project** — this is where the line is.

Using a single module in your project ≠ problem. Becoming the next GENESIScoin under a different name = problem.

### Licensing & collaboration

If you are interested in a formal license, integration, or partnership:  
📧 genesis@squnoholix.com

> SQUNOHOLIX BRAND ASSOCIATION Digital LAB reserves all intellectual property rights  
> over the GENESIScoin system architecture, tokenomics design, and automation layer.
