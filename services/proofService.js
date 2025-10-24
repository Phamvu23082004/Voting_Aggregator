const fs = require("fs");
const path = require("path");
const { groth16 } = require("snarkjs");
const { ethers } = require("ethers");
const dotenv = require("dotenv");
const { contract1, contract2 } = require("../configs/blockchain");
dotenv.config();

const submitProofTally = async () => {
  try {
    console.log("🚀 Bắt đầu tạo proof cho HashCommitCheck...");

    // 🧩 1️⃣ Đọc input do BE tạo (hashCipherAll & hashAllOnChain)
    const inputPath = path.join(__dirname, "../circuits/inputs/hash_commit_input.json");
    const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));

    console.log("📥 Input nạp vào proof:", input);

    // 🧩 2️⃣ Sinh proof bằng snarkjs
    const wasmPath = path.join(__dirname, "../circuits/HashCommitCheck/HashCommitCheck.wasm");
    const zkeyPath = path.join(__dirname, "../circuits/HashCommitCheck/HashCommitCheck_final.zkey");

    const { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zkeyPath);
    console.log("✅ Đã sinh proof thành công");

    // 🧩 3️⃣ Verify off-chain (chắc chắn proof hợp lệ)
    const vKeyPath = path.join(__dirname, "../circuits/HashCommitCheck/verification_key.json");
    const vKey = JSON.parse(fs.readFileSync(vKeyPath, "utf8"));

    const verified = await groth16.verify(vKey, publicSignals, proof);
    if (!verified) throw new Error("❌ Proof verify thất bại off-chain!");
    console.log("✅ Proof verify off-chain thành công");

    // 🧾 4️⃣ Chuẩn hoá proof để gửi lên blockchain
    // Groth16 proof gồm a, b, c — cần format lại để hợp với Solidity verifier
    const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
    const argv = calldata
      .replace(/["[\]\s]/g, "")
      .split(",")
      .map((x) => BigInt(x).toString());

    const a = [argv[0], argv[1]];
    const b = [
      [argv[2], argv[3]],
      [argv[4], argv[5]],
    ];
    const c = [argv[6], argv[7]];

    const inputSignals = [publicSignals[0].toString()];


    console.log("Public signals:", publicSignals);
    console.log("a:", a);
    console.log("b:", b);
    console.log("c:", c);
    console.log("inputSignals:", inputSignals);
    console.log("🧮 Gửi proof on-chain...");

    // ⚙️ 5️⃣ Gọi contract.verifyProof() hoặc submitTally()
    const tx = await contract1.submitProof(a, b, c, inputSignals);
    console.log(`⛓️  Đã gửi tx: ${tx.hash}`);
    const receipt = await tx.wait(); // ⏳ chờ tx được xác nhận trên chain

    // console.log("📜 Số block xác nhận:", receipt.confirmations);


     console.log("📦 Bắt đầu publishAllCipherTotals...");

    const tallyPath = path.join(__dirname, "../tally_result.json");
    const tally = JSON.parse(fs.readFileSync(tallyPath, "utf8"));

    const nCandidates = tally.nCandidates || tally.C1_total_x.length;
    const C1_list = [];
    const C2_list = [];

    for (let i = 0; i < nCandidates; i++) {
      C1_list.push([tally.C1_total_x[i], tally.C1_total_y[i]]);
      C2_list.push([tally.C2_total_x[i], tally.C2_total_y[i]]);
    }

    console.log(`📊 Tổng số ứng viên: ${nCandidates}`);
    console.log("🧮 Đang gửi transaction publishAllCipherTotals...");

    const tx2 = await contract2.publishAllCipherTotals(C1_list, C2_list);
    console.log("c1_list",C1_list);
    console.log("c2_list",C2_list);
    console.log(`⛓️  Tx gửi publishAllCipherTotals: ${tx2.hash}`);

    const receipt2 = await tx2.wait();
    console.log("✅ Đã publishAllCipherTotals thành công! Gas used:", receipt2.gasUsed.toString());


  } catch (err) {
    console.error("❌ Lỗi trong submitProofTally:", err.message);
  }
};

module.exports = { submitProofTally };

// Tự chạy khi gọi file trực tiếp
if (require.main === module) {
  submitProofTally();
}
