const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("🚀  Deployer:", deployer.address);

  const RM01 = await hre.ethers.getContractFactory("RM01");
  const rm01 = await RM01.deploy();
  await rm01.deployed();
  console.log("✅  RM01 deployed at:", rm01.address);

  const partnersKey = process.env.PARTNERS_PRIVATE_KEY;
  const partners = new hre.ethers.Wallet(partnersKey, hre.ethers.provider);
  console.log("💼  PARTNERS_WALLET:", partners.address);

  const tokenAddress = await rm01.tokenGENc();
  const poolCap = await rm01.POOL_CAP();

  const tokenAbi = [
    "function approve(address spender, uint256 amount) external returns (bool)"
  ];
  const token = new hre.ethers.Contract(tokenAddress, tokenAbi, partners);

  const approveTx = await token.approve(rm01.address, poolCap);
  await approveTx.wait();
  console.log("👍  Approve(50M GENc) done.");

  const rm01AsPartners = rm01.connect(partners);
  const fundTx = await rm01AsPartners.FUND_POOL(poolCap);
  await fundTx.wait();
  console.log("💰  FUND_POOL(50M GENc) done — pool sealed.");

  const status = await rm01.poolStatus();
  console.log("📊  isSealed:", status.isSealed);
  console.log("📊  funded:  ", hre.ethers.utils.formatUnits(status.funded, 18), "GENc");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
