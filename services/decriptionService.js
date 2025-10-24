const fs = require("fs");
const { buildBabyjub } = require("circomlibjs");
const dotenv = require("dotenv");
const { contract2, provider } = require("../configs/blockchain");

dotenv.config();

// 🧮 Brute-force tìm m sao cho M = m·G
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

async function decryptTallyFromChain() {
  try {
    console.log("🔗 Connecting...");
    const startBlock = 9472924;
    const latestBlock = await provider.getBlockNumber();
    const step = 8; // 🔹 Giới hạn cho free Alchemy (≤10 block / request)

    // 🧩 B1. Kiểm tra đã có event AllTrusteesAgreed chưa
    console.log("📡 Checking AllTrusteesAgreed event...");
    let agreedEvents = [];
    for (let from = startBlock; from <= latestBlock; from += step) {
      const to = Math.min(from + step - 1, latestBlock);
      const part = await contract2.queryFilter("AllTrusteesAgreed", from, to);
      agreedEvents.push(...part);
    }

    if (agreedEvents.length === 0) {
      console.warn("⚠️  Chưa có AllTrusteesAgreed — chưa được phép giải mã!");
      return;
    }
    console.log(`✅ Đã có AllTrusteesAgreed (${agreedEvents.length} lần)`);

    // 🧩 B2. Lấy các CipherTotalPublished events
    console.log(`📡 Fetching CipherTotalPublished events...`);
    let allEvents = [];
    for (let from = startBlock; from <= latestBlock; from += step) {
      const to = Math.min(from + step - 1, latestBlock);
      const part = await contract2.queryFilter(
        "CipherTotalPublished",
        from,
        to
      );
      allEvents.push(...part);
    }

    if (allEvents.length === 0) {
      console.warn(
        "⚠️  Không tìm thấy CipherTotalPublished — chưa có dữ liệu tổng hợp!"
      );
      return;
    }
    console.log(`✅ Found ${allEvents.length} ciphertext totals`);

    // 🧩 B3. Chuẩn bị elliptic curve
    const babyjub = await buildBabyjub();
    const F = babyjub.F;
    const G = babyjub.Base8;

    // 🧩 B4. Lặp qua từng candidate và giải mã + đếm phiếu
    const finalResults = [];

    const trustees = [
      process.env.TRUSTEE_ADDRESS1,
      process.env.TRUSTEE_ADDRESS2,
      process.env.TRUSTEE_ADDRESS3,
    ];

    for (const e of allEvents) {
      const { candidateId, C1_total, C2_total } = e.args;
      console.log("C1_total.x =", C1_total[0].toString());
      console.log("C1_total.y =", C1_total[1].toString());
      console.log("C2_total.x =", C2_total[0].toString());
      console.log("C2_total.y =", C2_total[1].toString());
      console.log(`🧮 Candidate #${candidateId.toString()} decrypting...`);

      // Tổng hợp D_i của các trustee
      let sumD = [F.e(0n), F.e(1n)];
      for (const addr of trustees) {
        const D = await contract2.partialDecryptions(addr);
        if (!D[6]) continue; // bỏ qua nếu chưa verify
        const D_i = [F.e(BigInt(D[2])), F.e(BigInt(D[3]))];
        sumD = babyjub.addPoint(sumD, D_i);
      }

      // Giải mã M = C2 - ΣD_i
      const C2 = [F.e(BigInt(C2_total[0])), F.e(BigInt(C2_total[1]))];
      const negSumD = [sumD[0], F.neg(sumD[1])];
      const M = babyjub.addPoint(C2, negSumD);
      const onCurve = babyjub.inCurve(M);
      console.log(`   - Decrypted point M on curve: ${onCurve}`);

      // Đếm phiếu (tìm m)
      const votes = findDiscreteLog(M, G, F, babyjub, 100) ?? "unknown";
      console.log(`✅ Candidate ${candidateId} → ${votes} votes`);

      finalResults.push({
        candidateId: candidateId.toString(),
        decryptedPoint: {
          Mx: F.toObject(M[0]).toString(),
          My: F.toObject(M[1]).toString(),
        },
        votes,
      });
    }

    // 🧩 B5. Lưu kết quả
    fs.writeFileSync(
      "decrypted_tally.json",
      JSON.stringify(finalResults, null, 2)
    );
    console.log(
      "💾 Saved decrypted & counted results to decrypted_tally.json ✅"
    );
  } catch (err) {
    console.error("❌ Error during decryption:", err);
  }
}

decryptTallyFromChain();
