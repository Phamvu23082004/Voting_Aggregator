const {ganacheContract} = require("./configs/blockchain");

exports.registerAgg = async () => {
  try {
    console.log("Đăng ký Aggregator với contract Ganache...");      
    const tx = await ganacheContract.setAggregator("0xFAe11b94ACf628c44686559d3B76338c1EdC985d");
    console.log(`⛓️  Đã gửi tx đăng ký: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log("✅ Đăng ký Aggregator thành công trên Ganache!");
    } catch (error) {
    console.error("❌ Lỗi đăng ký Aggregator trên Ganache:", error);
  }
};

// Tự chạy khi gọi file trực tiếp
if (require.main === module) {
  exports.registerAgg();
}