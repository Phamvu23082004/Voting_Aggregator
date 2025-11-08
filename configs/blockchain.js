const { ethers } = require("ethers");
require("dotenv").config();

const electionABI1 = require("../contracts/election1.json");
const electionABI2 = require("../contracts/election2.json");
const votingABI = require("../contracts/ganache_voting.json");
const tally = require("../contracts/tally.json");
const hashVerifier = require("../contracts/hashVerify.json");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const providerGanache = new ethers.JsonRpcProvider(process.env.GANACHE_RPC_URL);
console.log("RPC_URL:", process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.CA_PRIVATE_KEY, provider);
const walletGanache = new ethers.Wallet(process.env.GANACHE_PRIVATE_KEY, providerGanache);
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

const tallyContract = new ethers.Contract(
  process.env.CONTRACT_TALLY,
  tally.abi,
  wallet
);

const ganacheContract = new ethers.Contract(
  process.env.GANACHE_CONTRACT_ADDRESS,
  votingABI.abi,
  walletGanache
);

const ganacheContractTally = new ethers.Contract(
  process.env.GANACHE_CONTRACT_TALLY,
  tally.abi,
  walletGanache
);

const ganacheContractHash = new ethers.Contract(
  process.env.GANACHE_CONTRACT_HASH,
  hashVerifier.abi,
  walletGanache
);

module.exports = { provider, wallet, contract1, contract2, tallyContract, ganacheContract, ganacheContractTally, ganacheContractHash };
