# GENESIScoin — Autonomous Bots System

This directory contains the automation layer of the **GENESIScoin (GENc)** ecosystem.

The bots are independent Node.js processes responsible for monitoring blockchain state, maintaining required operational datasets, and executing predefined smart-contract functions when protocol conditions are satisfied.

The system is designed so that **core protocol state and funds remain on-chain**, while the automation layer handles monitoring, verification, timing, and execution flow.

---

## System Overview

Each bot operates independently and connects to the blockchain through RPC / WebSocket providers.

Depending on the module, bots may perform:

- event monitoring
- state tracking
- off-chain verification
- cycle management
- batch preparation
- contract execution

Most modules are event-driven.  
Some modules additionally use timed or polling logic where continuous state verification is required.

Bots do not control each other.  
Each module derives its actions directly from **blockchain state** and its own operational context.

---

## Architecture Principle

The GENESIScoin automation layer is **not purely passive**.

Some bots act mainly as watchers and execution triggers.  
Other bots maintain local runtime state and perform off-chain operational logic required for deterministic execution.

The smart contracts remain the source of truth for:

- balances
- pools
- vesting state
- final execution validity
- reward distribution

The automation layer exists to ensure that this logic can be executed continuously and consistently in production.

---

## Bots Overview

| Bot | Files | Description |
|-----|------|-------------|
| **oracleBot** | `oracle.js` | Timed lifecycle bot for PreSale and Public Sale. Updates BNB price, closes stages, triggers whitelist open/close, starts B100D, triggers daily B100D payouts, distributes PreSale funds, and starts Public Sale. |
| **airdropBot** | `airT.js`, `AirdropCLI.js` | Airdrop infrastructure. `airT` tracks eligible holders and maintains the local holder dataset. `AirdropCLI` is a manual execution tool that distributes tokens from the contract airdrop pool. |
| **dividendBot** | `divT.js`, `divV.js` | Dividend infrastructure. `divT` tracks eligible holders. `divV` maintains dividend-cycle state, snapshots, payout metadata and holder verification logic, calculates reward progression and payout batches, then triggers on-chain distribution. |
| **eligibleBot** | `eliB.js` | Public Sale bonus bot. Maintains local bonus state, phase logic, rollover state and daily tracking, and triggers daily bonus execution for qualifying LP purchases. |
| **b100dBot** | `b100d.js` | B100D monitoring bot. Stores `initialHold` for each participant, continuously verifies tracked addresses after B100D start, and triggers `ejectFromWhitelist(address)` when balance drops below the recorded initial hold. |
| **finalBBot** | `finB.js` | Final B100D bonus bot. Watches B100D completion state, applies final delay logic, reacts to final bonus events, and triggers final bonus distribution. |
| **generalBot** | `generalAM.js` | AssetManager V1 vesting bot. Waits for `WhitelistClosed`, initializes vesting start if needed, checks configured pools, and releases vesting steps when due. |
| **v2GENERAL** | `v2GENERAL.js` | AssetManager V2 stage bot. Evaluates PreSale stage state, executes `releaseStage()` or `releaseStageFail()` depending on stage conditions, and persists proof-oriented local execution history. |

---
## Runtime State

Some bots maintain local runtime files for persistence, recovery and operational continuity across restarts.

Examples include:

```text
trackedHolders.json
lastProcessedBlock.json
dividend-users.json
cycle-metadata.json
cycle-payout.json
verifier-state.json
bonus-daily.json
phase-state.json
b100dParticipants.json
amv2_general_state.json
```
These files **do not represent custody of protocol funds**.

Instead, they store operational datasets required for deterministic execution and system continuity, including:

tracked holder datasets

dividend cycle history

payout metadata

participant state

phase and bonus accounting

pending execution verification

This runtime layer allows automation modules to restart safely without rebuilding the full operational context from blockchain history.

All protocol balances, permissions, and final state transitions remain enforced by smart contracts on-chain.
---

## Execution Model

The bots do not all operate in the same way.

### Trigger-oriented modules

These primarily observe on-chain state and execute contract calls when protocol conditions become valid.

Examples:

- `oracle.js`
- `generalAM.js`
- `finB.js`
- `v2GENERAL.js`

### Stateful tracking modules

These maintain local datasets used for eligibility and operational continuity.

Examples:

- `airT.js`
- `divT.js`
- `b100d.js`

### Verification and execution modules

These maintain runtime state and also perform off-chain operational logic before triggering on-chain functions.

Examples:

- `eliB.js`
- `divV.js`

---

## Important Notes

### eligibleBot

`eliB.js` contains a significant part of the Public Sale bonus execution logic off-chain.

It maintains:

- current phase context
- daily bonus tracking
- reset scheduling
- rollover accounting
- per-phase logs
- effective cap calculation

The smart contract enforces the final on-chain constraints such as:

- current day
- bonus type
- daily cap
- whether a given address already received the bonus

### dividendBot

`divV.js` is not only a trigger bot.

It manages:

- cycle creation
- snapshot state
- balance monitoring
- ejection logic
- progression calculation
- payout batch construction
- payout logging

The smart contract performs the final token distribution from the dividend pool, but the cycle verification layer is maintained off-chain by the verifier bot.

### b100dBot

`b100d.js` mirrors the participant dataset defined by the smart contract, including the recorded `initialHold` for each registered address. Once the B100D phase becomes active, it continuously verifies balances and triggers `ejectFromWhitelist(address)` when a participant drops below the required holding threshold.

---

## Security Model

The automation layer is not a custody layer.

Bots may send transactions, but they do not own the protocol pools they operate on.

All balances and final state transitions remain under smart-contract control.

If a bot stops running:

- funds remain on-chain
- protocol state remains valid
- automation can resume after restart
- execution continuity is recovered using blockchain state and local runtime files

---

## Environment Configuration

Each bot requires a `.env` configuration file containing the necessary endpoints, addresses and operational parameters.

Typical variables include:

```text
RPC_URL
WSS_URL
PRIVATE_KEY
GEN_TOKEN_ADDRESS
PRE_SALE_ADDRESS
PUBLIC_SALE_ADDRESS
LP_ADDRESS
ASSET_MANAGER_ADDRESS
AMV2_ADDRESS
