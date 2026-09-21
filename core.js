(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BWBM = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONFIG = Object.freeze({
    n: 15,
    alphabet: Object.freeze(["A", "B", "C", "D", "E"]),
    copiesPerSymbol: 3,
    highPositionCount: 3,
    ordinaryWeight: 1,
    highWeight: 3,
    pointUnit: 10,
    queryBudget: 10,
    finalAnswerMustBeBalanced: false,
    answerStateCount: 168168000,
    highSetCount: 455,
    jointStateCount: 76516440000,
  });

  function mulberry32(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(values, rng) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function balancedAnswer(rng) {
    const values = [];
    for (const symbol of CONFIG.alphabet) {
      for (let i = 0; i < CONFIG.copiesPerSymbol; i += 1) values.push(symbol);
    }
    return shuffle(values, rng);
  }

  function highPositions(rng) {
    return shuffle(Array.from({ length: CONFIG.n }, (_, i) => i), rng)
      .slice(0, CONFIG.highPositionCount)
      .sort((a, b) => a - b);
  }

  function highMask(positions) {
    let mask = 0;
    for (const position of positions) mask |= 1 << position;
    return mask;
  }

  function makeState(rng) {
    return { answer: balancedAnswer(rng), highMask: highMask(highPositions(rng)) };
  }

  function validateAnswer(answer) {
    if (!Array.isArray(answer) || answer.length !== CONFIG.n) return false;
    return CONFIG.alphabet.every(
      (symbol) => answer.filter((value) => value === symbol).length === CONFIG.copiesPerSymbol
    );
  }

  function normalizeQuery(query) {
    return Array.from({ length: CONFIG.n }, (_, i) => {
      const value = query[i];
      return CONFIG.alphabet.includes(value) ? value : "";
    });
  }

  function score(query, answer, mask) {
    let weightedMatches = 0;
    for (let i = 0; i < CONFIG.n; i += 1) {
      if (query[i] && query[i] === answer[i]) {
        weightedMatches += mask & (1 << i) ? CONFIG.highWeight : CONFIG.ordinaryWeight;
      }
    }
    return CONFIG.pointUnit * weightedMatches;
  }

  function sampleStates(count, seed) {
    const rng = mulberry32(seed);
    return Array.from({ length: count }, () => makeState(rng));
  }

  function baselineQuery() {
    return CONFIG.alphabet.flatMap((symbol) => Array(CONFIG.copiesPerSymbol).fill(symbol));
  }

  function rotateSymbols(query, amount) {
    return normalizeQuery(query).map((symbol) => {
      if (!symbol) return "";
      const index = CONFIG.alphabet.indexOf(symbol);
      return CONFIG.alphabet[(index + amount) % CONFIG.alphabet.length];
    });
  }

  function strategyQueries(strategy, rounds, seed) {
    const base = baselineQuery();
    if (strategy === "baseline-only") return Array.from({ length: rounds }, () => base.slice());
    if (strategy === "cyclic") {
      return Array.from({ length: rounds }, (_, round) => rotateSymbols(base, round));
    }
    if (strategy === "orthogonal") {
      return Array.from({ length: rounds }, (_, round) =>
        Array.from({ length: CONFIG.n }, (_, position) => {
          const block = Math.floor(position / 3);
          const within = position % 3;
          return CONFIG.alphabet[(block + round * (within + 1)) % 5];
        })
      );
    }
    if (strategy === "concentrated") {
      return Array.from({ length: rounds }, (_, round) => {
        const query = Array(CONFIG.n).fill(CONFIG.alphabet[round % 5]);
        query[(round * 4 + 14) % CONFIG.n] = "";
        return query;
      });
    }
    if (strategy === "random-balanced") {
      const rng = mulberry32(seed ^ 0x9e3779b9);
      return Array.from({ length: rounds }, () => shuffle(base, rng));
    }
    throw new Error(`Unknown strategy: ${strategy}`);
  }

  function signature(state, queries) {
    return queries.map((query) => score(query, state.answer, state.highMask)).join("/");
  }

  function partition(states, queries) {
    const buckets = new Map();
    for (const state of states) {
      const key = signature(state, queries);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    return buckets;
  }

  function distribution(states, query) {
    const counts = new Map();
    for (const state of states) {
      const value = score(query, state.answer, state.highMask);
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return Array.from(counts, ([value, count]) => ({ value: Number(value), count }))
      .sort((a, b) => a.value - b.value);
  }

  function entropyFromCounts(counts, total) {
    let entropy = 0;
    for (const count of counts) {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }
    return entropy;
  }

  function metricsFromBuckets(buckets, sampleSize) {
    const counts = Array.from(buckets.values());
    const entropy = entropyFromCounts(counts, sampleSize);
    const collisionProbability = counts.reduce((sum, count) => sum + (count / sampleSize) ** 2, 0);
    const largestBucket = Math.max(...counts);
    const sampleSeparated = counts.filter((count) => count === 1).length / sampleSize;
    return {
      entropy,
      signatureCount: buckets.size,
      effectiveRemaining: CONFIG.jointStateCount / 2 ** entropy,
      expectedBucketShare: collisionProbability,
      largestBucketShare: largestBucket / sampleSize,
      sampleSeparated,
    };
  }

  function evaluateStrategy(states, strategy, rounds, seed) {
    const queries = strategyQueries(strategy, rounds, seed);
    return { strategy, queries, ...metricsFromBuckets(partition(states, queries), states.length) };
  }

  function filterStates(states, query, observedScore) {
    return states.filter((state) => score(query, state.answer, state.highMask) === observedScore);
  }

  function formatInteger(value) {
    return Math.round(value).toLocaleString("zh-CN");
  }

  return {
    CONFIG,
    mulberry32,
    shuffle,
    balancedAnswer,
    highPositions,
    highMask,
    makeState,
    validateAnswer,
    normalizeQuery,
    score,
    sampleStates,
    baselineQuery,
    rotateSymbols,
    strategyQueries,
    signature,
    partition,
    distribution,
    entropyFromCounts,
    metricsFromBuckets,
    evaluateStrategy,
    filterStates,
    formatInteger,
  };
});
