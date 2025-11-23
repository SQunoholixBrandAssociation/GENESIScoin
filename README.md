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

- **GENESIScoin (GENc)**  
  **Address:** [`0x8d9f95Dd624F581803e06652623897DfeCB82CA6`](https://bscscan.com/address/0x8d9f95Dd624F581803e06652623897DfeCB82CA6)  
  **Source:** [`contracts/GENESIScoin.sol`](contracts/GENESIScoin.sol) — byte-identical to verified code.

- **PreSaleGENc**  
  **Address:** [`0x019A2D76D825914B5b52552e1A1D09F024CC4C58`](https://bscscan.com/address/0x019A2D76D825914B5b52552e1A1D09F024CC4C58)  
  **Source:** [`contracts/PreSaleModule.sol`](contracts/PreSaleModule.sol)

- **PublicSaleGENc**  
  **Address:** [`0x74eb74d66e8bd29226228536307BF5588168A8b7`](https://bscscan.com/address/0x74eb74d66e8bd29226228536307BF5588168A8b7)  
  **Source:** [`contracts/PublicSaleModule.sol`](contracts/PublicSaleModule.sol)

- **AssetManager (AM)**  
  **Address:** [`0x673eC5B98bC6d8A3b633F8D900B4C0832850423D`](https://bscscan.com/address/0x673eC5B98bC6d8A3b633F8D900B4C0832850423D)  
  **Source:** [`contracts/AssetManager.sol`](contracts/AssetManager.sol)

---

## Key Features

- **Fixed Supply:** 100,000,000,000 GENc (non-mintable).  
- **Tokenomics:** Modular Tax Model v1.0 (Buy 7% / Sell 10% / Transfer 2%).  
- **Auto-Burn:** Disabled by default, manually triggerable.  
- **Liquidity Injection:** Dynamic LP funding system.  
- **Dual Dividend System:**  
  - Rewards in BNB from transaction taxes.  
  - DividendGENc Pool with progressive cycle logic.  
- **B100D Loyalty Program:** 100 days of daily GENc payouts + proportional final bonus.  
- **Public Sale Bonus:** 4 phases, daily bonus with rollover logic.  
- **Airdrop System:** Up to 5B GENc distributed via tracker (`airT`) and console (`airdropConsole`).  

---

## Repository Structure

- **contracts/** – GENc, Pre-Sale, and Public-Sale smart contracts.  
- **docs/** – Official documentation:  
  - *WhitePaper_GENESIScoin.pdf*  
  - *TechnicalMechanics_GENESIScoin.pdf*
  - *SystemLayer_GENESIScoin.pdf*
  - *Lock&Vesting_GENESIScoin.pdf*
  - *ITL vs GENc — Theory Proven On-Chain.pdf*
- **assets/** – Logos and graphical materials.  
- **scripts/** – Auxiliary files (Hardhat, automation).  

---

## Autonomous Bots

The GENESIScoin ecosystem operates through a set of autonomous, event-driven bots that interact with the verified smart contracts on Binance Smart Chain.
Each bot performs a specific, permission-bounded function such as Oracle control, dividend verification, airdrop distribution, or loyalty tracking — forming the off-chain automation layer of the System Layer.

Full directory structure and bot-level documentation are available in:
➡️ /bots/README.md

Note: Source files include intentional placeholders and redacted logic to protect the internal automation architecture of the SBA Digital LAB system.
For security review or audit requests, contact:
📧 genesis@squnoholix.com
📧 sba@squnoholix.com

## Documentation

- [White Paper](docs/WhitePaper_GENESIScoin.pdf) – vision, tokenomics, governance.  
- [Technical Mechanics](docs/TechnicalMechanics_GENESIScoin.pdf) – full contract and bot logic.
- [System Layer](/docs/SystemLayer_GENESIScoin.pdf) – Full breakdown of the architecture, automation, and verified autonomy layers.
- [Lock & Vesting](docs/Lock&Vesting_GENESIScoin.pdf) – allocations, lock mechanics, and release schedules.
- [ITL vs GENc](docs/ITL%20vs%20GENc%20%E2%80%94%20Theory%20Proven%20On-Chain.pdf) – Comparative paper bridging theoretical Internet Trust Layer (ITL) with on-chain implementation in GENESIScoin.

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

- Main: [squnoholix.com](https://squnoholix.com)  
- GENESIScoin: [squnoholix.com/genesiscoin](https://squnoholix.com/genesiscoin)  
- Pre-Sale: [squnoholix.com/gencoin](https://squnoholix.com/gencoin)  
- SBA Digital LAB: [squnoholix.com/sbadl](https://squnoholix.com/sbadl)  
- Official InfoDocs portal: [squnoholix.com/infodocs](https://squnoholix.com/infodocs)

---

## SBA Digital LAB — Core Team

| Role                                 | Handle / Contact                           |
|--------------------------------------|--------------------------------------------|
| SQUNO — Founder, System Architect    | TG: [@Squnoholix](https://t.me/Squnoholix) |
| AURON — Systems Engineer, Logic Lead | TG: [@AuronSBA](https://t.me/AuronSBA)     |
| SERAYA — Head of Communication       | TG: [@SerayaSBA](https://t.me/SerayaSBA)   |

## HQ Council — Community Layer

| Name      | Role                                      | Contact                                      |
|-----------|-------------------------------------------|----------------------------------------------|
| ZEEZHAY   | Admin · Comms & Ops                       | TG: [@zeezhay1](https://t.me/zeezhay1)       |
| H3NZO     | Ops & Sync · Admin                        | TG: [@H3NZO_THE_GREAT1](https://t.me/H3NZO_THE_GREAT1) |
| FUTURISTIC| Expansion Driver & Outreach               | TG: [@wissy_041](https://t.me/wissy_041)     |
| MNX       | Comms & Outreach                          | TG: [@Mi_ister](https://t.me/Mi_ister)       |
| OXNICK    | Comms Flow · Lead & Sync                  | TG: [@sacredgems](https://t.me/sacredgems)   |

---

## License

This repository does **not** provide an open-source license.

You are free to **view** the documentation, PDFs, images, and code samples,  
but **no part of this repository may be copied, forked, reused, modified, or redistributed**  
without explicit written permission from SQUNOHOLIX BRAND ASSOCIATION Digital LAB.

### Smart Contracts
The verified smart contracts (GENESIScoin, PreSale, PublicSale, AssetManager):
- are published **exclusively for transparency and audit purposes**,  
- are **not licensed for reuse**,  
- and **cannot be deployed, forked, or adapted** in any form.

This restriction is intentional to preserve system integrity and protect  
the autonomous architecture of the GENESIScoin ecosystem.

