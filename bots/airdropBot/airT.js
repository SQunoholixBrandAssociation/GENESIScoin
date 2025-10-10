require("dotenv").config();
const fs = require("fs");
const { ethers } = require("ethers");

const EXCLUDED = process.env.EXCLUDED_ADDRESSES
  ? process.env.EXCLUDED_ADDRESSES.split(",").map(x => x.toLowerCase())
  : [];
const MIN_HOLD = ethers.utils.parseUnits("EXAMPLE", 18);
const LP_ADDRESS = process.env.LP_ADDRESS.toLowerCase();

const LAST_BLOCK_FILE = "lastProcessedBlock.json";
const TRACKED_FILE = "trackedHolders.json";
const provider = new ethers.providers.WebSocketProvider(process.env.WSS_URL); 

const token = new ethers.Contract(process.env.GEN_TOKEN_ADDRESS, [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function balanceOf(address account) view returns (uint256)"
], provider);

const presale = new ethers.Contract(process.env.PRE_SALE_ADDRESS, [
  "event TokensPurchased(address indexed buyer, uint256 tokensAmount, uint256 bonusAmount, uint256 totalHoldingAfter)",
  "event StageSoldOut(uint256 indexed stage, uint256 timestamp)",
  "event ForceStageCloseByOwner(uint256 stageId, uint256 tokensLeft, uint256 threshold, uint256 timestamp)",
  "event WhitelistClosed(uint256 timestamp)", 
  "function preSaleEndTime() view returns (uint256)",
  "function preSaleEnded() view returns (bool)"
], provider);

let tracked = {};
try {
  tracked = JSON.parse(fs.readFileSync(TRACKED_FILE));
} catch {
  tracked = {};
}

function save() {
  fs.writeFileSync(TRACKED_FILE, JSON.stringify(tracked, null, 2));
}

function addHolder(address, rawBalance) {
  address = address.toLowerCase();

    if (EXCLUDED.includes(address)) {
      console.log(`🚫 Ignored excluded address: ${address}`);
      return;
    }

  try {
    const balance = BigInt(rawBalance.toString()); 
    console.log(`📦 Checking ${address} balance: ${balance}`);
    console.log(`🧮 Required: ${MIN_HOLD.toString()} | Has: ${balance.toString()}`);

    if (balance >= BigInt(MIN_HOLD.toString())) {
      tracked[address] = {
        balance: balance.toString(),
        timestamp: Date.now()
      };
      save();
      console.log(`✅ Holder added: ${address}`);
    } else {
      console.log(`⛔ Not eligible: ${address}`);
    }
  } catch (err) {
    console.error(`❌ addHolder error for ${address}: ${err.message}`);
  }
}

function loadLastProcessedBlock() {
  try {
    const data = fs.readFileSync(LAST_BLOCK_FILE, "utf8");
    return parseInt(JSON.parse(data).lastProcessedBlock);
  } catch {
    return null;
  }
}

function saveLastProcessedBlock(blockNumber) {
  fs.writeFileSync(LAST_BLOCK_FILE, JSON.stringify({ lastProcessedBlock: blockNumber }, null, 2));
}

async function processPastTransfers(fromBlock) {
  console.log(`📜 Syncing past transfers from block ${fromBlock}...`);
  const events = await token.queryFilter("Transfer", fromBlock, "latest");

  for (const event of events) {
    const { from, to } = event.args;
    const blockNumber = event.blockNumber;

    const addresses = new Set();
    if (from !== ethers.constants.AddressZero) addresses.add(from);
    if (to !== ethers.constants.AddressZero) addresses.add(to);

    for (const addr of addresses) {
      try {
        const balance = await token.balanceOf(addr);
        addHolder(addr, balance);
      } catch (err) {
        console.warn(`⚠️ Failed to fetch balance for ${addr}`);
      }
    }

    saveLastProcessedBlock(blockNumber);
  }
}

(async () => {
  try {
    const presaleEndTime = await presale.preSaleEndTime();
    const isPresaleEnded = await presale.preSaleEnded();
    const startBlock = loadLastProcessedBlock() || await provider.getBlockNumber();
    await processPastTransfers(startBlock + 1);


    if (isPresaleEnded && !presaleEndTime.eq(0)) {
      console.log("🔁 Pre-sale ended — switching to post-sale mode.");
      startPostSaleTracking();
    } else {
      console.log("🔥 Pre-sale active — listening for TokensPurchased events.");
      startPresaleTracking();
    }
  } catch (err) {
    console.error("❌ Error while checking pre-sale status:", err.message);
  }
})();


function startPresaleTracking() {
  presale.on("TokensPurchased", (buyer, amount, bonus, totalHold) => {
    console.log("🎯 EVENT: TokensPurchased");
    addHolder(buyer, totalHold);
  });

  presale.on("StageSoldOut", (stage) => {
    console.log(`⚠️ Stage ${stage} sold out.`);
  });

  presale.on("ForceStageCloseByOwner", (stage, left, threshold, timestamp) => {
    console.log(`⚠️ Stage ${stage} force-closed by owner.`);
  });

  presale.on("WhitelistClosed", (timestamp) => {
    console.log(`🔐 Whitelist closed at ${timestamp}. Switching to post-sale tracking...`);
    startPostSaleTracking();
  });

}

function startPostSaleTracking () {
  const lp = process.env.LP_ADDRESS.toLowerCase();
  const min = BigInt(MIN_HOLD.toString());

  token.on('Transfer', async (from, to, value) => {
    const fromLC = from.toLowerCase();
    const toLC   = to.toLowerCase();

    const trackedFrom = !!tracked[fromLC];
    const trackedTo   = !!tracked[toLC];

    if (!trackedTo && fromLC === lp && !EXCLUDED.includes(toLC)) {
      try {
        const bal = BigInt((await token.balanceOf(toLC)).toString());

        if (bal >= min) {
          tracked[toLC] = { balance: bal.toString(), timestamp: Date.now() };
          save();
          console.log(`✅ New holder from LP: ${toLC} → ${bal}`);
        } else {
          console.log(`⛔ Ignored LP purchase (below MIN): ${toLC} → ${bal}`);
        }
      } catch (err) {
        console.warn(`⚠️ balanceOf error for ${toLC}: ${err.message}`);
      }
      return;
    }

    for (const addrLC of [fromLC, toLC]) {
      if (!tracked[addrLC] || EXCLUDED.includes(addrLC)) continue;

      try {
        const bal = BigInt((await token.balanceOf(addrLC)).toString());

        if (bal >= min) {
          tracked[addrLC].balance   = bal.toString();
          tracked[addrLC].timestamp = Date.now();
          console.log(`🔁 Updated: ${addrLC} → ${bal}`);
        } else {
          delete tracked[addrLC];
          console.log(`❌ Removed (below MIN): ${addrLC} → ${bal}`);
        }
        save();
      } catch (err) {
        console.warn(`⚠️ balanceOf error for ${addrLC}: ${err.message}`);
      }
    }
  });

  console.log("📈 Post-sale mode active – LP: add new, others: update/remove");
}



console.log("🚀 Airdrop Tracker is running via WebSocket...");