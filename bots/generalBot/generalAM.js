// ===== MODULE 1 — deps =====
require('dotenv').config();
const { ethers } = require('ethers'); // v5

process.on('unhandledRejection', (e) => {
  console.error('[UNHANDLED]', e);
});
process.on('uncaughtException', (e) => {
  console.error('[UNCAUGHT]', e);
});

// ===== MODULE 2 — ABI =====
const ABI_PRESALE = [
  { "type":"event", "name":"WhitelistClosed", "inputs":[{ "indexed":false, "name":"timestamp", "type":"uint256" }], "anonymous":false }
];

const ABI_ASSETMANAGER = [
  { "type":"function","name":"setWasteStart","stateMutability":"nonpayable","inputs":[{ "name":"ts","type":"uint64"}],"outputs":[] },
  { "type":"function","name":"adviseRelease","stateMutability":"view","inputs":[{ "name":"id","type":"uint8"}],
    "outputs":[
      { "name":"due","type":"bool" },
      { "name":"index","type":"uint16" },
      { "name":"dueTs","type":"uint64" },
      { "name":"amount","type":"uint256" }
    ]},
  { "type":"function","name":"release","stateMutability":"nonpayable","inputs":[{ "name":"id","type":"uint8"}],"outputs":[] },
  { "type":"function","name":"wasteSet","stateMutability":"view","inputs":[],"outputs":[{ "name":"","type":"bool"}] },
  { "type":"function","name":"wasteStart","stateMutability":"view","inputs":[],"outputs":[{ "name":"","type":"uint64"}] }
];

// ===== MODULE 3 — env =====
const {
  WSS_URL,
  CHAIN_ID,
  PRIVATE_KEY,
  PRESALE_ADDRESS,
  ASSET_MANAGER_ADDRESS,
  POOL_IDS,
  POLL_SECONDS = '43200' 
} = process.env;

if (!WSS_URL || !PRIVATE_KEY || !PRESALE_ADDRESS || !ASSET_MANAGER_ADDRESS || !POOL_IDS) {
  console.error('Missing env: WSS_URL, PRIVATE_KEY, PRESALE_ADDRESS, ASSET_MANAGER_ADDRESS, POOL_IDS');
  process.exit(1);
}

// ===== MODULE 4 — globals =====
const IDS = POOL_IDS.split(',').map(s => parseInt(s.trim(),10)).filter(Number.isFinite);
const POLL = Number(POLL_SECONDS);
let wsProvider, wallet, sale, am;
let armed = false;
let startTs = 0;

// ===== MODULE 5 — provider & contracts =====
function makeProvider() {
  const p = new ethers.providers.WebSocketProvider(WSS_URL, Number(CHAIN_ID||56));
  p._websocket.on('open', () => console.log('[WS] connected'));
  p._websocket.on('close', (code) => { console.log('[WS] closed', code, '→ reconnecting'); setTimeout(reconnect, 2000); });
  p._websocket.on('error', (e) => console.error('[WS] error', e?.message || e));
  return p;
}

async function attachContracts() {
  wallet = new ethers.Wallet(PRIVATE_KEY, wsProvider);
  sale   = new ethers.Contract(PRESALE_ADDRESS, ABI_PRESALE, wsProvider);
  am     = new ethers.Contract(ASSET_MANAGER_ADDRESS, ABI_ASSETMANAGER, wallet);
}

async function reconnect() {
  try { wsProvider && wsProvider.destroy && wsProvider.destroy(); } catch {}
  wsProvider = makeProvider();
  await attachContracts();
  bindEvent();
}

// ===== MODULE 6 — WL close handler =====
function bindEvent() {
  sale.removeAllListeners('WhitelistClosed');
  sale.on('WhitelistClosed', async (tsBN, evt) => {
    try {
      const ts = ethers.BigNumber.from(tsBN).toNumber();
      console.log('[EVENT] WhitelistClosed', { ts, tx: evt.transactionHash, block: evt.blockNumber });

      const already = await am.wasteSet();
      if (!already) {
        await sendWasteStart(ts);
      } else {
        console.log('[EVENT] waste already set — skip setWasteStart');
      }

      armed = true;
      startTs = (await am.wasteStart()).toNumber();
      console.log('[GENERAL] armed at', startTs);

      await tickOnce();
    } catch (err) {
      console.error('[ERROR] WLclose handler', err.message);
    }
  });
  console.log('[LISTENER] attached → WhitelistClosed');
}

// ===== MODULE 7 — on-chain actions =====
const pending = {}; // mapa blokad per ID

async function sendWasteStart(ts) {
  const populated = await am.populateTransaction.setWasteStart(ts);
  const tx = await wallet.sendTransaction(populated);
  console.log('[TX] setWasteStart sent', tx.hash);
  const rc = await tx.wait();
  console.log('[MINED] setWasteStart', rc.status);
}

async function sendRelease(id) {
  if (pending[id]) {
    console.log(`[SKIP] ID ${id} — tx pending`);
    return;
  }
  pending[id] = true;
  try {
    const populated = await am.populateTransaction.release(id);
    const tx = await wallet.sendTransaction(populated);
    console.log('[TX] release sent', { id, hash: tx.hash });
    const rc = await tx.wait();
    console.log('[MINED] release', { id, status: rc.status });
  } catch (e) {
    console.error('[ERROR] sendRelease()', { id, err: e.message });
  } finally {
    pending[id] = false;
  }
}

// ===== MODULE 8 — loop (no catch-up) =====
let firstTickDone = false;

async function tickOnce() {
  if (!armed) { console.log('[LOOP] waiting for WhitelistClosed…'); return; }

  // jeśli trwa poprzedni tick, pomiń
  if (tickOnce.running) return;
  tickOnce.running = true;

  for (const id of IDS) {
    try {
      const [due, , , amount] = await am.adviseRelease(id);
      if (due && amount.gt(0)) {
        console.log(`[CHECK] ID ${id} due (${amount.toString()}) → releasing 1 step`);
        await sendRelease(id);
      } else {
        console.log(`[CHECK] ID ${id} not due`);
      }
    } catch (e) {
      console.error('[ERROR] adviseRelease()', { id, err: e.message });
    }
  }

  tickOnce.running = false;
  firstTickDone = true;
}

function startLoop() {
  setInterval(tickOnce, POLL * 1000);
  console.log(`[LOOP] armed loop every ${POLL}s`);
}

// ===== MODULE 9 — boot =====
(async () => {
  console.log('[BOOT] GENERAL (ethers v5, WS, no catch-up)');
  await reconnect();

  try {
    const isSet = await am.wasteSet();
    const ws = await am.wasteStart();
    if (isSet && ws.toNumber() > 0) {
      armed = true;
      startTs = ws.toNumber();
      console.log('[SYNC] waste already set on-chain → armed at', startTs);
      await tickOnce(); 
    } else {
      console.log('[SYNC] waste not set — waiting for WhitelistClosed…');
    }
  } catch (e) {
    console.error('[SYNC] failed', e.message);
  }

  startLoop(); 
})();
