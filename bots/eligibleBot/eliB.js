require('dotenv').config();
const fs   = require('fs');
const { ethers } = require('ethers');

const {
  WSSURL, PRIVATE_KEY, GEN_TOKEN_ADDRESS, PUBLIC_SALE_ADDRESS, LP_PAIR_ADDRESS,

  MIN_BUY_PHASE1, MIN_BUY_PHASE2, MIN_BUY_PHASE3, MIN_BUY_PHASE4,
  DAILY_BONUS_AMOUNT_PHASE1, DAILY_BONUS_AMOUNT_PHASE2,
  DAILY_BONUS_AMOUNT_PHASE3, DAILY_BONUS_AMOUNT_PHASE4,
  BONUS_PER_DAY_PHASE1, BONUS_PER_DAY_PHASE2,
  BONUS_PER_DAY_PHASE3, BONUS_PER_DAY_PHASE4,
  RESET_INTERVAL_SECONDS = 'PLACEHOLDER'
} = process.env;

const provider = new ethers.providers.WebSocketProvider(WSSURL);
const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

const GEN = new ethers.Contract(
  GEN_TOKEN_ADDRESS,
  ['PLACEHOLDER(address indexed from,address indexed to,uint256 value)'],
  provider
);

const SALE = new ethers.Contract(
  PUBLIC_SALE_ADDRESS,
  [
    'PLACEHOLDER(address,uint256) external',
    'PLACEHOLDER() view returns(uint256)',
    'PLACEHOLDER() view returns(uint256)',
    'PLACEHOLDER() view returns(uint256)'
  ],
  wallet
);

const F = {
  daily :'bonus-daily.json',
  log1  :'log-phase1.json',
  log2  :'log-phase2.json',
  log3  :'log-phase3.json',
  log4  :'log-phase4.json',
  state :'phase-state.json'
};
const read  = (f,d)=>fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):d;
const write = (f,d)=>fs.writeFileSync(f,JSON.stringify(d,null,2));
const now   = ()=>Math.floor(Date.now()/1000);
const DAY   = Number(RESET_INTERVAL_SECONDS);
const toBig = v => BigInt(v ?? "0");

const mustBigInt = (v,n)=>{ if(!v) throw`${n} not set`; return BigInt(v); };
const mustInt    = (v,n)=>{ const x=Number(v); if(Number.isNaN(x)) throw`${n} NaN`; return x; };

const MIN   = {1:mustBigInt(MIN_BUY_PHASE1,'MIN1'), 2:mustBigInt(MIN_BUY_PHASE2,'MIN2'),
               3:mustBigInt(MIN_BUY_PHASE3,'MIN3'), 4:mustBigInt(MIN_BUY_PHASE4,'MIN4')};
const BONUS = {1:mustBigInt(DAILY_BONUS_AMOUNT_PHASE1,'BON1'),2:mustBigInt(DAILY_BONUS_AMOUNT_PHASE2,'BON2'),
               3:mustBigInt(DAILY_BONUS_AMOUNT_PHASE3,'BON3'),4:mustBigInt(DAILY_BONUS_AMOUNT_PHASE4,'BON4')};
const CAP   = {1:mustInt(BONUS_PER_DAY_PHASE1,'CAP1'),2:mustInt(BONUS_PER_DAY_PHASE2,'CAP2'),
               3:mustInt(BONUS_PER_DAY_PHASE3,'CAP3'),4:mustInt(BONUS_PER_DAY_PHASE4,'CAP4')};

let state = { rolloverTokens:"0", phase:1, ...read(F.state,{}) };
let daily = read(F.daily,{});

(async()=>{
  const ts = Number((await SALE.publicSaleStartTimestamp()).toString());
  if(!ts){ console.log('🛑 PublicSale not started'); return; }

  if(state.saleStart !== ts){
    console.log(`🔄 saleStart updated → ${ts}`);
    state.saleStart = ts;
  }

  state.phase = getPhaseFromDay(await getCurrentDay());

  console.log(`🚀 eligibleBot up | phase ${state.phase}`);
  saveState();
  await catchUpResets();
  scheduleReset();
})();

GEN.on('Transfer', async(from,to,value)=>{
  if(from.toLowerCase() !== LP_PAIR_ADDRESS.toLowerCase()) return;

  const day   = await getCurrentDay();
  const phase = getPhaseFromDay(day);
  state.phase = phase;

  if(BigInt(value.toString()) < MIN[phase]) return;

  const capToday = effectiveCap(phase);
  if(!capToday || daily[to] || Object.keys(daily).length >= capToday) return;

  const needed = BONUS[phase];
  const pool   = toBig(await SALE.publicSaleBonusPoolGENc());
  if(pool < needed){ console.log(`⚠️ Pool too small (${pool}) for ${to}`); return; }

  daily[to] = true; write(F.daily,daily);

  try{
    await (await SALE.processDailyBonus(to, day)).wait();
    console.log(`🎯 ${to} bonus sent (phase ${phase}, day ${day})`);
  }catch(e){ console.error('❌ tx error', e.reason || e); }
});

function nextResetTimestamp(){
  const elapsed = now() - state.saleStart;
  const periods = Math.ceil(elapsed / DAY);
  return state.saleStart + periods*DAY;
}
function scheduleReset(){
  const delay = Math.max(1000, nextResetTimestamp()*1000 - Date.now());
  console.log(`🕛 Reset in ${Math.ceil(delay/1000)} seconds`);
  setTimeout(async()=>{
    await dailyReset();
    scheduleReset();
  },delay);
}
async function catchUpResets(){
  if(now() >= nextResetTimestamp() - DAY){
    await dailyReset();
  }
}
async function dailyReset() {
  const day   = await getCurrentDay();
  const phase = getPhaseFromDay(day);
  const bonusA= BONUS[phase];
  const sent  = Object.keys(daily).length;
  const cap   = effectiveCap(phase, true);

  if (phase <= 3 && sent < cap) {
    const leftover = toBig(cap - sent) * bonusA;
    state.rolloverTokens = (toBig(state.rolloverTokens) + leftover).toString();
  }
  if (phase === 4 && sent > 0) {
    const penalty = toBig(sent) * bonusA;
    const current = toBig(state.rolloverTokens);
    state.rolloverTokens = (current > penalty ? current - penalty : 0n).toString();
  }

  if (sent > 0) {
    const file = phase === 1 ? F.log1
              : phase === 2 ? F.log2
              : phase === 3 ? F.log3
              :               F.log4;
    const arr = read(file, []);
    arr.push({ day, list: Object.keys(daily), count: sent, ts: now() });
    write(file, arr);
  }

  daily = {}; write(F.daily, daily);
  state.lastReset = now();
  state.lastDay   = day;
  state.lastPhase = phase;
  saveState();

  console.log(`🔄Daily reset → day ${day}, phase ${phase}, sent ${sent}/${cap}`);
}

async function getCurrentDay(){
  return Number((await SALE.getCurrentDay()).toString());
}
function getPhaseFromDay(day) {
  let newPhase;

  if      (day < PLACEHOLDER)  newPhase = 1;     
  else if (day < PLACEHOLDER)  newPhase = 2;     
  else if (day < PLACEHOLDER)  newPhase = 3;    
  else                newPhase = 4;     

  if (state.phase !== newPhase) {
    console.log(`🔁 Phase changed: ${state.phase} → ${newPhase}`);
    state.phase = newPhase;
    saveState();
  }
  return newPhase;
}
function effectiveCap(phase,raw=false){
  if(phase<=3) return CAP[phase];
  const roll = toBig(state.rolloverTokens);
  const max  = Math.floor(Number(roll / BONUS[4]));
  return raw ? CAP[4] : Math.min(CAP[4], max);
}
function saveState(){
  write(F.state,state);
}