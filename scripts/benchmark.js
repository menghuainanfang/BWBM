"use strict";

const fs = require("node:fs");
const path = require("node:path");
const BWBM = require("../core.js");

const STRATEGIES = ["baseline-only", "cyclic", "orthogonal", "random-balanced", "concentrated"];
const seed = Number(process.argv[2] || 20260921) >>> 0;
const sampleSize = Number(process.argv[3] || 12000);

if (!Number.isInteger(sampleSize) || sampleSize < 100) {
  throw new Error("sample size must be an integer of at least 100");
}

const states = BWBM.sampleStates(sampleSize, seed);
const records = [];

for (let rounds = 1; rounds <= 4; rounds += 1) {
  STRATEGIES.forEach((strategy, index) => {
    const result = BWBM.evaluateStrategy(states, strategy, rounds, seed + index * 101);
    records.push({
      rounds,
      strategy,
      entropy_bits: result.entropy,
      signature_count: result.signatureCount,
      largest_bucket_share: result.largestBucketShare,
      collision_probability: result.expectedBucketShare,
      sample_separated_share: result.sampleSeparated,
    });
  });
}

const metadata = {
  model: "Balanced Weighted Black-Peg Mastermind",
  estimator: "Monte Carlo partition of uniformly sampled joint (X,H) states",
  seed,
  sample_size: sampleSize,
  generated_at: new Date().toISOString(),
  configuration: BWBM.CONFIG,
};

const outputDirectory = path.join(__dirname, "..", "results");
fs.mkdirSync(outputDirectory, { recursive: true });
const stem = `opening_benchmark_seed_${seed}_n_${sampleSize}`;
const jsonPath = path.join(outputDirectory, `${stem}.json`);
const csvPath = path.join(outputDirectory, `${stem}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify({ metadata, records }, null, 2)}\n`, "utf8");
const header = Object.keys(records[0]);
const csv = [header.join(","), ...records.map((record) => header.map((key) => record[key]).join(","))].join("\n");
fs.writeFileSync(csvPath, `${csv}\n`, "utf8");

console.log(`Wrote ${path.relative(process.cwd(), jsonPath)}`);
console.log(`Wrote ${path.relative(process.cwd(), csvPath)}`);
