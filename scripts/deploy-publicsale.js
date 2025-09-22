const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀  Deployer:", deployer.address);

  const PublicSale = await ethers.getContractFactory("PublicSaleGENc");
  const pubSale = await PublicSale.deploy();
  await pubSale.deployed();
  console.log("✅  PublicSaleGENc:", pubSale.address);

  const genAddr = await pubSale.token();
  console.log("🔗  GENc Token hard-coded:", genAddr);

  const GEN = await ethers.getContractAt("IERC20", genAddr, deployer);
  const tx = await GEN.approve(pubSale.address, ethers.constants.MaxUint256);
  await tx.wait();
  console.log("👍  Approve(MAX) done for PublicSale.");
}

main().catch((err) => {
  console.error("❌  Deployment failed:", err);
  process.exit(1);
});
