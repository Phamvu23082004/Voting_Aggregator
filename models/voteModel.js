// const e = require("express");
const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema({
  hash_cipher: { type: String, required: true },
  election_id: { type: String, required: true },
  nullifier: { type: String, required: true },
  C1x: [{ type: String, required: true }],
  C1y: [{ type: String, required: true }],
  C2x: [{ type: String, required: true }],
  C2y: [{ type: String, required: true }],
  isValid: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Vote", voteSchema);
