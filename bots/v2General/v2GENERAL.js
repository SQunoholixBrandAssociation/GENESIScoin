require("dotenv").config();
const fs = require("fs");
const path = require("path");
const Web3 = require("web3");

// =====================
// ENV
// =====================
const BSC_RPC_URL = process.env.BSC_RPC_URL;
const GENERAL_PRIVATE_KEY = process.env.GENERAL_PRIVATE_KEY;
const PRE_SALE_ADDRESS = process.env.PRE_SALE_ADDRESS;
const AMV2_ADDRESS = process.env.AMV2_ADDRESS;

const LOOP_SECONDS = parseInt(process.env.LOOP_SECONDS || "10800", 10);
const GAS_LIMIT_RELEASE = parseInt(process.env.GAS_LIMIT_RELEASE || "550000", 10);
const GAS_LIMIT_FAIL = parseInt(process.env.GAS_LIMIT_FAIL || "650000", 10);

const GAS_PRICE_GWEI = process.env.GAS_PRICE_GWEI ? String(process.env.GAS_PRICE_GWEI) : "";
const RPC_TIMEOUT_MS = parseInt(process.env.RPC_TIMEOUT_MS || "12000", 10);
const SEND_TIMEOUT_MS = parseInt(process.env.SEND_TIMEOUT_MS || "120000", 10);

const HISTORY_MAX = parseInt(process.env.HISTORY_MAX || "200", 10);

if (!BSC_RPC_URL || !GENERAL_PRIVATE_KEY || !PRE_SALE_ADDRESS || !AMV2_ADDRESS) {
  console.error("Missing env. Required: BSC_RPC_URL, GENERAL_PRIVATE_KEY, PRE_SALE_ADDRESS, AMV2_ADDRESS");
  process.exit(1);
}

// =====================
// WEB3
// =====================
const web3 = new Web3(new Web3.providers.HttpProvider(BSC_RPC_URL, { timeout: RPC_TIMEOUT_MS }));
const generalAccount = web3.eth.accounts.privateKeyToAccount(GENERAL_PRIVATE_KEY);
web3.eth.accounts.wallet.add(generalAccount);
web3.eth.defaultAccount = generalAccount.address;

// =====================
// ABIs (minimal)
// =====================
const preSaleAbi = [
  {
    inputs: [],
    name: "preSaleEnded",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "stages",
    outputs: [
      { internalType: "uint256", name: "tokensAvailable", type: "uint256" },
      { internalType: "uint256", name: "tokenPrice", type: "uint256" },
      { internalType: "uint256", name: "bonusPercent", type: "uint256" },
      { internalType: "uint256", name: "tokensSold", type: "uint256" },
      { internalType: "uint256", name: "duration", type: "uint256" },
      { internalType: "uint256", name: "startTime", type: "uint256" },
      { internalType: "bool", name: "isActive", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const amv2Abi = [
  {
    inputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    name: "releasedStage",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint8", name: "stageId", type: "uint8" },
      { internalType: "bytes32", name: "metaHash", type: "bytes32" },
    ],
    name: "releaseStage",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint8", name: "stageId", type: "uint8" },
      { internalType: "bytes32", name: "metaHash", type: "bytes32" },
    ],
    name: "releaseStageFail",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// =====================
// CONTRACTS
// =====================
const preSale = new web3.eth.Contract(preSaleAbi, PRE_SALE_ADDRESS);
const amv2 = new web3.eth.Contract(amv2Abi, AMV2_ADDRESS);

// =====================
// STATE (persistent proof)
// =====================
const STATE_PATH = path.join(__dirname, "amv2_general_state.json");

function defaultState() {
  return {
    pending: { active: false, stageId: 0, action: "", txHash: "", sentAt: 0 },
    lastTx: { stageId: 0, action: "", txHash: "", at: 0, metaHash: "", context: {}, status: "" },
    history: [],
    lastLoopTs: 0,
  };
}

function loadState() {
  try {
    const st = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    if (!st?.pending) return defaultState();
    if (!st.lastTx) st.lastTx = defaultState().lastTx;
    if (!Array.isArray(st.history)) st.history = [];
    return st;
  } catch {
    return defaultState();
  }
}

function saveState(st) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(st, null, 2));
}

let state = loadState();

// =====================
// UTILS
// =====================
function log(msg, ...args) {
  console.log(`[${new Date().toISOString()}] ${msg}`, ...args);
}
function bn(x) {
  return web3.utils.toBN(x);
}
function nowSec() {
  return Math.floor(Date.now() / 1000);
}
function fmtTs(sec) {
  if (!sec || sec <= 0) return "0";
  return `${sec} (${new Date(sec * 1000).toISOString()})`;
}
function pctSold(soldBN, availBN) {
  if (!availBN || availBN.isZero()) return "0.00";
  const p100 = soldBN.mul(bn(10000)).div(availBN);
  const whole = p100.div(bn(100)).toString();
  const dec = p100.mod(bn(100)).toString().padStart(2, "0");
  return `${whole}.${dec}`;
}

async function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => (t = setTimeout(() => rej(new Error(`TIMEOUT:${label}`)), ms)));
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

async function getGasPriceWei() {
  if (GAS_PRICE_GWEI && GAS_PRICE_GWEI.trim() !== "") return web3.utils.toWei(GAS_PRICE_GWEI.trim(), "gwei");
  return await withTimeout(web3.eth.getGasPrice(), RPC_TIMEOUT_MS, "getGasPrice");
}

async function getNoncePending() {
  return await withTimeout(
    web3.eth.getTransactionCount(generalAccount.address, "pending"),
    RPC_TIMEOUT_MS,
    "getNoncePending"
  );
}

function makeMetaHash(obj) {
  return web3.utils.keccak256(JSON.stringify(obj));
}

function pushHistory(rec) {
  state.history = Array.isArray(state.history) ? state.history : [];
  state.history.push(rec);
  if (state.history.length > HISTORY_MAX) state.history = state.history.slice(-HISTORY_MAX);
  state.lastTx = rec;
  saveState(state);
}

async function readStage(stageId) {
  const s = await withTimeout(preSale.methods.stages(stageId).call(), RPC_TIMEOUT_MS, `stages(${stageId})`);
  return {
    tokensAvailable: bn(s.tokensAvailable),
    tokensSold: bn(s.tokensSold),
    duration: bn(s.duration),
    startTime: bn(s.startTime),
    isActive: !!s.isActive,
  };
}

async function isReleased(stageId) {
  return await withTimeout(amv2.methods.releasedStage(stageId).call(), RPC_TIMEOUT_MS, `releasedStage(${stageId})`);
}

function deadlineOf(stage) {
  return parseInt(stage.startTime.add(stage.duration).toString(), 10);
}

function halfOf(availBN) {
  return availBN.div(bn(2));
}

async function logStage(stageId, st) {
  const rel = await isReleased(stageId);
  const started = !st.startTime.isZero();
  const dl = started ? deadlineOf(st) : 0;
  const soldPct = pctSold(st.tokensSold, st.tokensAvailable);
  log(
    `📌 S${stageId} rel=${rel} active=${st.isActive} started=${started} ` +
      `sold=${st.tokensSold.toString()}/${st.tokensAvailable.toString()} (${soldPct}%) ` +
      `start=${fmtTs(parseInt(st.startTime.toString(), 10))} deadline=${dl ? fmtTs(dl) : "0"}`
  );
}

// =====================
// TX SEND (broadcast txHash immediately)
// =====================
async function sendTxAndCaptureHash({ stageId, action, metaHash, gasLimit }) {
  const nonce = await getNoncePending();
  const gasPrice = await getGasPriceWei();

  const method =
    action === "RELEASE"
      ? amv2.methods.releaseStage(stageId, metaHash)
      : amv2.methods.releaseStageFail(stageId, metaHash);

  log(`➡️ TX ${action} stage=${stageId} nonce=${nonce} gas=${gasLimit}`);

  return await new Promise((resolve, reject) => {
    const promi = method.send({ from: generalAccount.address, gas: gasLimit, gasPrice, nonce });

    let timeoutId = setTimeout(() => {
      clearTimeout(timeoutId);
      reject(new Error("SEND_TIMEOUT_RECEIPT"));
    }, SEND_TIMEOUT_MS);

    promi
      .on("transactionHash", (h) => {
        // proof: txHash exists even if receipt never returns in time
        log(`📨 broadcast ${action} stage=${stageId} tx=${h}`);
        state.pending.txHash = h;
        saveState(state);
      })
      .on("receipt", (r) => {
        clearTimeout(timeoutId);
        resolve(r.transactionHash);
      })
      .on("error", (e) => {
        clearTimeout(timeoutId);
        reject(e);
      });
  });
}

// =====================
// PENDING (resolve + persist proof)
// =====================
async function handlePendingIfAny() {
  if (!state.pending.active) return false;

  const { stageId, action, txHash, sentAt } = state.pending;

  // 1) SoT check
  try {
    const rel = await isReleased(stageId);
    if (rel) {
      log(`🧾 pending resolved by SoT: stage ${stageId} released=true → clear pending`);
      // record proof if we have txHash (or even if not)
      pushHistory({
        stageId,
        action,
        txHash: txHash || "",
        at: nowSec(),
        metaHash: state.lastTx?.metaHash || "",
        context: { resolvedBy: "SoT", sentAt },
        status: "CONFIRMED_SOT",
      });

      state.pending = { active: false, stageId: 0, action: "", txHash: "", sentAt: 0 };
      saveState(state);
      return true;
    }
  } catch (e) {
    log(`⚠️ pending SoT check failed: ${e?.message || e}`);
  }

  // 2) Receipt check if txHash present
  if (txHash && txHash.startsWith("0x")) {
    try {
      const r = await withTimeout(web3.eth.getTransactionReceipt(txHash), RPC_TIMEOUT_MS, "getReceipt");
      if (r && r.status) {
        log(`🧾 pending receipt mined OK: ${action} stage=${stageId} tx=${txHash} → clear pending`);

        pushHistory({
          stageId,
          action,
          txHash,
          at: nowSec(),
          metaHash: state.lastTx?.metaHash || "",
          context: { resolvedBy: "RECEIPT", sentAt, blockNumber: r.blockNumber },
          status: "CONFIRMED_RECEIPT",
        });

        state.pending = { active: false, stageId: 0, action: "", txHash: "", sentAt: 0 };
        saveState(state);
        return true;
      }
      if (r && r.status === false) {
        log(`🚫 pending receipt FAILED: ${action} stage=${stageId} tx=${txHash} → clear pending`);

        pushHistory({
          stageId,
          action,
          txHash,
          at: nowSec(),
          metaHash: state.lastTx?.metaHash || "",
          context: { resolvedBy: "RECEIPT_FAIL", sentAt, blockNumber: r.blockNumber },
          status: "FAILED_RECEIPT",
        });

        state.pending = { active: false, stageId: 0, action: "", txHash: "", sentAt: 0 };
        saveState(state);
        return true;
      }
    } catch (e) {
      log(`⚠️ pending receipt check error: ${e?.message || e}`);
    }
  }

  const age = nowSec() - (sentAt || 0);
  log(`⏳ pending still active (${age}s): action=${action} stage=${stageId} tx=${txHash || "n/a"}`);
  return true;
}

// =====================
// EXECUTE ONE (persist proof even after clear)
// =====================
async function executeOne(stageId, action, context) {
  const metaHash = makeMetaHash({
    v: "AMV2_GENERAL_STAGE_ONLY",
    action,
    stageId,
    at: nowSec(),
    ...context,
  });

  // set pending first
  state.pending = { active: true, stageId, action, txHash: "", sentAt: nowSec() };
  saveState(state);

  // create initial proof record (SENT_PENDING) now (even before txHash exists)
  const baseRec = {
    stageId,
    action,
    txHash: "",
    at: nowSec(),
    metaHash,
    context,
    status: "SENT_PENDING",
  };
  state.lastTx = baseRec;
  saveState(state);

  try {
    const gasLimit = action === "RELEASE" ? GAS_LIMIT_RELEASE : GAS_LIMIT_FAIL;

    const txHash = await sendTxAndCaptureHash({ stageId, action, metaHash, gasLimit });

    // update record to CONFIRMED (we have receipt)
    pushHistory({
      stageId,
      action,
      txHash,
      at: nowSec(),
      metaHash,
      context,
      status: "MINED_OK",
    });

    log(`✅ mined ${action} stage=${stageId} tx=${txHash}`);

    // clear pending (proof already stored in history)
    state.pending = { active: false, stageId: 0, action: "", txHash: "", sentAt: 0 };
    saveState(state);
    return true;
  } catch (e) {
    log(`🚫 TX ERROR ${action} stage=${stageId} | ${e?.message || e}`);

    // If txHash was broadcast, keep pending so next tick resolves via receipt/SoT.
    if (state.pending.txHash && state.pending.txHash.startsWith("0x")) {
      pushHistory({
        stageId,
        action,
        txHash: state.pending.txHash,
        at: nowSec(),
        metaHash,
        context: { ...context, note: "send threw but txHash exists; keep pending" },
        status: "BROADCAST_NO_RECEIPT_YET",
      });
      saveState(state);
      return false;
    }

    // No txHash => real fail before broadcast
    pushHistory({
      stageId,
      action,
      txHash: "",
      at: nowSec(),
      metaHash,
      context: { ...context, error: String(e?.message || e) },
      status: "FAILED_NO_TXHASH",
    });

    state.pending = { active: false, stageId: 0, action: "", txHash: "", sentAt: 0 };
    saveState(state);
    return false;
  }
}

// =====================
// CORE DECISION (ONE action per tick)
// =====================
async function decideAndExecute() {
  if (await handlePendingIfAny()) return;

  const preSaleEnded = await withTimeout(preSale.methods.preSaleEnded().call(), RPC_TIMEOUT_MS, "preSaleEnded");
  const now = nowSec();

  const s = {
    1: await readStage(1),
    2: await readStage(2),
    3: await readStage(3),
    4: await readStage(4),
    5: await readStage(5),
  };

  log(`🧠 tick: now=${fmtTs(now)} preSaleEnded=${preSaleEnded}`);
  await logStage(1, s[1]);
  await logStage(2, s[2]);
  await logStage(3, s[3]);
  await logStage(4, s[4]);
  await logStage(5, s[5]);

  // A) SWEEP after presale ended
  if (preSaleEnded) {
    log(`🔒 SWEEP: preSaleEnded=true (1 tx/tick)`);

    for (const stageId of [1, 2, 3, 4, 5]) {
      if (await isReleased(stageId)) continue;

      const st = s[stageId];

      if (stageId >= 2 && stageId <= 4) {
        const half = halfOf(st.tokensAvailable);
        const dl = st.startTime.isZero() ? 0 : deadlineOf(st);

        if (st.tokensSold.gt(half)) {
          log(`✅ SWEEP S${stageId}: sold>50% → RELEASE`);
          return await executeOne(stageId, "RELEASE", { mode: "SWEEP_NORMAL" });
        }

        if (dl && now >= dl) {
          log(`✅ SWEEP S${stageId}: expired & sold<=50% → FAIL`);
          return await executeOne(stageId, "FAIL", { mode: "SWEEP_FAIL", deadline: dl });
        }

        log(`…SWEEP S${stageId}: waiting (deadline=${dl ? fmtTs(dl) : "0"})`);
        continue;
      }

      log(`✅ SWEEP S${stageId}: RELEASE`);
      return await executeOne(stageId, "RELEASE", { mode: "SWEEP" });
    }

    log(`…SWEEP: nothing to do`);
    return;
  }

  // B) Normal operation before presale end
  if (!s[1].isActive && !(await isReleased(1))) {
    log(`✅ S1 ended (isActive=false) → RELEASE (special)`);
    return await executeOne(1, "RELEASE", { mode: "S1_END_SPECIAL" });
  }

  for (const stageId of [2, 3, 4]) {
    if (await isReleased(stageId)) continue;

    const st = s[stageId];
    if (st.startTime.isZero()) continue;

    const dl = deadlineOf(st);
    const half = halfOf(st.tokensAvailable);

    if (st.tokensSold.gt(half)) {
      log(`✅ S${stageId} sold>50% → RELEASE`);
      return await executeOne(stageId, "RELEASE", { mode: "SOLD_GT_50", deadline: dl });
    }

    if (now >= dl) {
      log(`✅ S${stageId} expired & sold<=50% → FAIL`);
      return await executeOne(stageId, "FAIL", { mode: "EXPIRED_FAIL", deadline: dl });
    }
  }

  log(`…no actions`);
}

// =====================
// LOOP
// =====================
let loopRunning = false;

async function loop() {
  if (loopRunning) return log(`⏭️ skip tick (still running)`);
  loopRunning = true;

  try {
    state.lastLoopTs = nowSec();
    saveState(state);
    await decideAndExecute();
  } catch (e) {
    log(`💥 loop error: ${e?.message || e}`);
  } finally {
    loopRunning = false;
  }
}

process.on("unhandledRejection", (r) => log(`🔥 unhandledRejection: ${r?.stack || r}`));
process.on("uncaughtException", (e) => log(`🔥 uncaughtException: ${e?.stack || e}`));

(async () => {
  log(`GENERAL bot address: ${generalAccount.address}`);
  log(`PreSale: ${PRE_SALE_ADDRESS}`);
  log(`AMv2:    ${AMV2_ADDRESS}`);
  log(`Loop:    every ${LOOP_SECONDS}s`);
  log(`History: max ${HISTORY_MAX} records`);

  try {
    const ended = await withTimeout(preSale.methods.preSaleEnded().call(), RPC_TIMEOUT_MS, "preSaleEnded(init)");
    log(`Init: preSaleEnded=${ended}`);
  } catch (e) {
    log(`🚫 Init read failed: ${e?.message || e}`);
    process.exit(1);
  }

  await loop();
  setInterval(loop, LOOP_SECONDS * 1000);
})();
