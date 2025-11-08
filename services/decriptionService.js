// const { ethers } = require("ethers");
// const { buildBabyjub } = require("circomlibjs");
// require("dotenv").config();

// const { contract2, provider } = require("../configs/blockchain"); // contract bạn đã export sẵn

// // =======================================================
// // 🔹 1️⃣ Tiện ích toán học
// // =======================================================
// function modInverse(a, m) {
//   a = ((a % m) + m) % m;
//   let [r0, r1] = [a, m];
//   let [s0, s1] = [1n, 0n];
//   while (r1 !== 0n) {
//     const q = r0 / r1;
//     [r0, r1] = [r1, r0 - q * r1];
//     [s0, s1] = [s1, s0 - q * s1];
//   }
//   if (r0 !== 1n) throw new Error("Không tồn tại nghịch đảo modulo");
//   return ((s0 % m) + m) % m;
// }

// // Tìm log rời rạc (demo, chỉ dùng để check kết quả)
// function findDiscreteLog(Mpoint, G, F, babyjub, maxTries = 100) {
//   const identity = [F.e(0n), F.e(1n)];
//   if (
//     F.toObject(Mpoint[0]) === F.toObject(identity[0]) &&
//     F.toObject(Mpoint[1]) === F.toObject(identity[1])
//   )
//     return 0;

//   let test = G;
//   for (let m = 1; m <= maxTries; m++) {
//     if (
//       F.toObject(Mpoint[0]) === F.toObject(test[0]) &&
//       F.toObject(Mpoint[1]) === F.toObject(test[1])
//     )
//       return m;
//     test = babyjub.addPoint(test, G);
//   }
//   return null;
// }

// // =======================================================
// // 🔹 2️⃣ Hàm tiện ích: đọc event theo từng chunk
// // =======================================================
// async function getEventsChunked(contract, eventName, startBlock, endBlock, step = 10) {
//   const events = [];
//   for (let from = startBlock; from <= endBlock; from += step) {
//     const to = Math.min(from + step - 1, endBlock);
//     try {
//       const chunk = await contract.queryFilter(eventName, from, to);
//       events.push(...chunk);
//     } catch (err) {
//       console.error(`⚠️ Error fetching ${eventName} [${from}-${to}]:`, err.message);
//     }
//   }
//   return events;
// }

// // =======================================================
// // 🔹 3️⃣ Quy trình chính: Decrypt từ blockchain
// // =======================================================
// async function decryptTallyFromChain() {
//   try {
//     const babyjub = await buildBabyjub();
//     const F = babyjub.F;
//     const G = babyjub.Base8;
//     const n = babyjub.subOrder;

//     console.log("🔗 Connected to contract:", await contract2.getAddress());

//     const START_BLOCK = 9479458;
//     const END_BLOCK = await provider.getBlockNumber();
//     console.log(`📡 Scanning from block ${START_BLOCK} → ${END_BLOCK}`);

//     // ===========================================================
//     // 1️⃣ Lấy dữ liệu C_total từ event CipherTotalPublished
//     // ===========================================================
//     const cipherEvents = await getEventsChunked(contract2, "CipherTotalPublished", START_BLOCK, END_BLOCK, 10);
//     console.log(`📡 Found ${cipherEvents.length} CipherTotalPublished events`);

//     const C1_total_x = [], C1_total_y = [], C2_total_x = [], C2_total_y = [];
//     for (const e of cipherEvents) {
//       const { C1_total, C2_total } = e.args;
//       C1_total_x.push(C1_total[0].toString());
//       C1_total_y.push(C1_total[1].toString());
//       C2_total_x.push(C2_total[0].toString());
//       C2_total_y.push(C2_total[1].toString());
//     }

//     // ===========================================================
//     // 2️⃣ Lấy các phần D_i từ event PartialDecryptionSubmitted
//     // ===========================================================
//     const partialEvents = await getEventsChunked(contract2, "PartialDecryptionSubmitted", START_BLOCK, END_BLOCK, 10);
//     console.log(`📡 Found ${partialEvents.length} PartialDecryptionSubmitted events`);

//     const trusteeDecryptions = {}; // { address: [[x,y], ...] }
//     for (const e of partialEvents) {
//       const trustee = e.args.trustee.toLowerCase();
//       const D_points = e.args.D_points.map((pair) => [pair[0].toString(), pair[1].toString()]);
//       trusteeDecryptions[trustee] = D_points;
//       console.log(`✅ Loaded ${D_points.length} D_i from trustee: ${trustee}`);
//     }

//     // ===========================================================
//     // 3️⃣ Lấy ID thật của trustee từ blockchain
//     // ===========================================================
//     console.log("📋 Fetching trustee IDs from contract...");

//     const trusteeIDs = {};
//     for (const addr of Object.keys(trusteeDecryptions)) {
//       try {
//         const id = await contract2.trusteeID(addr);
//         trusteeIDs[addr] = BigInt(id.toString());
//         console.log(`🔹 ${addr} → ID = ${trusteeIDs[addr]}`);
//       } catch (err) {
//         console.warn(`⚠️ Không lấy được ID cho ${addr}:`, err.message);
//       }
//     }

//     // ===========================================================
//     // 4️⃣ Kiểm tra lại D_i hợp lệ (optional)
//     // ===========================================================
//     console.log("🧮 Verifying trustee partial decryptions...");

//     const trustees = Object.keys(trusteeDecryptions);
//     const verifiedTrustees = [];

//     for (const addr of trustees) {
//       console.log(`🔍 Checking trustee: ${addr}`);

//       const valid = [];
//       for (let i = 0; i < trusteeDecryptions[addr].length; i++) {
//         const D = [
//           F.e(BigInt(trusteeDecryptions[addr][i][0])),
//           F.e(BigInt(trusteeDecryptions[addr][i][1])),
//         ];
//         const C1 = [F.e(BigInt(C1_total_x[i])), F.e(BigInt(C1_total_y[i]))];

//         // ⚠️ Nếu có PK_i: verify e(D,G)==e(C1,PK_i)
//         valid.push(true);
//       }

//       if (valid.every((v) => v)) {
//         console.log(`✅ Trustee ${addr} → all D_i valid`);
//         verifiedTrustees.push(addr);
//       } else {
//         console.log(`❌ Trustee ${addr} → invalid D_i`);
//       }
//     }

//     // ===========================================================
//     // 5️⃣ Giải mã tổng hợp (Lagrange interpolation)
//     // ===========================================================
//     if (verifiedTrustees.length < 2) {
//       console.log("⚠️ Not enough valid trustees for decryption!");
//       return;
//     }

//     const [T1, T2] = verifiedTrustees;
//     const ID1 = trusteeIDs[T1];
//     const ID2 = trusteeIDs[T2];

//     if (!ID1 || !ID2) throw new Error("❌ Thiếu ID trustee trong blockchain!");

//     const λ1 = (((-ID2 * modInverse(ID1 - ID2, n)) % n) + n) % n;
//     const λ2 = (((-ID1 * modInverse(ID2 - ID1, n)) % n) + n) % n;
//     console.log(`📏 Lagrange coeffs for ${T1} (ID=${ID1}) & ${T2} (ID=${ID2}):`, λ1.toString(), λ2.toString());

//     const nCandidates = C1_total_x.length;
//     const finalResults = [];

//     for (let i = 0; i < nCandidates; i++) {
//       console.log(`🧮 Candidate #${i + 1} decrypting...`);

//       const C2 = [F.e(BigInt(C2_total_x[i])), F.e(BigInt(C2_total_y[i]))];
//       const D1_point = trusteeDecryptions[T1][i].map((v) => F.e(BigInt(v)));
//       const D2_point = trusteeDecryptions[T2][i].map((v) => F.e(BigInt(v)));

//       const D1_scaled = babyjub.mulPointEscalar(D1_point, λ1);
//       const D2_scaled = babyjub.mulPointEscalar(D2_point, λ2);
//       const sumD = babyjub.addPoint(D1_scaled, D2_scaled);

//       const negSumD = [F.neg(sumD[0]), sumD[1]];
//       const M = babyjub.addPoint(C2, negSumD);

//       const votes = findDiscreteLog(M, G, F, babyjub, 100);
//       console.log(`✅ Candidate ${i + 1} → ${votes ?? "unknown"} votes`);

//       finalResults.push({
//         candidateId: i + 1,
//         decryptedPoint: {
//           Mx: F.toObject(M[0]).toString(),
//           My: F.toObject(M[1]).toString(),
//         },
//         votes: votes ?? "unknown",
//       });
//     }

//     console.log("🎉 Final results:", finalResults);
//   } catch (err) {
//     console.error("❌ Error during decryption:", err);
//   }
// }

// decryptTallyFromChain().catch(console.error);

const { ethers } = require("ethers");
const { buildBabyjub } = require("circomlibjs");
const fs = require("fs");
require("dotenv").config();
const path = require("path");
const { groth16 } = require("snarkjs");

const { contract2, provider, tallyContract , ganacheContract, ganacheContractTally} = require("../configs/blockchain");

// =======================================================
// 🔹 1️⃣ Tiện ích toán học
// =======================================================
function modInverse(a, m) {
  a = ((a % m) + m) % m;
  let [r0, r1] = [a, m];
  let [s0, s1] = [1n, 0n];
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  if (r0 !== 1n) throw new Error("Không tồn tại nghịch đảo modulo");
  return ((s0 % m) + m) % m;
}

// Tìm log rời rạc (demo, chỉ dùng để check kết quả)
function findDiscreteLog(Mpoint, G, F, babyjub, maxTries = 100) {
  const identity = [F.e(0n), F.e(1n)];
  if (
    F.toObject(Mpoint[0]) === F.toObject(identity[0]) &&
    F.toObject(Mpoint[1]) === F.toObject(identity[1])
  )
    return 0;

  let test = G;
  for (let m = 1; m <= maxTries; m++) {
    if (
      F.toObject(Mpoint[0]) === F.toObject(test[0]) &&
      F.toObject(Mpoint[1]) === F.toObject(test[1])
    )
      return m;
    test = babyjub.addPoint(test, G);
  }
  return null;
}

// =======================================================
// 🔹 2️⃣ Hàm tiện ích: đọc event theo từng chunk
// =======================================================
async function getEventsChunked(contract, eventName, startBlock, endBlock, step = 10) {
  const events = [];
  for (let from = startBlock; from <= endBlock; from += step) {
    const to = Math.min(from + step - 1, endBlock);
    try {
      const chunk = await contract.queryFilter(eventName, from, to);
      events.push(...chunk);
    } catch (err) {
      console.error(`⚠️ Error fetching ${eventName} [${from}-${to}]:`, err.message);
    }
  }
  return events;
}

// =======================================================
// 🔹 3️⃣ Quy trình chính: Decrypt và tạo input mạch TallyValidity
// =======================================================
async function decryptTallyFromChain() {
  try {
    const babyjub = await buildBabyjub();
    const F = babyjub.F;
    const G = babyjub.Base8;
    const n = babyjub.subOrder;

    // console.log("🔗 Connected to contract:", await contract2.getAddress());
        console.log("🔗 Connected to contract:", await ganacheContract.getAddress());


    const START_BLOCK = 1;
    const END_BLOCK = 22;
    const START_BLOCK2 = 	1;
    const END_BLOCK2 = 22;
    console.log(`📡 Scanning from block ${START_BLOCK} → ${END_BLOCK}`);

    // ===========================================================
    // 1️⃣ Lấy dữ liệu C_total từ event CipherTotalPublished
    // ===========================================================
    console.time("Tally decryption time");
    // const cipherEvents = await getEventsChunked(contract2, "CipherTotalPublished", START_BLOCK, END_BLOCK, 10);
        const cipherEvents = await getEventsChunked(ganacheContract, "CipherTotalPublished", START_BLOCK, END_BLOCK, 10);
    console.log(`📡 Found ${cipherEvents.length} CipherTotalPublished events`);

    const C1_total_x = [], C1_total_y = [], C2_total_x = [], C2_total_y = [];
    for (const e of cipherEvents) {
      const { C1_total, C2_total } = e.args;
      C1_total_x.push(C1_total[0].toString());
      C1_total_y.push(C1_total[1].toString());
      C2_total_x.push(C2_total[0].toString());
      C2_total_y.push(C2_total[1].toString());
    }
    console.log("C1_total_x:",C1_total_x);
    console.log("C1_total_y:",C1_total_y);
    console.log("C2_total_x:",C2_total_x);
    console.log("C2_total_y:",C2_total_y);

    // ===========================================================
    // 2️⃣ Lấy các phần D_i từ event PartialDecryptionSubmitted
    // ===========================================================

    // const partialEvents = await getEventsChunked(contract2, "PartialDecryptionSubmitted", START_BLOCK2, END_BLOCK2, 10);
        const partialEvents = await getEventsChunked(ganacheContract, "PartialDecryptionSubmitted", START_BLOCK2, END_BLOCK2, 10);
    console.log(`📡 Found ${partialEvents.length} PartialDecryptionSubmitted events`);

    const trusteeDecryptions = {}; // { address: [[x,y], ...] }
    for (const e of partialEvents) {
      const trustee = e.args.trustee.toLowerCase();
      const D_points = e.args.D_points.map((pair) => [pair[0].toString(), pair[1].toString()]);
      trusteeDecryptions[trustee] = D_points;
      console.log(`✅ Loaded ${D_points.length} D_i from trustee: ${trustee}`);
    }

    // ===========================================================
    // 3️⃣ Lấy ID thật của trustee từ blockchain
    // ===========================================================
    // console.log("📋 Fetching trustee IDs...");
    // const trusteeIDs = {};
    // for (const addr of Object.keys(trusteeDecryptions)) {
    //   try {
    //     const id = await contract2.trusteeID(addr);
    //     trusteeIDs[addr] = BigInt(id.toString());
    //     console.log(`🔹 ${addr} → ID = ${trusteeIDs[addr]}`);
    //   } catch (err) {
    //     console.warn(`⚠️ Không lấy được ID cho ${addr}:`, err.message);
    //   }
    // }

    // ===========================================================
    // 4️⃣ Giải mã tổng hợp (Lagrange interpolation)
    // ===========================================================
    const trustees = Object.keys(trusteeDecryptions);
    if (trustees.length < 2) throw new Error("❌ Cần ít nhất 2 trustee!");

    const [T1, T2] = trustees;
    const ID1 = 1n;
    const ID2 = 2n;

    const λ1 = (((-ID2 * modInverse(ID1 - ID2, n)) % n) + n) % n;
    const λ2 = (((-ID1 * modInverse(ID2 - ID1, n)) % n) + n) % n;
    console.log(`📏 Lagrange coeffs: λ1=${λ1} λ2=${λ2}`);

    const nCandidates = C1_total_x.length;
    const finalResults = [];

    const inputObject = {
      C2_total_x: [],
      C2_total_y: [],
      D_x: [],
      D_y: [],
      lambda: [λ1.toString(), λ2.toString()],
      Mx: [],
      My: [],
    };

    for (let i = 0; i < nCandidates; i++) {
      console.log(`🧮 Candidate #${i + 1} decrypting...`);

      const C2 = [F.e(BigInt(C2_total_x[i])), F.e(BigInt(C2_total_y[i]))];
      const D1_point = trusteeDecryptions[T1][i].map((v) => F.e(BigInt(v)));
      const D2_point = trusteeDecryptions[T2][i].map((v) => F.e(BigInt(v)));

      const D1_scaled = babyjub.mulPointEscalar(D1_point, λ1);
      const D2_scaled = babyjub.mulPointEscalar(D2_point, λ2);
      const sumD = babyjub.addPoint(D1_scaled, D2_scaled);

      const negSumD = [F.neg(sumD[0]), sumD[1]];
      const M = babyjub.addPoint(C2, negSumD);

      const votes = findDiscreteLog(M, G, F, babyjub, 1000);
      console.log(`✅ Candidate ${i + 1} → ${votes ?? "unknown"} votes`);

      finalResults.push({
        candidateId: i + 1,
        decryptedPoint: {
          Mx: F.toObject(M[0]).toString(),
          My: F.toObject(M[1]).toString(),
        },
        votes: votes ?? "unknown",
      });

      // Thêm vào inputObject (đọc trực tiếp M để tránh undefined)
      inputObject.C2_total_x.push(C2_total_x[i]);
      inputObject.C2_total_y.push(C2_total_y[i]);
      inputObject.D_x.push([trusteeDecryptions[T1][i][0], trusteeDecryptions[T2][i][0]]);
      inputObject.D_y.push([trusteeDecryptions[T1][i][1], trusteeDecryptions[T2][i][1]]);
      inputObject.Mx.push(F.toObject(M[0]).toString());
      inputObject.My.push(F.toObject(M[1]).toString());
    }
    console.timeEnd("Tally decryption time");
    // ===========================================================
    // 5️⃣ Lưu file input cho mạch ZKP
    // ===========================================================
    const dir = ".";
    fs.mkdirSync(dir, { recursive: true });
    const outPath = `${dir}/tally_input.json`;
    fs.writeFileSync(outPath, JSON.stringify(inputObject, null, 2));
    console.log(`🧾 Saved unified tally input (${nCandidates} candidates) → ${outPath}`);

    console.log("🎉 Final results:", finalResults);


    // ===========================================================
    // 6️⃣ Tạo proof cho mạch Tally Validity 
    // ===========================================================
    console.time("Tally proof generation time");
    const inputPath = path.join(__dirname, "../circuits/inputs/tally_input.json");
        const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    
        // console.log("📥 Input nạp vào proof:", input);
    
        // 🧩 2️⃣ Sinh proof bằng snarkjs
        const wasmPath = path.join(__dirname, "../circuits/TallyVerifier/TallyValidity.wasm");
        const zkeyPath = path.join(__dirname, "../circuits/TallyVerifier/TallyValidity.zkey");
    
        const { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zkeyPath);
        console.log("✅ Đã sinh proof thành công");
    console.timeEnd("Tally proof generation time");
    
        // 🧩 3️⃣ Verify off-chain (chắc chắn proof hợp lệ)
        const vKeyPath = path.join(__dirname, "../circuits/TallyVerifier/TallyValidity_key.json");
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
    
    
        // console.log("Public signals:", publicSignals);
        // console.log("a:", a);
        // console.log("b:", b);
        // console.log("c:", c);
        // console.log("inputSignals:", inputSignals);
        // console.log("🧮 Gửi proof on-chain...");
    
        // ⚙️ 5️⃣ Gọi contract.verifyProof() hoặc submitTally()
        // console.time("Tx submitProofTally được xác nhận trong");
        // const tx = await ganacheContractTally.submitTallyProof(a, b, c, inputSignals);
        // console.log(`⛓️  Đã gửi tx: ${tx.hash}`);
        // const receipt = await tx.wait(); // ⏳ chờ tx được xác nhận trên chain
        // console.timeEnd("Tx submitProofTally được xác nhận trong");
  } catch (err) {
    console.error("❌ Error during decryption:", err);
  }
}

decryptTallyFromChain().catch(console.error);
