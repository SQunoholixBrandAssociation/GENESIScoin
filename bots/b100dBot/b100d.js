require('dotenv').config();
const fs = require('fs');
const { ethers } = require('ethers');

const provider = new ethers.providers.WebSocketProvider(process.env.WSSURL);

const ABI = [
  'PLACEHOLDER(uint256)',
  'PLACEHOLDER(uint256)',
  'PLACEHOLDER(address indexed,uint256)',
  'PLACEHOLDER(address) view returns (uint256,bool)',
  'PLACEHOLDER(address)',
  'PLACEHOLDER() view returns (uint256)',
  'PLACEHOLDER() view returns (uint256)',
  'PLACEHOLDER() view returns (uint256)'
];

const GEN_ABI = [
  'PLACEHOLDER(address) view returns (uint256)',
  'PLACEHOLDER(address indexed,address indexed,uint256)'
];

const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, provider);
const token    = new ethers.Contract(process.env.GEN_TOKEN_ADDRESS, GEN_ABI, provider);
const wallet   = new ethers.Wallet(process.env.BOT_PRIVATE_KEY, provider);

const FILE = 'b100dParticipants.json';
let users = load(FILE);
const tracked = new Set(Object.keys(users).map(a => a.toLowerCase()));
let whitelistOpen = false;
let whitelistClosed = false;
let b100dStarted = false;
let transferLive = false;

function load(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return {}; } }
function save(){ fs.writeFileSync(FILE, JSON.stringify(users,null,2)); }

function startTransfer(){
  if (transferLive) return;
  transferLive = true;

  token.on('Transfer', (from,to) => {
    from = from.toLowerCase();
    to   = to.toLowerCase();
    if (tracked.has(from)) verify(from).catch(console.error);
    if (tracked.has(to))   verify(to).catch(console.error);
  });
  console.log('🔌 Transfer listener active (B100D started)');
}

async function verify(addr){
  if (!users[addr]) return;
  const init = BigInt(users[addr]);
  const bal  = BigInt(await token.balanceOf(addr));

  if (bal < init){
    const tx = await contract.connect(wallet).ejectFromWhitelist(addr,{gasLimit:500_000});
    await tx.wait();
    delete users[addr];
    tracked.delete(addr);
    save();
    console.log(`❌ Ejected ${addr} (holding < initial)`);
  } else {
    console.log(`✔️ Verified ${addr} – holding OK`);
  }
}

async function syncFromContractByAddresses(){
  console.log('🔄 Syncing participants via contract view…');
  const addrs = Array.from(new Set([...Object.keys(users), ...tracked]));
  const BATCH = 25;
  let changed = false;

  for (let i = 0; i < addrs.length; i += BATCH){
    const slice = addrs.slice(i, i + BATCH);
    const results = await Promise.allSettled(slice.map(a => contract.b100dParticipants(a)));

    for (let j = 0; j < slice.length; j++){
      const addr = slice[j].toLowerCase();
      const res  = results[j];
      if (res.status !== 'fulfilled'){
        console.warn(`⚠️ View call failed for ${addr}: ${res.reason}`);
        continue;
      }

      const [initHold,isActive] = res.value;
      const initStr = initHold.toString();

      if (!isActive || initHold === 0n){
        if (users[addr]){ delete users[addr]; tracked.delete(addr); changed = true;
          console.log(`🗑️ Removed inactive ${addr}`); }
        continue;
      }
      if (!users[addr] || users[addr] !== initStr){
        users[addr] = initStr; tracked.add(addr); changed = true;
        console.log(`🔁 Synced ${addr} | initialHold: ${initStr}`);
      }
    }
  }
  if (changed) save();
  console.log('✅ Participant sync done.');
}

async function checkParticipants(){
  console.log('🔍 Verifying all participants…');
  for(const [addr, initStr] of Object.entries(users)){
    try {
      const init   = BigInt(initStr);
      const actual = BigInt(await token.balanceOf(addr));
      if (actual < init){
        const tx = await contract.connect(wallet)
          .ejectFromWhitelist(addr, {gasLimit: 500_000});
        await tx.wait();
        delete users[addr]; tracked.delete(addr); save();
        console.log(`❌ Ejected: ${addr} (holding dropped below initial)`);
      } else {
        console.log(`✅ OK: ${addr} holding ${ethers.utils.formatUnits(actual, 18)} GENc`);
      }
    } catch(err){
      console.error(`⚠️ Failed check for ${addr}: ${err.message}`);
    }
  }
}

contract.on('WhitelistOpened', async (ts) => {
  if (whitelistOpen) return;
  whitelistOpen = true;
  console.log(`🟢 Whitelist opened @ ${ts}`);
});

contract.on('B100DRegistered', async (user, initHold) => {
  if (!whitelistOpen || whitelistClosed) return;
  const addr = user.toLowerCase();
  users[addr] = initHold.toString();
  tracked.add(addr);
  save();
  console.log(`✅ Registered ${addr}`);
});

contract.on('WhitelistClosed', async (ts) => {
  if (whitelistClosed) return;
  whitelistClosed = true;
  console.log(`🔒 Whitelist closed @ ${ts}`);

  const b100dStart = Number(await contract.b100dStartTime());
  const now = Math.floor(Date.now() / 1000);
  const delay = Math.max(0, b100dStart - now);

  console.log(`⏳ Waiting ${delay}s for B100D start…`);
  setTimeout(async () => {
    b100dStarted = true;
    await syncFromContractByAddresses();
    await checkParticipants();
    startTransfer();
  }, delay * 1000);
});

(async () => {
  console.log('🚀 B100D Bot running');
  try {
    const wlStart = Number(await contract.b100dWhitelistStartTime());
    const wlClose = Number(await contract.b100dWhitelistCloseTime());
    const b100dStart = Number(await contract.b100dStartTime());
    const now = Math.floor(Date.now() / 1000);

    if (wlClose > 0 && wlClose < now){
      whitelistClosed = true;
      console.log(`🧠 Whitelist status: CLOSED (closeTime = ${wlClose})`);
      if (b100dStart > 0 && b100dStart < now){
        b100dStarted = true;
        console.log(`🚀 B100D already started (startTime = ${b100dStart})`);
        await syncFromContractByAddresses();
        await checkParticipants();
        startTransfer();
      } else {
        const delay = Math.max(0, b100dStart - now);
        console.log(`⏳ Waiting ${delay}s for B100D start…`);
        setTimeout(async () => {
          b100dStarted = true;
          await syncFromContractByAddresses();
          await checkParticipants();
          startTransfer();
        }, delay * 1000);
      }
    } else if (wlStart > 0 && wlStart < now){
      whitelistOpen = true;
      console.log(`🧠 Whitelist status: OPENED (startTime = ${wlStart})`);
    } else {
      console.log('🧠 Whitelist status: NOT YET STARTED');
    }

  } catch (err) {
    console.error(`❌ Init error: ${err.message}`);
  }
})();
