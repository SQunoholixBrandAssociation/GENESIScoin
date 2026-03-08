const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("🚀  Deployer:", deployer.address);

  // deploy
  const AssetManagerV2 = await hre.ethers.getContractFactory("AssetManagerV2");
  const amv2 = await AssetManagerV2.deploy();
  await amv2.deployed();

  console.log("✅  AssetManagerV2 deployed at:", amv2.address);

  // read hard-coded token
  const tokenAddress = await amv2.tokenGENc();
  console.log("🔗  GENc Token hard-coded:", tokenAddress);

  // approve MAX
  const tokenAbi = [
    "function approve(address spender, uint256 amount) external returns (bool)"
  ];
  const token = new hre.ethers.Contract(tokenAddress, tokenAbi, deployer);

  await token.approve(amv2.address, hre.ethers.constants.MaxUint256);

  console.log("👍  Approve(MAX) done.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

