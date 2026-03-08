require('dotenv').config();
const Web3 = require('web3');
const axios = require('axios');


// Configuration
const BSC_RPC_URL = process.env.BSC_RPC_URL;
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const PRE_SALE_ADDRESS = process.env.PRE_SALE_ADDRESS;       // TODO: set actual Pre-Sale contract address
const PUBLIC_SALE_ADDRESS = process.env.PUBLIC_SALE_ADDRESS; // TODO: set actual Public Sale contract address

// Initialize Web3 and Oracle account
const web3 = new Web3(new Web3.providers.HttpProvider(BSC_RPC_URL));
const oracleAccount = web3.eth.accounts.privateKeyToAccount(ORACLE_PRIVATE_KEY);
web3.eth.accounts.wallet.add(oracleAccount);
web3.eth.defaultAccount = oracleAccount.address;

// ABI definitions for required contract functions and events
const preSaleAbi = [
  // Oracle-called functions
  { "inputs": [{ "internalType": "uint256", "name": "_bnbPrice", "type": "uint256" }], "name": "updateBNBPrice", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_stageId", "type": "uint256" }], "name": "closeStageByOracle", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "triggerWhitelistOpen", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "triggerWhitelistClose", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "triggerB100DStart", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "triggerDailyB100DPayout", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "distributeFunds", "outputs": [], "stateMutability": "nonpayable", "type": "function" },

  // View functions
  { "inputs": [], "name": "currentStageId", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "stages",
    "outputs": [
      { "internalType": "uint256", "name": "tokensAvailable", "type": "uint256" },
      { "internalType": "uint256", "name": "tokenPrice", "type": "uint256" },
      { "internalType": "uint256", "name": "bonusPercent", "type": "uint256" },
      { "internalType": "uint256", "name": "tokensSold", "type": "uint256" },
      { "internalType": "uint256", "name": "duration", "type": "uint256" },
      { "internalType": "uint256", "name": "startTime", "type": "uint256" },
      { "internalType": "bool", "name": "isActive", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  { "inputs": [], "name": "preSaleEndTime", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "preSaleEnded", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "b100dWhitelistStartTime", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "b100dWhitelistCloseTime", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "b100dStartTime", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "b100dCurrentDay", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "lastDistributionTime", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "lastPriceUpdateTime", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "bnbPrice", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "token", "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }
];

const publicSaleAbi = [
  // Oracle-called functions (Public Sale phase)
  { "inputs": [], "name": "startPublicSale", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  {
    "inputs": [],
    "name": "publicSaleStartTimestamp",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }

];

// Instantiate contract objects
const preSaleContract = new web3.eth.Contract(preSaleAbi, PRE_SALE_ADDRESS);
const publicSaleContract = new web3.eth.Contract(publicSaleAbi, PUBLIC_SALE_ADDRESS);

// Logger
function log(msg, ...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`, ...args);
}

// State
let preSaleActive = true;
let publicSaleActive = false;
let whitelistOpened = false;
let whitelistClosed = false;
let b100dStarted = false;
let lastPreSalePriceUpdate = 0;
let lastPublicPriceUpdate = 0;
let publicSaleStartTime = null;

// Bootstrapping
(async () => {
  try {
    preSaleActive = !(await preSaleContract.methods.preSaleEnded().call());

    if (!preSaleActive) {
      whitelistOpened = (await preSaleContract.methods.b100dWhitelistStartTime().call()) > 0;
      whitelistClosed = (await preSaleContract.methods.b100dWhitelistCloseTime().call()) > 0;
      b100dStarted = (await preSaleContract.methods.b100dStartTime().call()) > 0;

      // 🔎 check if public sale was already triggered on-chain
      const startTimestamp = parseInt(await publicSaleContract.methods.publicSaleStartTimestamp().call(), 10);
      if (startTimestamp > 0) {
        publicSaleActive = true;
        publicSaleStartTime = startTimestamp;
        log(`✅ Public Sale already started (on-chain @ ${startTimestamp})`);
      } else {
        publicSaleActive = false;
        log(`⌛ Public Sale not yet started (waiting for trigger…)`);
      }
    }

    try { lastPreSalePriceUpdate = parseInt(await preSaleContract.methods.lastPriceUpdateTime().call(), 10); } catch { }
    try { lastPublicPriceUpdate = parseInt(await publicSaleContract.methods.lastPriceUpdateTime().call(), 10); } catch { }

    log(`Pre-Sale active: ${preSaleActive}`);
    startOracleLoops();
  } catch (err) {
    console.error('Initialization failed:', err);
    process.exit(1);
  }
})();

// Oracle loop
function startOracleLoops() {
  setInterval(async () => {
    const now = Math.floor(Date.now() / 1000);

    try {
      const { data } = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
      const bnbPriceUSD = parseFloat(data.price);
      const newPriceInt = Math.round(bnbPriceUSD * 100);

      // Pre-Sale Update
      if (preSaleActive && now - lastPreSalePriceUpdate >= 1740) {
        try {
          await preSaleContract.methods.updateBNBPrice(newPriceInt).send({
            from: oracleAccount.address,
            gas: 500000,
            nonce: await web3.eth.getTransactionCount(oracleAccount.address, 'pending')
          });
          lastPreSalePriceUpdate = now;
          log(`Pre-Sale: BNB price updated to $${bnbPriceUSD.toFixed(2)}`);
        } catch (err) {
          console.error('Pre-Sale updateBNBPrice error:', err.message || err);
        }
      }

    } catch (priceErr) {
      console.error('Error fetching BNB price:', priceErr.message || priceErr);
    }

    try {
      // 2. Handle Pre-Sale stage closures for stages 2-4
      if (preSaleActive) {
        const stageId = parseInt(await preSaleContract.methods.currentStageId().call(), 10);
        if (stageId >= 2 && stageId <= 4) {
          const stage = await preSaleContract.methods.stages(stageId).call();
          const stageStart = parseInt(stage.startTime, 10);
          const stageDur = parseInt(stage.duration, 10);
          const isActive = stage.isActive;

          if (isActive && stageDur > 0 && now >= stageStart + stageDur) {
            try {
              await preSaleContract.methods.closeStageByOracle(stageId).send({
                from: oracleAccount.address,
                gas: 500000,
                nonce: await web3.eth.getTransactionCount(oracleAccount.address, 'pending')
              });
              log(`Pre-Sale: Stage ${stageId} closed by Oracle (duration expired)`);
            } catch (err) {
              console.error(`Error closing Stage ${stageId}:`, err.message || err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Stage closure check error:', err);
    }


    // 3. Trigger whitelist open at Stage 5 start
    if (!whitelistOpened && preSaleActive) {
      const currentStage = parseInt(await preSaleContract.methods.currentStageId().call(), 10);
      const wlStartTime = parseInt(await preSaleContract.methods.b100dWhitelistStartTime().call(), 10);

      if (currentStage === 5 && wlStartTime === 0) {
        try {
          await preSaleContract.methods.triggerWhitelistOpen().send({
            from: oracleAccount.address, gas: 500000,
            nonce: await web3.eth.getTransactionCount(oracleAccount.address, 'pending')
          });
          log('✅ Whitelist registration opened (Stage 5 started)');
          whitelistOpened = true;
        } catch (err) {
          console.error('🚫 Error triggering whitelist open:', err.message || err);
        }
      } else if (wlStartTime > 0) {
        whitelistOpened = true;
        log('⚠️ Whitelist already open — skipping trigger');
      }
    }

    // 4. Check for Pre-Sale end (transition from preSaleActive to ended)
    if (preSaleActive) {
      const ended = await preSaleContract.methods.preSaleEnded().call();
      if (ended) {
        preSaleActive = false;
        log('Pre-Sale phase ended');
        whitelistOpened = true; // if ended, Stage 5 must have been active
      }
    }

    // 5. Trigger whitelist close 24h after Pre-Sale ends
    if (whitelistOpened && !whitelistClosed) {
      const preSaleEndedFlag = await preSaleContract.methods.preSaleEnded().call();
      if (preSaleEndedFlag) {
        const preSaleEndTime = parseInt(await preSaleContract.methods.preSaleEndTime().call(), 10);
        if (now >= preSaleEndTime + 24 * 3600) {
          try {
            await preSaleContract.methods.triggerWhitelistClose().send({
              from: oracleAccount.address, gas: 500000,
              nonce: await web3.eth.getTransactionCount(oracleAccount.address, 'pending')
            });
            log('Whitelist closed (24h after Pre-Sale end)');
            whitelistClosed = true;
          } catch (err) {
            console.error('Error triggering whitelist close:', err.message || err);
          }
        }
      }
    }

    // 6. Trigger B100D start 48h after Pre-Sale ends (24h after whitelist close)
    if (whitelistClosed && !b100dStarted) {
      const wlCloseTime = parseInt(await preSaleContract.methods.b100dWhitelistCloseTime().call(), 10);
      if (wlCloseTime > 0 && now >= wlCloseTime + 24 * 3600) {
        try {
          await preSaleContract.methods.triggerB100DStart().send({
            from: oracleAccount.address, gas: 500000,
            nonce: await web3.eth.getTransactionCount(oracleAccount.address, 'pending')
          });
          log('B100D 100-day bonus distribution started');
          b100dStarted = true;
        } catch (err) {
          console.error('Error triggering B100D start:', err.message || err);
        }
      }
    }

    // 7. Trigger daily B100D payout every 24h for 100 days
    if (b100dStarted) {
      const startTime = parseInt(await preSaleContract.methods.b100dStartTime().call(), 10);
      const currentDay = parseInt(await preSaleContract.methods.b100dCurrentDay().call(), 10);
      const now = Math.floor(Date.now() / 1000);
      const targetTime = startTime + (currentDay + 1) * 86400;
      if (currentDay < 101 && now >= targetTime) {
        try {
          await preSaleContract.methods.triggerDailyB100DPayout().send({
            from: oracleAccount.address,
            gas: 5000000,
            nonce: await web3.eth.getTransactionCount(oracleAccount.address, 'pending')
          });

          log(`🚀 B100D payout triggered for day ${currentDay + 1}, waiting 10s...`);


          await new Promise(resolve => setTimeout(resolve, 10000));

          const newDay = parseInt(await preSaleContract.methods.b100dCurrentDay().call(), 10);
          if (newDay > currentDay) {
            log(`✅ Day ${newDay} completed`);
          } else {
            log(`🔁 Day not completed yet — next Oracle loop will retry`);
          }
        } catch (err) {
          console.error(`❌ Error during B100D payout:`, err.message || err);
        }
      }
    }
    // 8. Distribute funds once per day from Pre-Sale start until 24h after Pre-Sale end
    try {
      const lastDist = parseInt(await preSaleContract.methods.lastDistributionTime().call(), 10);
      const contractBalance = await web3.eth.getBalance(PRE_SALE_ADDRESS); // BNB balance of contract
      const balanceBNB = web3.utils.fromWei(contractBalance, 'ether');

      const preSaleEndedFlag2 = await preSaleContract.methods.preSaleEnded().call();
      const preSaleEndTime2 = preSaleEndedFlag2 ? parseInt(await preSaleContract.methods.preSaleEndTime().call(), 10) : null;
      const withinDistPeriod = preSaleEndedFlag2 ? (now <= preSaleEndTime2 + 24 * 3600) : true;

      const delta = now - lastDist;
      log(`🕒 Distribution check: delta=${delta}s, balance=${balanceBNB} BNB, withinPeriod=${withinDistPeriod}`);

      if (withinDistPeriod && delta >= 86400 && parseFloat(balanceBNB) > 0) {
        await preSaleContract.methods.distributeFunds().send({
          from: oracleAccount.address,
          gas: 500000,
          nonce: await web3.eth.getTransactionCount(oracleAccount.address, 'pending')
        });
        log('✅ Daily funds distribution executed');
      } else {
        if (delta < 86400) log('⏳ Too early for fund distribution (waiting 24h)');
        if (parseFloat(balanceBNB) === 0) log('🚫 No funds available in Pre-Sale contract (BNB == 0)');
      }
    } catch (err) {
      console.error('❌ Error calling distributeFunds:', err.message || err);
    }

    // 9. Start Public Sale by triggering startPublicSale() on-chain
    if (!publicSaleActive) {
      const preSaleEndedFlag = await preSaleContract.methods.preSaleEnded().call();
      const whitelistClosedTime = parseInt(await preSaleContract.methods.b100dWhitelistCloseTime().call(), 10);
      const now = Math.floor(Date.now() / 1000);

      log(`[Oracle Check] PublicSaleStart: preSaleEnded=${preSaleEndedFlag}, whitelistClosedTime=${whitelistClosedTime}, now=${now}, condition=${now >= whitelistClosedTime + 3600}`);

      if (preSaleEndedFlag && whitelistClosedTime > 0 && now >= whitelistClosedTime + 24 * 3600) {
        try {
          await publicSaleContract.methods.startPublicSale().send({
          from: oracleAccount.address,
          gas: 500000,
          nonce: await web3.eth.getTransactionCount(oracleAccount.address, 'pending')
        });
        log('✅ startPublicSale() triggered on-chain by Oracle');
        publicSaleActive = true;
        publicSaleStartTime = now;
      } catch (err) {
        console.error('❌ Error triggering startPublicSale():', err.message || err);
      }
    }
  }

  }, 2 * 60 * 1000);
}

// Fallbacks
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled Promise Rejection:', err));
