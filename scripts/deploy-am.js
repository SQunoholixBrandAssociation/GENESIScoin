const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀  Deployer:", deployer.address);

  // 1) Deploy AssetMenager (bez argumentów!)
  const AM = await ethers.getContractFactory("AssetMenager");
  const am = await AM.deploy();                 // <-- zero-arg ctor
  await am.deployed();
  console.log("✅  AssetMenager:", am.address);

  // 2) Odczytaj hard-coded adres tokena z kontraktu
  const tokenAddr = await am.tokenGENc();
  console.log("🔗  GENc Token (from AM):", tokenAddr);

  // 3) Udziel approve(MAX) dla AM na tym tokenie
  const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)"
  ];
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, deployer);

  const tx = await token.approve(am.address, ethers.constants.MaxUint256);
  await tx.wait();
  console.log("👍  Approve(MAX) done for AM on token");
}

main().then(()=>process.exit(0)).catch((e)=>{console.error(e);process.exit(1);});

