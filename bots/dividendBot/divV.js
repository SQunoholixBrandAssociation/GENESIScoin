require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const {
  WSS_URL,
  PRIVATE_KEY,
  PRE_SALE_ADDRESS,
  PUBLIC_SALE_ADDRESS,
  GEN_TOKEN_ADDRESS,
  COOLDOWN_HOURS     = 'PLACEHOLDER',   
  payoutIn_Hours_min = 'PLACEHOLDER',
  payoutIn_Hours_max = 'PLACEHOLDER',
  MIN_HOLD           = 'PLACEHOLDER'    
} = process.env;

const provider = new ethers.providers.WebSocketProvider(WSS_URL);
const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

const GEN_ABI = [
  'PLACEHOLDER(address indexed from,address indexed to,uint256 value)',
  'PLACEHOLDER(address) view returns(uint256)'
];
const PRESALE_ABI = [
  'PLACEHOLDER() view returns(bool)',
  'PLACEHOLDER() view returns(uint256)'
];
const PUBLIC_ABI = [
  'PLACEHOLDER() view returns(uint256)',
  'PLACEHOLDER(address[],uint256[]) external'
];

const GEN         = new ethers.Contract(GEN_TOKEN_ADDRESS,  GEN_ABI,    provider);
const PRESALE     = new ethers.Contract(PRE_SALE_ADDRESS,   PRESALE_ABI, provider);
const PUBLIC_SALE = new ethers.Contract(PUBLIC_SALE_ADDRESS,PUBLIC_ABI,  wallet);

const USERS_FILE  = path.join(__dirname, 'dividend-users.json'); 
const META_FILE   = path.join(__dirname, 'cycle-metadata.json');
const PAYOUT_FILE = path.join(__dirname, 'cycle-payout.json');
const STATE_FILE  = path.join(__dirname, 'verifier-state.json');

const read  = (f, def = {}) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : def);
const write = (f, obj)     => fs.writeFileSync(
  f,
  JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
);
const now = () => Math.floor(Date.now() / 1000);
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

let transferSub = null;
let VSTATE = read(STATE_FILE, {});
if (!VSTATE._telemetry) VSTATE._telemetry = { lastCycleNr: 0, lastSnapshot: 0, lastPayout: 0 };
const saveState = () => write(STATE_FILE, VSTATE);

startVerifier().catch(console.error);

async function startVerifier() {
  console.log('🟢 DividendVerifier started');

  if (!(await PRESALE.preSaleEnded())) {
    console.log('Presale is still active – exiting.');
    return;
  }

  const meta = read(META_FILE, []);

  if (meta.length === 0) {
    const end  = Number(await PRESALE.preSaleEndTime());
    const wait = end + Number(COOLDOWN_HOURS) * PLACEHOLDER;
    if (now() < wait) {
      const minLeft = Math.ceil((wait - now()) / 60);
      console.log(`⚠️ Cool-down active: ${minLeft} minutes remaining`);
      return;
    }
  }

  const active = meta.find(c => c.status === 'active');
  if (active) {
    console.log(`Resuming cycle #${active.number}`);
    startMonitoringCycle(active);
    return;
  }

  await createNewCycle();
}

async function createNewCycle() {
  const meta = read(META_FILE, []);
  const last = meta[meta.length - 1];
  if (last && last.status !== 'completed') {
    console.log(`Last cycle #${last.number} is not completed (status: ${last.status})`);
    return;
  }

  console.log('Creating snapshot…');
  if (transferSub) { GEN.off('Transfer', transferSub); transferSub = null; }

  const addresses = Object.keys(read(USERS_FILE, {}));
  const nr        = meta.length + 1;
  const tNow      = now();
  const hours     = rnd(+payoutIn_Hours_min, +payoutIn_Hours_max);
  const payoutTS  = tNow + hours * PLACEHOLDER;
  const snapshot  = {};

  for (const addr of addresses) {
    try {
      const bal = BigInt((await GEN.balanceOf(addr)).toString());
      if (bal < BigInt(MIN_HOLD)) continue;

      if (!VSTATE[addr]) {
        VSTATE[addr] = {
          initialHold        : bal.toString(),
          entryCycle         : nr,          
          holdProofStart     : null,   
          holdProofCompleted : nr,     
          progress           : 0
        };

      } else if (VSTATE[addr].ejectedAt) {  
        delete VSTATE[addr].ejectedAt;

        VSTATE[addr].initialHold        = bal.toString();
        VSTATE[addr].entryCycle         = nr;
        VSTATE[addr].holdProofStart     = nr;     
        VSTATE[addr].holdProofCompleted = null;   
        VSTATE[addr].progress           = 0;

      } else {
        const prev = BigInt(VSTATE[addr].initialHold);
        if (bal >= prev * 151n / 100n) {
          VSTATE[addr].initialHold = bal.toString();
        } else if (bal < prev) {
          VSTATE[addr].ejectedAt = nr;
          continue;                         
        }
      }

      snapshot[addr] = { initialHold: VSTATE[addr].initialHold };
    } catch (e) {
      console.error(`balanceOf ${addr}`, e);
    }
  }

  meta.push({
    number: nr,
    startTimestamp: tNow,
    payoutUntil: payoutTS,
    payoutInHours: hours,
    snapshot,
    status: 'active'
  });
  write(META_FILE, meta);
  VSTATE._telemetry.lastCycleNr  = nr;
  VSTATE._telemetry.lastSnapshot = tNow;
  saveState();

  console.log(`Snapshot for cycle #${nr} – ${Object.keys(snapshot).length} users qualified`);
  startMonitoringCycle(meta[meta.length - 1]);
}

function startMonitoringCycle(cycle) {
  console.log(`Monitoring cycle ${cycle.number}`);
  monitorLoop(cycle);

  transferSub = GEN.on('Transfer', (from, to) => {
    if (cycle._done) return;
    if (cycle.snapshot[from] || cycle.snapshot[to]) {
      console.log('Transfer detected – validating balances');
      monitorLoop(cycle);
    }
  });
}

async function monitorLoop(cycle) {
  if (now() >= cycle.payoutUntil) {
    if (cycle._done) return;
    if (transferSub) { GEN.off('Transfer', transferSub); transferSub = null; }
    if (cycle._timer) clearTimeout(cycle._timer);
    cycle._done = true;
    console.log(`Cycle #${cycle.number} ended – starting payouts`);
    await finalizeAndPayout(cycle);
    return;
  }

  const snap = cycle.snapshot;
  for (const addr of Object.keys(snap)) {
    try {
      const bal  = BigInt((await GEN.balanceOf(addr)).toString());
      const init = BigInt(snap[addr].initialHold);

      if (bal < init) {
        delete snap[addr];
        VSTATE[addr].ejectedAt = cycle.number;
        console.log(`🚫 User ejected: ${addr}`);
      } else if (bal >= init * 151n / 100n) {
        VSTATE[addr].initialHold = bal.toString();
        snap[addr].initialHold   = bal.toString();
      }
    } catch (e) { console.error(`monitor ${addr}`, e); }
  }

  saveState();
  updateMetaSnapshot(cycle.number, snap);
  cycle._timer = setTimeout(() => monitorLoop(cycle), rnd(30, 180) * 1000);
}

function updateMetaSnapshot(nr, snap) {
  const meta = read(META_FILE, []);
  const i = meta.findIndex(c => c.number === nr);
  if (i > -1) {
    meta[i].snapshot = snap;
    write(META_FILE, meta);
  }
}

async function finalizeAndPayout(cycle) {
  const poolInit = BigInt((await PUBLIC_SALE.dividendPoolGENc()).toString());
  let   poolLeft = poolInit;
  const payouts  = [];

  for (const addr of Object.keys(cycle.snapshot)) {
    const u = VSTATE[addr];
    if (!u || u.ejectedAt === cycle.number) continue;

    if (u.holdProofStart && !u.holdProofCompleted) {
      u.holdProofCompleted = cycle.number;
      u.progress = 0;
      console.log(`HoldProof completed for: ${addr}`);
      continue;
    }

    const start = u.entryCycle ?? (u.holdProofCompleted + 1);
    const held  = cycle.number - start + 1;
    u.progress  = Math.min(Math.floor((held - 1) / 2), 8);
    const pct   = 2 + u.progress;
    const amt   = BigInt(u.initialHold) * BigInt(pct) / 100n;

    payouts.push({ address: addr, amount: amt, progress: u.progress });
    saveState();
  }

  if (payouts.length === 0) {
    completeCycle(cycle);
    return;
  }

  const need = payouts.reduce((s, p) => s + p.amount, 0n);
  if (need > poolLeft) {
    const scale = Number(poolLeft) / Number(need);
    payouts.forEach(p => p.amount = BigInt(Math.floor(Number(p.amount) * scale)));
  }

  for (
    let i = 0;
    i < payouts.length && poolLeft > 0n;
    i += 50
  ) {
    const chunk = [];
    let subtotal = 0n;
    for (const p of payouts.slice(i, i + 50)) {
      if (p.amount > poolLeft) break;
      if (subtotal + p.amount > poolLeft) break;
      chunk.push(p);
      subtotal += p.amount;
    }
    if (chunk.length === 0) break;

    try {
      await (await PUBLIC_SALE.distributeDividendsAdjusted(
        chunk.map(p => p.address),
        chunk.map(p => p.amount.toString()),
        { gasLimit: PLACEHOLDER }
      )).wait();

      poolLeft -= subtotal;
      console.log(`Batch ${i / 50 + 1} sent (${chunk.length} users)`);
    } catch (e) {
      console.error(`Batch ${i / 50 + 1}`, e.reason || e);
    }
  }
  const log = read(PAYOUT_FILE, []);
  const seen = new Set(log.map(e => `${e.cycle}_${e.address}`));

  payouts
    .filter(p => p.amount <= poolInit - poolLeft)
    .forEach(p => {
      const key = `${cycle.number}_${p.address}`;
      if (!seen.has(key)) {
        log.push({
          cycle      : cycle.number,
          amount     : p.amount.toString(),
          progress   : p.progress,
          address    : p.address,
          initialHold: VSTATE[p.address].initialHold
        });
        seen.add(key);
      }
    });

  write(PAYOUT_FILE, log);

  saveState(); 
  completeCycle(cycle);
}

function completeCycle(cycle) {
  const meta = read(META_FILE, []);
  const idx  = meta.findIndex(c => c.number === cycle.number);
  if (idx > -1) {
    meta[idx].status = 'completed';
    write(META_FILE, meta);
  }

  VSTATE._telemetry.lastPayout = now();
  VSTATE._telemetry.lastCycleNr = cycle.number;   

  saveState();

  console.log(`Cycle #${cycle.number} completed – creating new snapshot`);
  createNewCycle().catch(console.error);
}