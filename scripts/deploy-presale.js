const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀  Deployer:", deployer.address);

  const PreSale = await ethers.getContractFactory("PreSaleGENc");
  const presale = await PreSale.deploy();
  await presale.deployed();
  console.log("✅  PreSaleGENc:", presale.address);

  const genAddr = await presale.token();
  console.log("🔗  GENc Token hard-coded:", genAddr);

  const GEN = await ethers.getContractAt("IERC20", genAddr, deployer);
  const tx = await GEN.approve(presale.address, ethers.constants.MaxUint256);
  await tx.wait();
  console.log("👍  Approve(MAX) done.");
}

main().catch((err) => {
  console.error("❌  Deployment failed:", err);
  process.exit(1);
});
