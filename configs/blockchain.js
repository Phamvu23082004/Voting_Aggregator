const { ethers } = require("ethers");
require("dotenv").config();

const electionABI1 = require("../contracts/election1.json");
const electionABI2 = require("../contracts/election2.json");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
console.log("RPC_URL:", process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.CA_PRIVATE_KEY, provider);
const contract1 = new ethers.Contract(
  process.env.CONTRACT_ADDRESS1,
  electionABI1.abi,
  wallet
);

const contract2 = new ethers.Contract(
  process.env.CONTRACT_ADDRESS2,
  electionABI2.abi,
  wallet
);

module.exports = { provider, wallet, contract1, contract2 };
