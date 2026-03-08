require("dotenv").config();
const fs = require("fs");
const { ethers } = require("ethers");

const provider = new ethers.providers.WebSocketProvider(process.env.WSS_URL);
const LP_ADDRESS = process.env.LP_ADDRESS.toLowerCase();
const MIN_HOLD = ethers.utils.parseUnits(process.env.MIN_HOLD || "5000000", 18);
const EXCLUDED = (process.env.EXCLUDED_ADDRESSES || "")
  .split(",")
  .map(a => a.trim().toLowerCase());

const USERS_FILE = "dividend-users.json";
const LAST_BLOCK_FILE = "lastProcessedBlock.json";

let users = {};
try { users = JSON.parse(fs.readFileSync(USERS_FILE)); } catch { users = {}; }

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveLastProcessedBlock(block) {
  fs.writeFileSync(LAST_BLOCK_FILE, JSON.stringify({ lastProcessedBlock: block }, null, 2));
}

function loadLastProcessedBlock() {
  try {
    return JSON.parse(fs.readFileSync(LAST_BLOCK_FILE)).lastProcessedBlock;
  } catch {
    return null;
  }
}

function isExcluded(address) {
  return EXCLUDED.includes(address.toLowerCase());
}

async function updateHolder(addr) {
  if (isExcluded(addr)) {
    console.log(`⛔ Excluded address skipped: ${addr}`);
    return;
  }

  try {
    const balanceRaw = await GEN.balanceOf(addr);
    const balance = BigInt(balanceRaw.toString());
    const min = BigInt(MIN_HOLD.toString());

    if (balance >= min) {
      const isNew = !users[addr];
      users[addr] = {
        balance: balance.toString(),
        lastUpdated: Date.now()
      };
      console.log(`${isNew ? "✅ New holder" : "🔁 Updated"}: ${addr} → ${balance.toString()}`);
      saveUsers();
    } else if (users[addr]) {
      delete users[addr];
      console.log(`❌ Removed (below MIN_HOLD): ${addr}`);
      saveUsers();
    } else {
      console.log(`⛔ Not eligible: ${addr} → ${balance.toString()}`);
    }
  } catch (err) {
    console.warn(`⚠️ updateHolder error: ${addr} — ${err.message}`);
  }
}

const GEN = new ethers.Contract(process.env.GEN_TOKEN_ADDRESS, [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function balanceOf(address) view returns (uint256)"
], provider);

const PRESALE = new ethers.Contract(process.env.PRE_SALE_ADDRESS, [
  "event TokensPurchased(address indexed buyer, uint256, uint256, uint256)",
  "event StageSoldOut(uint256, uint256)",
  "event ForceStageCloseByOwner(uint256, uint256, uint256, uint256)",
  "event WhitelistClosed(uint256 timestamp)",
  "function preSaleEndTime() view returns (uint256)",
  "function preSaleEnded() view returns (bool)"
], provider);

async function processPastTransfers(fromBlock) {
  console.log(`🔁 Syncing past transfers from block ${fromBlock}`);
  try {
    const events = await GEN.queryFilter("Transfer", fromBlock, "latest");

    const addresses = new Set();
    for (const e of events) {
      console.log(`📦 Transfer: ${e.args.from} → ${e.args.to}`);
      if (!isExcluded(e.args.from)) addresses.add(e.args.from);
      if (!isExcluded(e.args.to)) addresses.add(e.args.to);
      saveLastProcessedBlock(e.blockNumber);
    }

    for (const addr of addresses) {
      await updateHolder(addr);
    }
  } catch (err) {
    console.error(`❌ Failed to query past transfers: ${err.message}`);
  }
}

function startPresaleTracking() {
  PRESALE.on("TokensPurchased", async (buyer, _, __, totalAfter) => {
    if (isExcluded(buyer)) return;
    console.log(`🎯 TokensPurchased by ${buyer}, total: ${totalAfter.toString()}`);
    await updateHolder(buyer);
  });
  console.log("📈 Presale mode active. Tracking TokensPurchased...");

  PRESALE.on("WhitelistClosed", (timestamp) => {
    console.log(`🔐 Whitelist closed at block time ${timestamp}. Switching to post-sale logic...`);
    startPostSaleTracking();
  });

}

function startPostSaleTracking() {
  const lpAddress = process.env.LP_ADDRESS.toLowerCase();  

  GEN.on("Transfer", async (from, to, value) => {
    const fromLC = from.toLowerCase();
    const toLC   = to.toLowerCase();

    const trackedFrom = Object.keys(users).some(a => a.toLowerCase() === fromLC);
    const trackedTo   = Object.keys(users).some(a => a.toLowerCase() === toLC);

    if (!trackedTo
        && fromLC === lpAddress
        && !isExcluded(to)) {
      console.log(`🛒 Purchase from LP: ${from} → ${to}, value: ${value.toString()}`);
      await updateHolder(to);    
      return;                   
    }

    if (trackedFrom && !isExcluded(from)) await updateHolder(from);
    if (trackedTo   && !isExcluded(to))   await updateHolder(to);
  });

  console.log("📈 Post-sale mode active. New users tracked only after LP purchase, all tracked addresses updated on transfer.");
}

// === INIT ===
(async () => {
  const fromBlock = loadLastProcessedBlock() || await provider.getBlockNumber();
  await processPastTransfers(fromBlock + 1);

  const preEnded = await PRESALE.preSaleEnded();
  const preEndTime = await PRESALE.preSaleEndTime();

  if (preEnded && preEndTime.gt(0)) {
    console.log("🔁 Pre-sale already ended. Starting post-sale tracking...");
    startPostSaleTracking();
  } else {
    console.log("⏳ Pre-sale ongoing. Starting pre-sale tracking...");
    startPresaleTracking();

    PRESALE.on("WhitelistClosed", (timestamp) => {
      console.log(`🔐 Whitelist closed at ${timestamp}. Switching to post-sale tracking...`);
      startPostSaleTracking();
    });
  }

  console.log("🚀 Dividend Tracker is running.");
})();
