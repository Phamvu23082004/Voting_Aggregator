const connectDB = require("./configs/db");
// const { contract } = require("./configs/blockchain");
const { getAllHashOnChain } = require("./services/blockchain");
const { processVotes } = require("./services/tallyService");
// const { submitProofTally } = require("./services/proofService");
// const { buildPoseidon } = require("circomlibjs");

(async () => {
  console.log("🚀 Aggregator khởi động...");

  await connectDB();
  const hashOnChain = await getAllHashOnChain();
  const { validVotes, nCandidates, C1_total_x, C1_total_y, C2_total_x, C2_total_y } = await processVotes(hashOnChain);

  console.log("📦 Kết quả tổng hợp:");
  console.log("   - Số phiếu hợp lệ:", validVotes);
  console.log("   - C1_total_x:", C1_total_x);
  console.log("   - C1_total_y:", C1_total_y);
  console.log("   - C2_total_x:", C2_total_x);
  console.log("   - C2_total_y:", C2_total_y);
  console.log("   - Candidates:", nCandidates);


  console.log("✅ Tổng hợp hoàn tất (chưa tạo proof)");
  process.exit(0);
})();