require('dotenv').config();
const { ethers } = require('ethers');

/* ─── ABI ─── */
const CONTRACT_ABI = [
  // ── FUNCTIONS ──
  { inputs: [], name: 'preSaleEnded', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'b100dStarted', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'b100dStartTime', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'b100dCurrentDay', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'finalBonusDistributionStarted', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'triggerFinalBonusDistribution', outputs: [], stateMutability: 'nonpayable', type: 'function' },

  // ── EVENTS ──
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: 'uint256', name: 'day', type: 'uint256' }],
    name: 'B100DDayCompleted',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'uint256', name: 'from', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'to', type: 'uint256' }
    ],
    name: 'FinalBonusBatchProcessed',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [],
    name: 'FinalBonusCompleted',
    type: 'event'
  }
];

/* ─── ENV ─── */
const WSS               = process.env.WSSURL;
const PRIVATE_KEY       = process.env.PRIVATE_KEY;
const PRESALE_ADDRESS   = process.env.PRESALE_ADDRESS;
const B100D_DAYS        = parseInt(process.env.B100D_DURATION_DAYS || '101');
const FINAL_DELAY_SEC   = parseInt(process.env.FINAL_DELAY_SECONDS || '86400');  // default 24h

/* ─── Setup ─── */
const provider  = new ethers.providers.WebSocketProvider(WSS);
const signer    = new ethers.Wallet(PRIVATE_KEY, provider);
const contract  = new ethers.Contract(PRESALE_ADDRESS, CONTRACT_ABI, signer);
const log       = (...args) => console.log(`[FinalBonusBot]`, ...args);

let finalDelayTriggered = false;

/* ─── Event: B100D Day Completed ─── */
contract.on('B100DDayCompleted', async (day) => {
  const dayNum = Number(day);
  log(`📅 Event: B100DDayCompleted → Day ${dayNum}`);

  if (dayNum >= B100D_DAYS && !finalDelayTriggered) {
    finalDelayTriggered = true;
    log(`⏳ Waiting ${FINAL_DELAY_SEC / 3600}h before triggering final bonus...`);
    setTimeout(() => triggerFinalBonus(), FINAL_DELAY_SEC * 1000);
  }
});

/* ─── Event: Batch Processed ─── */
contract.on('FinalBonusBatchProcessed', (batch) => {
  log(`📦 Final bonus batch processed: #${batch}`);
  triggerFinalBonus(); // repeat if more batches remain
});

/* ─── Event: Completed ─── */
contract.on('FinalBonusCompleted', () => {
  log(`🎉 Final bonus distribution COMPLETED.`);
});

/* ─── Trigger Logic ─── */
async function triggerFinalBonus() {
  try {
    const alreadyTriggered = await contract.finalBonusDistributionStarted();
    if (alreadyTriggered) return log('❌ Already triggered.');

    log('🚀 Sending final bonus trigger TX...');
    const tx = await contract.triggerFinalBonusDistribution({ gasLimit: 6_000_000 });
    log(`⛽ TX sent: ${tx.hash}`);
    await tx.wait();
    log('✅ Final bonus distribution STARTED.');
  } catch (e) {
    log(`❌ Error:`, e.reason || e.message || e);
  }
}

/* ─── Initial check after start ─── */
(async () => {
  const currentDay = Number(await contract.b100dCurrentDay());
  log(`🔎 Initial b100dCurrentDay = ${currentDay}`);

  if (currentDay >= B100D_DAYS && !finalDelayTriggered) {
    log(`⏳ Already day ${currentDay}, triggering delay timer...`);
    finalDelayTriggered = true;
    setTimeout(() => triggerFinalBonus(), FINAL_DELAY_SEC * 1000);
  }
})();
