const dotenv = require("dotenv");
const { contract2, provider,ganacheContract } = require("../configs/blockchain");
dotenv.config();


const getAllHashOnChain = async () => {
  // const latest = 9559304;
  // const startBlock = 9558053;
  const latest = 7000;
  const startBlock = 4;
  const step = 10;
  const hashSet = new Set();

  for (let from = startBlock; from <= latest; from += step) {
    const to = Math.min(from + step - 1, latest);
    // const events = await contract2.queryFilter("VotePublished", from, to);
        const events = await ganacheContract.queryFilter("VotePublished", from, to);
    for (const e of events) {
      if (e.args?.hashCipher) hashSet.add(e.args.hashCipher.toString());
    }
    console.log(`📡 Quét xong block ${from} → ${to}`);
    console.log(`   - Tổng hashCipher hiện có: ${hashSet.size}`);
  }
  console.log([...hashSet]);

  console.log(`✅ Tổng cộng ${hashSet.size} hashCipher`);
  return hashSet;
};

module.exports = { getAllHashOnChain };
