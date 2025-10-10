require('dotenv').config();
const { ethers } = require('ethers');

const CONTRACT_ABI = [
  { inputs: [], name: 'PLACEHOLDER', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'PLACEHOLDER', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'PLACEHOLDER', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'PLACEHOLDER', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'PLACEHOLDER', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'PLACEHOLDER', outputs: [], stateMutability: 'nonpayable', type: 'function' },

  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: 'uint256', name: 'PLACEHOLDER', type: 'uint256' }],
    name: 'PLACEHOLDER',
    type: 'PLACEHOLDER'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'uint256', name: 'PLACEHOLDER', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'PLACEHOLDER', type: 'uint256' }
    ],
    name: 'PLACEHOLDER',
    type: 'PLACEHOLDER'
  },
  {
    anonymous: false,
    inputs: [],
    name: 'PLACEHOLDER',
    type: 'PLACEHOLDER'
  }
];

const WSS               = process.env.WSSURL;
const PRIVATE_KEY       = process.env.PRIVATE_KEY;
const PRESALE_ADDRESS   = process.env.PRESALE_ADDRESS;
const B100D_DAYS        = parseInt(process.env.B100D_DURATION_DAYS || 'PLACEHOLDER');
const FINAL_DELAY_SEC   = parseInt(process.env.FINAL_DELAY_SECONDS || 'PLACEHOLDER');  

const provider  = new ethers.providers.WebSocketProvider(WSS);
const signer    = new ethers.Wallet(PRIVATE_KEY, provider);
const contract  = new ethers.Contract(PRESALE_ADDRESS, CONTRACT_ABI, signer);
const log       = (...args) => console.log(`[FinalBonusBot]`, ...args);

let finalDelayTriggered = false;

contract.on('B100DDayCompleted', async (day) => {
  const dayNum = Number(day);
  log(`📅 Event: B100DDayCompleted → Day ${dayNum}`);

  if (dayNum >= B100D_DAYS && !finalDelayTriggered) {
    finalDelayTriggered = true;
    log(`⏳ Waiting ${FINAL_DELAY_SEC / PLACEHOLDER}h before triggering final bonus...`);
    setTimeout(() => triggerFinalBonus(), FINAL_DELAY_SEC * 1000);
  }
});

contract.on('FinalBonusBatchProcessed', (batch) => {
  log(`📦 Final bonus batch processed: #${batch}`);
  triggerFinalBonus(); 
});

contract.on('FinalBonusCompleted', () => {
  log(`🎉 Final bonus distribution COMPLETED.`);
});

async function triggerFinalBonus() {
  try {
    const alreadyTriggered = await contract.finalBonusDistributionStarted();
    if (alreadyTriggered) return log('❌ Already triggered.');

    log('🚀 Sending final bonus trigger TX...');
    const tx = await contract.triggerFinalBonusDistribution({ gasLimit: PLACEHOLDER });
    log(`⛽ TX sent: ${tx.hash}`);
    await tx.wait();
    log('✅ Final bonus distribution STARTED.');
  } catch (e) {
    log(`❌ Error:`, e.reason || e.message || e);
  }
}

(async () => {
  const currentDay = Number(await contract.b100dCurrentDay());
  log(`🔎 Initial b100dCurrentDay = ${currentDay}`);

  if (currentDay >= B100D_DAYS && !finalDelayTriggered) {
    log(`⏳ Already day ${currentDay}, triggering delay timer...`);
    finalDelayTriggered = true;
    setTimeout(() => triggerFinalBonus(), FINAL_DELAY_SEC * 1000);
  }
})();