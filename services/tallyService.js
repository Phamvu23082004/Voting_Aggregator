const { buildBabyjub, buildPoseidon } = require("circomlibjs");
const Vote = require("../models/voteModel");
const fs = require("fs/promises");
const path = require("path");
const { ethers } = require("ethers");

const processVotes = async (hashOnChain) => {
  console.time("Tổng hợp phiếu (cursor+batch)");

  const babyjub = await buildBabyjub();
  const poseidon = await buildPoseidon();
  const F = babyjub.F;

  // 🔹 Kiểm tra input hashOnChain
  if (!hashOnChain || hashOnChain.size === 0) {
    console.warn("Không có hashCipher nào trên chain — bỏ qua tally.");
    return;
  }

  // 🔹 Cursor đọc tuần tự phiếu hợp lệ
  const cursor = Vote.find({ isValid: true }).lean().cursor();

  let validVotes = 0;
  const nCandidates = 10;

  // 🔹 Tổng hợp ban đầu
  let C1_total_x = Array(nCandidates).fill(F.e(0n));
  let C1_total_y = Array(nCandidates).fill(F.e(1n));
  let C2_total_x = Array(nCandidates).fill(F.e(0n));
  let C2_total_y = Array(nCandidates).fill(F.e(1n));

  const BATCH_SIZE = 300;
  let batchVotes = [];

  // ========== HÀM CỘNG BATCH ==========
  const addBatch = (batch) => {
    if (!batch.length) return;
    for (let i = 0; i < nCandidates; i++) {
      let accC1 = [F.e(0n), F.e(1n)];
      let accC2 = [F.e(0n), F.e(1n)];

      for (const v of batch) {
        if (!Array.isArray(v.C1x) || v.C1x.length <= i) continue;
        try {
          const C1 = [F.e(BigInt(v.C1x[i])), F.e(BigInt(v.C1y[i]))];
          const C2 = [F.e(BigInt(v.C2x[i])), F.e(BigInt(v.C2y[i]))];
          accC1 = babyjub.addPoint(accC1, C1);
          accC2 = babyjub.addPoint(accC2, C2);
        } catch (err) {
          console.warn(`Bỏ phiếu lỗi tại ${v._id}:`, err.message);
        }
      }

      const totalC1 = [C1_total_x[i], C1_total_y[i]];
      const totalC2 = [C2_total_x[i], C2_total_y[i]];
      const newC1 = babyjub.addPoint(totalC1, accC1);
      const newC2 = babyjub.addPoint(totalC2, accC2);
      C1_total_x[i] = newC1[0];
      C1_total_y[i] = newC1[1];
      C2_total_x[i] = newC2[0];
      C2_total_y[i] = newC2[1];
    }
  };

  let accCipherAll = F.e(0n);  
  let accChainAll = F.e(0n);

  // ========== DUYỆT PHIẾU ==========
  for await (const v of cursor) {
    if (!Array.isArray(v.C1x) || v.C1x.length !== nCandidates) {
      console.warn(` Phiếu ${v._id} thiếu dữ liệu — bỏ qua.`);
      continue;
    }

    // Tính hashCipher
    let acc = F.e(0n);
    for (let i = 0; i < nCandidates; i++) {
      const h = poseidon([
        BigInt(v.C1x[i]),
        BigInt(v.C1y[i]),
        BigInt(v.C2x[i]),
        BigInt(v.C2y[i]),
      ]);
      acc = poseidon([acc, h]);
      
    }

    const hashCipher = F.toObject(acc).toString();
    const hashCipherBytes32 = ethers.zeroPadValue(
      ethers.toBeHex(hashCipher),
      32
    );
    console.log(` Xử lý phiếu ${v._id} — hashCipher: ${hashCipherBytes32}`);

    // So khớp với dữ liệu on-chain
    if (!hashOnChain.has(hashCipherBytes32)) {
      continue;
    }

    console.log(` Phiếu hợp lệ khớp hash: ${hashCipherBytes32}`);
    validVotes++;
    batchVotes.push(v);

    accCipherAll = poseidon([accCipherAll, BigInt(hashCipher)]);

    if (batchVotes.length >= BATCH_SIZE) {
      addBatch(batchVotes);
      batchVotes = [];
    }
  }

  // 🔹 Cộng phần còn lại
  if (batchVotes.length) addBatch(batchVotes);

  console.log(` Tổng hợp hoàn tất — ${validVotes} phiếu hợp lệ`);
  console.timeEnd("⏱️ Tổng hợp phiếu (cursor+batch)");

  const hashCipherAll = F.toObject(accCipherAll).toString();

  // 🔹 Tính hashAllOnChain (Poseidon toàn bộ hashCipher on-chain, sort để cố định)
  const sortedHashes = Array.from(hashOnChain);
  for (const hStr of sortedHashes) {
    accChainAll = poseidon([accChainAll, BigInt(hStr)]);
  }

  
  const hashAllOnChain = F.toObject(accChainAll).toString();
  console.log("hashcipherall",hashCipherAll);
  console.log("hashonchainall",hashAllOnChain);

  const inputData = {
    hashCipherAll: hashCipherAll,
    hashAllOnChain: hashAllOnChain
  };

  await fs.writeFile(
    path.join(__dirname, "../circuits/inputs/hash_commit_input.json"),
    JSON.stringify(inputData, null, 2)
  );

  // 🔹 Ghi file kết quả
  const result = {
    nCandidates,
    validVotes,
    C1_total_x: C1_total_x.map((x) => F.toObject(x).toString()),
    C1_total_y: C1_total_y.map((y) => F.toObject(y).toString()),
    C2_total_x: C2_total_x.map((x) => F.toObject(x).toString()),
    C2_total_y: C2_total_y.map((y) => F.toObject(y).toString()),
  };

  await fs.writeFile(
    path.join(__dirname, "../tally_result.json"),
    JSON.stringify(result, null, 2)
  );

  console.log(" Đã tạo tally_result.json");
  return result;
};



module.exports = { processVotes };
