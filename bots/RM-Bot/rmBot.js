require('dotenv').config();
const { ethers } = require('ethers');

// ======================
// CONFIG
// ======================
const WSS_RPC            = process.env.BSC_WSS_RPC;
const RM_BOT_PRIVATE_KEY = process.env.RM_BOT_PRIVATE_KEY;
const PRESALE_ADDRESS    = process.env.PRE_SALE_ADDRESS;
const RM01_ADDRESS       = process.env.RM01_ADDRESS;

// ======================
// ABI
// ======================
const PRESALE_ABI = [
  "event WhitelistClosed(uint256 timestamp)"
];

const RM01_ABI = [
  "function SET_TGE() external",
  "function RELEASE() external",
  "function adviseRelease() external view returns (bool due, uint16 index, uint64 dueTs, uint256 amount)",
  "function poolStatus() external view returns (tuple(uint256 cap, uint256 funded, uint256 released, bool isSealed, bool tgeSet, uint64 tgeTimestamp, uint16 nextIndex, uint16 total, uint64 nextDueTs, uint256 nextAmount))"
];

// ======================
// CONSTANTS
// ======================
const DAY       = 24 * 3600;
const HOUR      = 3600;
const BUFFER_MS = 10 * 1000;
const SETTLE_MS = 20 * 1000;

// ======================
// LOGGER
// ======================
function log(msg, ...args) {
  console.log(`[${new Date().toISOString()}] [RM_BOT] ${msg}`, ...args);
}
function err(msg, ...args) {
  console.error(`[${new Date().toISOString()}] [RM_BOT] ERR ${msg}`, ...args);
}

function formatWait(secs) {
  if (secs <= 0) return '0m';
  const d = Math.floor(secs / DAY);
  const h = Math.floor((secs % DAY) / HOUR);
  const m = Math.floor((secs % HOUR) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ======================
// RUNTIME
// ======================
let releaseTimer  = null;
let aliveTimer    = null;
let provider      = null;
let wallet        = null;
let rm01          = null;
let presale       = null;
let intentionalClose = false;

// ======================
// PROVIDER
// ======================
function buildProvider() {
  provider = new ethers.providers.WebSocketProvider(WSS_RPC);
  wallet   = new ethers.Wallet(RM_BOT_PRIVATE_KEY, provider);
  rm01     = new ethers.Contract(RM01_ADDRESS,    RM01_ABI,    wallet);
  presale  = new ethers.Contract(PRESALE_ADDRESS, PRESALE_ABI, provider);

  provider._websocket.on('close', () => {
    if (intentionalClose) { intentionalClose = false; return; }
    log('WS closed — restarting in 5s...');
    cleanup();
    setTimeout(start, 5000);
  });

  provider._websocket.on('error', (e) => {
    err('WS error:', e.message);
  });
}

function cleanup() {
  intentionalClose = true;
  try { provider._websocket.terminate(); } catch {}
  if (releaseTimer) { clearTimeout(releaseTimer);  releaseTimer = null; }
  if (aliveTimer)   { clearInterval(aliveTimer);   aliveTimer   = null; }
}

// ======================
// SYNC FROM CHAIN
// ======================
async function syncFromChain() {
  log('--- SYNC FROM CHAIN ---');

  const status = await rm01.poolStatus();

  log(`sealed:    ${status.isSealed}`);
  log(`tgeSet:    ${status.tgeSet}`);
  log(`tgeTs:     ${status.tgeTimestamp}`);
  log(`nextIndex: ${status.nextIndex} / ${status.total}`);
  log(`released:  ${ethers.utils.formatUnits(status.released, 18)} GENc`);

  // CASE 1: All done
  if (status.tgeSet && status.nextIndex >= status.total) {
    log('All releases completed on-chain — bot idle');
    return;
  }

  // CASE 2: TGE set — schedule next release
  if (status.tgeSet) {
    log('TGE set on-chain — scheduling next release');
    await scheduleNextRelease();
    return;
  }

  // CASE 3: Not sealed — wait
  if (!status.isSealed) {
    log('Pool not sealed yet — re-syncing in 60s...');
    setTimeout(syncFromChain, 60 * 1000);
    return;
  }

  // CASE 4: Sealed, TGE not set — check if WhitelistClosed already on-chain
  const PRESALE_ABI_EXT = ["function b100dWhitelistCloseTime() external view returns (uint256)"];
  const presaleReader = new ethers.Contract(PRESALE_ADDRESS, PRESALE_ABI_EXT, provider);
  const wlCloseTime = await presaleReader.b100dWhitelistCloseTime();

  if (wlCloseTime.gt(0)) {
    log(`WhitelistClosed already on-chain (ts: ${wlCloseTime.toString()}) — calling SET_TGE directly`);
    await handleWhitelistClosed();
    return;
  }

  log('Pool sealed, TGE not set — listening for WhitelistClosed...');
  presale.once('WhitelistClosed', handleWhitelistClosed);
}

// ======================
// HANDLE WhitelistClosed
// ======================
async function handleWhitelistClosed() {
  log('WhitelistClosed event received');

  const status = await rm01.poolStatus();

  if (status.tgeSet) {
    log('SC: tgeSet already true — skipping SET_TGE');
    await scheduleNextRelease();
    return;
  }

  try {
    log('Calling SET_TGE()...');
    const tx = await rm01.SET_TGE({ gasLimit: 100000 });
    log(`SET_TGE tx: ${tx.hash}`);
    await tx.wait();
    log('SET_TGE confirmed');
    await scheduleNextRelease();
  } catch (e) {
    err('SET_TGE failed:', e.message || e);
    setTimeout(syncFromChain, 30 * 1000);
  }
}

// ======================
// SCHEDULE NEXT RELEASE
// ======================
async function scheduleNextRelease() {
  if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null; }

  try {
    const [due, index, dueTs, amount] = await rm01.adviseRelease();
    const now      = Math.floor(Date.now() / 1000);
    const dueTsNum = dueTs.toNumber();

    // All done
    if (dueTsNum === 0) {
      log('All releases completed — bot idle');
      stopAliveTimer();
      return;
    }

    // Already due — execute, wait 20s for chain to settle, then reschedule
    if (due) {
      log(`RELEASE due — index: ${index} | ${ethers.utils.formatUnits(amount, 18)} GENc`);
      await executeRelease(index);
      log('Waiting 20s for chain to settle...');
      await new Promise(r => setTimeout(r, SETTLE_MS));
      await scheduleNextRelease();
      return;
    }

    // Sleep until dueTs + buffer
    const waitSecs = dueTsNum - now;
    const sleepMs  = waitSecs * 1000 + BUFFER_MS;

    log(`Next release [${index}] at dueTs ${dueTsNum} — in ${formatWait(waitSecs)} | ${ethers.utils.formatUnits(amount, 18)} GENc`);
    log(`Bot sleeping for ${formatWait(waitSecs)} then firing`);

    releaseTimer = setTimeout(async () => {
      releaseTimer = null;
      await scheduleNextRelease();
    }, sleepMs);

    startAliveTimer(dueTsNum, index, amount);

  } catch (e) {
    err('scheduleNextRelease:', e.message || e);
    releaseTimer = setTimeout(scheduleNextRelease, 5 * 60 * 1000);
  }
}

// ======================
// EXECUTE RELEASE
// ======================
async function executeRelease(index) {
  try {
    const tx = await rm01.RELEASE({ gasLimit: 150000 });
    log(`RELEASE tx: ${tx.hash}`);
    await tx.wait();
    log(`RELEASE [${index}] confirmed`);
  } catch (e) {
    err(`RELEASE [${index}] failed:`, e.message || e);
  }
}

// ======================
// HEARTBEAT
// > 1 day  → every 6h
// < 1 day  → every 1h
// ======================
function stopAliveTimer() {
  if (aliveTimer) { clearInterval(aliveTimer); aliveTimer = null; }
}

function startAliveTimer(dueTsNum, index, amount) {
  stopAliveTimer();

  const now      = Math.floor(Date.now() / 1000);
  const waitSecs = dueTsNum - now;
  const interval = waitSecs > DAY ? 6 * HOUR * 1000 : 1 * HOUR * 1000;
  const label    = waitSecs > DAY ? '6h' : '1h';

  log(`Heartbeat: every ${label}`);

  aliveTimer = setInterval(() => {
    const remaining = dueTsNum - Math.floor(Date.now() / 1000);
    if (remaining <= 0) {
      log(`[ALIVE] Release [${index}] window reached — waiting for SC check`);
    } else {
      log(`[ALIVE] OK | next release [${index}] in ${formatWait(remaining)} | ${ethers.utils.formatUnits(amount, 18)} GENc`);
    }
  }, interval);
}

// ======================
// START
// ======================
async function start() {
  log('Starting RM_BOT...');
  buildProvider();

  provider.ready
    .then(() => {
      log('WS connected');
      return syncFromChain();
    })
    .catch((e) => {
      err('Provider ready error:', e.message);
      setTimeout(start, 5000);
    });
}

process.on('uncaughtException',  (e) => err('uncaughtException:',  e.message || e));
process.on('unhandledRejection', (e) => err('unhandledRejection:', e?.message || e));

start();
