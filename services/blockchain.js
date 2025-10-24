const dotenv = require("dotenv");
const { contract2, provider } = require("../configs/blockchain");
dotenv.config();


const getAllHashOnChain = async () => {
  const latest = await provider.getBlockNumber();
  const startBlock = 	9473853;
  const step = 10;
  const hashSet = new Set();

  for (let from = startBlock; from <= latest; from += step) {
    const to = Math.min(from + step - 1, latest);
    const events = await contract2.queryFilter("VotePublished", from, to);
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
