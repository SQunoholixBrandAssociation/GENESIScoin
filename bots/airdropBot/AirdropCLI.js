require("dotenv").config();
const fs = require("fs");
const readline = require("readline");
const ethers = require("ethers");


const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);


const TOKEN_ADDRESS = process.env.GEN_TOKEN_ADDRESS;
const CONTRACT_ADDRESS = process.env.PUBLIC_SALE_ADDRESS;

const GEN_ABI = [
  {
    name: "PLACEHOLDER",
    type: "PLACEHOLDER",
    stateMutability: "view",
    inputs: [{ name: "PLACEHOLDER", type: "PLACEHOLDER" }],
    outputs: [{ name: "PLACEHOLDER", type: "uint256" }]
  }
];

const AIRDROP_ABI = [
  {
    name: "PLACEHOLDER",
    type: "PLACEHOLDER",
    stateMutability: "nonpayable",
    inputs: [
      { name: "PLACEHOLDER", type: "PLACEHOLDER" },
      { name: "PLACEHOLDER", type: "uint256[]" }
    ],
    outputs: []
  },
  {
    name: "PLACEHOLDER",
    type: "PLACEHOLDER",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function loadHolders() {
  try {
    const raw = fs.readFileSync("trackedHolders.json");
    const data = JSON.parse(raw);
    if (typeof data !== "object" || Array.isArray(data)) {
      throw new Error("❌ Invalid format in trackedHolders.json");
    }
    return data;
  } catch (e) {
    console.error("❌ Could not load holders list:", e.message);
    process.exit(1);
  }
}

async function getBalances(addresses, token) {
  const results = [];
  for (const addr of addresses) {
    try {
      const bal = await token.balanceOf(addr);
      results.push({ addr, bal: ethers.BigNumber.from(bal.toString()) });
    } catch {
      console.warn(`⚠️ Could not fetch balance for ${addr}`);
    }
  }
  return results;
}

async function runProportional() {
  const min = await ask("Enter minimum holding required: ");
  const minHold = ethers.utils.parseUnits(min, 18);

  const token = new ethers.Contract(TOKEN_ADDRESS, GEN_ABI, provider);
  const airdrop = new ethers.Contract(CONTRACT_ADDRESS, AIRDROP_ABI, wallet);
  const pool = await airdrop.airdropPoolGENc();

  const holders = loadHolders();
  const balances = await getBalances(Object.keys(holders), token);
  const eligible = balances.filter((h) => h.bal.gte(minHold));
  const total = eligible.reduce((sum, h) => sum.add(h.bal), ethers.BigNumber.from("0"));

  if (eligible.length === 0) return console.log("❌ No eligible addresses.");

  const recipients = eligible.map((h) => h.addr);
  const amounts = eligible.map((h) => h.bal.mul(pool).div(total));

  console.log(`✅ Sending total: ${ethers.utils.formatUnits(pool)} GENc`);
  console.log(`📤 Eligible: ${recipients.length} wallets`);

  await sendInBatches(airdrop, recipients, amounts);
}

async function runFixed() {
  const min = await ask("Enter minimum holding required: ");
  const fixed = await ask("Enter amount per wallet: ");
  const minHold = ethers.utils.parseUnits(min, 18);
  const fixedAmount = ethers.utils.parseUnits(fixed, 18);

  const token = new ethers.Contract(TOKEN_ADDRESS, GEN_ABI, provider);
  const airdrop = new ethers.Contract(CONTRACT_ADDRESS, AIRDROP_ABI, wallet);
  const holders = loadHolders();
  const balances = await getBalances(Object.keys(holders), token);
  const eligible = balances.filter((h) => h.bal.gte(minHold));
  const totalNeeded = fixedAmount.mul(ethers.BigNumber.from(eligible.length));

  console.log(`🧾 Required pool: ${ethers.utils.formatUnits(totalNeeded)} GENc for ${eligible.length } users.`);
  await ask("💬 Press ENTER after pool is funded...");

  const pool = await airdrop.airdropPoolGENc();
  if (pool.lt(totalNeeded)) return console.log("❌ Pool too small. Aborting.");

  const recipients = eligible.map((h) => h.addr);
  const amounts = recipients.map(() => fixedAmount);

  await sendInBatches(airdrop, recipients, amounts);
}

async function sendInBatches(contract, recipients, amounts) {
  const BATCH = 50;
  const logs = [];

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batchRecipients = recipients.slice(i, i + BATCH);
    const batchAmounts = amounts.slice(i, i + BATCH);
    try {
      const tx = await contract.airdropByList(batchRecipients, batchAmounts);
      console.log(`🚀 Batch sent (${batchRecipients.length}): ${tx.hash}`);
      logs.push({ batch: i / BATCH + 1, txHash: tx.hash, recipients: batchRecipients });
      await tx.wait();
    } catch (e) {
      console.error(`❌ TX failed: ${e.message}`);
    }
    await new Promise((res) => setTimeout(res, 1000));
  }

  fs.writeFileSync("airdropLog.json", JSON.stringify(logs, null, 2));
  rl.close();
}

async function main() {
  console.log("🎯 Select airdrop mode:");
  console.log("1) Proportional");
  console.log("2) Fixed amount");

  const choice = await ask("Enter 1 or 2: ");
  if (choice === "1") await runProportional();
  else if (choice === "2") await runFixed();
  else console.log("❌ Invalid choice");

  rl.close();
}

main();