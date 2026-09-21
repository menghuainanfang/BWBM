"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const BWBM = require("../core.js");

test("balanced answers contain exactly three copies of every symbol", () => {
  const answer = BWBM.balancedAnswer(BWBM.mulberry32(42));
  assert.equal(BWBM.validateAnswer(answer), true);
});

test("the base model does not impose balance on the player's final answer", () => {
  assert.equal(BWBM.CONFIG.finalAnswerMustBeBalanced, false);
});

test("the exact maximum score is 210", () => {
  const answer = BWBM.baselineQuery();
  const mask = BWBM.highMask([0, 7, 14]);
  assert.equal(BWBM.score(answer, answer, mask), 210);
});

test("blanks never score and high positions are worth 30", () => {
  const answer = BWBM.baselineQuery();
  const query = Array(15).fill("");
  query[0] = "A";
  query[3] = "B";
  assert.equal(BWBM.score(query, answer, BWBM.highMask([0, 8, 14])), 40);
});

test("the orthogonal opening keeps every row balanced", () => {
  const rows = BWBM.strategyQueries("orthogonal", 4, 1);
  for (const row of rows) assert.equal(BWBM.validateAnswer(row), true);
});

test("filtering keeps exactly states consistent with feedback", () => {
  const states = BWBM.sampleStates(200, 9);
  const query = BWBM.baselineQuery();
  const observed = BWBM.score(query, states[0].answer, states[0].highMask);
  const filtered = BWBM.filterStates(states, query, observed);
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((state) => BWBM.score(query, state.answer, state.highMask) === observed));
});

test("a deterministic strategy evaluation is reproducible", () => {
  const statesA = BWBM.sampleStates(500, 20260921);
  const statesB = BWBM.sampleStates(500, 20260921);
  const resultA = BWBM.evaluateStrategy(statesA, "cyclic", 3, 17);
  const resultB = BWBM.evaluateStrategy(statesB, "cyclic", 3, 17);
  assert.deepEqual(resultA, resultB);
});
