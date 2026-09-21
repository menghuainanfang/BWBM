(function () {
  "use strict";

  const {
    CONFIG, mulberry32, makeState, sampleStates, baselineQuery, shuffle,
    normalizeQuery, validateAnswer, score, distribution, entropyFromCounts, filterStates,
  } = window.BWBM;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const VALUES = ["", ...CONFIG.alphabet];
  const SAMPLE_SIZE = 8000;

  let seed = 0;
  let truth = null;
  let allSamples = [];
  let candidates = [];
  let query = Array(CONFIG.n).fill("");
  let history = [];
  let finalMode = false;
  let finished = false;
  let toastTimer = 0;

  function buildBoard() {
    const board = $("#answer-board");
    board.innerHTML = "";
    for (let index = 0; index < CONFIG.n; index += 1) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "answer-tile";
      tile.innerHTML = `<small>${String(index + 1).padStart(2, "0")}</small><strong>·</strong>`;
      tile.addEventListener("click", () => cycleTile(index));
      tile.addEventListener("keydown", (event) => {
        const value = event.key.toUpperCase();
        if (CONFIG.alphabet.includes(value)) {
          event.preventDefault();
          query[index] = value;
          renderBoard();
        }
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          query[index] = "";
          renderBoard();
        }
      });
      board.append(tile);
    }
  }

  function cycleTile(index) {
    if (finished) return;
    query[index] = VALUES[(VALUES.indexOf(query[index]) + 1) % VALUES.length];
    renderBoard();
  }

  function renderBoard() {
    $$(".answer-tile").forEach((tile, index) => {
      const value = query[index] || "";
      tile.dataset.value = value;
      tile.querySelector("strong").textContent = value || "·";
      tile.setAttribute("aria-label", `第 ${index + 1} 题，${value || "留空"}。点击切换`);
      tile.disabled = finished;
    });
    updateForecast();
  }

  function buildRoundTrack() {
    const track = $("#round-track");
    track.innerHTML = "";
    for (let i = 0; i < CONFIG.queryBudget; i += 1) track.append(document.createElement("i"));
  }

  function renderRoundTrack() {
    $$("#round-track i").forEach((bar, index) => {
      bar.className = index < history.length ? "used" : index === history.length && !finalMode ? "current" : "";
    });
  }

  function updateForecast() {
    if (!candidates.length) return;
    const items = distribution(candidates, normalizeQuery(query));
    const entropy = entropyFromCounts(items.map((item) => item.count), candidates.length);
    $("#forecast-bits").textContent = entropy.toFixed(2);
  }

  function updateResearch() {
    const ratio = candidates.length / allSamples.length;
    $("#survivor-count").textContent = candidates.length.toLocaleString("zh-CN");
    $("#gained-bits").textContent = (-Math.log2(ratio)).toFixed(2);
  }

  function randomBalanced() {
    const rng = mulberry32((seed + history.length * 7919 + 17) >>> 0);
    return shuffle(baselineQuery(), rng);
  }

  function fillBoard(kind) {
    if (finished) return;
    if (kind === "baseline") query = baselineQuery();
    if (kind === "random") query = randomBalanced();
    if (kind === "clear") query = Array(CONFIG.n).fill("");
    renderBoard();
  }

  function showMessage(text) {
    $("#message").textContent = text;
  }

  function showToast(text) {
    const toast = $("#toast");
    toast.textContent = text;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function addHistory(entry) {
    $("#empty-history").hidden = true;
    const row = document.createElement("li");
    row.innerHTML = `<span>Q${String(entry.round).padStart(2, "0")}</span><code>${entry.query.map((value) => value || "·").join("")}</code><strong>${entry.score}</strong>`;
    $("#history-list").prepend(row);
  }

  function submitSimulation() {
    if (query.every((value) => !value)) {
      showMessage("至少填写一个位置，这次查询才会带来信息。 ");
      return;
    }
    const observed = score(normalizeQuery(query), truth.answer, truth.highMask);
    candidates = filterStates(candidates, normalizeQuery(query), observed);
    const entry = { round: history.length + 1, query: query.slice(), score: observed };
    history.push(entry);
    addHistory(entry);
    $("#latest-score").textContent = observed;
    $("#used-count").textContent = `${history.length} / 10`;
    updateResearch();
    renderRoundTrack();
    showMessage(`得到 ${observed} 分；再换一种排列，观察分数怎样变化。`);
    if (history.length >= CONFIG.queryBudget) enterFinalMode();
    else {
      $("#round-number").textContent = history.length + 1;
      updateForecast();
    }
  }

  function enterFinalMode() {
    finalMode = true;
    $("#mode-label").textContent = "最终交卷";
    $("#board-title").innerHTML = "写下最终答案";
    $("#submit-button").innerHTML = "确认交卷 <span>→</span>";
    $("#finish-early").hidden = true;
    showMessage("请填满 15 个位置；最终答卷本身不要求五个字母各出现三次。 ");
    renderRoundTrack();
  }

  function submitFinal() {
    if (query.some((value) => !CONFIG.alphabet.includes(value))) {
      showMessage("最终交卷不能留空，请填满 15 个位置。 ");
      return;
    }
    if (CONFIG.finalAnswerMustBeBalanced && !validateAnswer(query)) {
      showMessage("最终答案必须让 A、B、C、D、E 各出现三次。 ");
      return;
    }
    finished = true;
    const finalScore = score(query, truth.answer, truth.highMask);
    const high = Array.from({ length: CONFIG.n }, (_, i) => i).filter((i) => truth.highMask & (1 << i)).map((i) => i + 1);
    $("#final-score").textContent = finalScore;
    $("#result-copy").textContent = finalScore === 210 ? "全部命中。你完整破解了隐藏状态。" : `你用了 ${history.length} 次模拟，拿到了 ${finalScore} / 210 分。`;
    $("#true-answer").textContent = truth.answer.join("");
    $("#high-positions").textContent = high.join("、");
    $("#result-screen").hidden = false;
    renderBoard();
  }

  function submit() {
    if (finished) return;
    if (finalMode) submitFinal();
    else submitSimulation();
  }

  function startNewGame(showRules) {
    seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const rng = mulberry32(seed);
    truth = makeState(rng);
    allSamples = sampleStates(SAMPLE_SIZE, seed ^ 0xa5a5a5a5);
    allSamples.push(truth);
    candidates = allSamples.slice();
    query = baselineQuery();
    history = [];
    finalMode = false;
    finished = false;
    $("#latest-score").textContent = "—";
    $("#round-number").textContent = "1";
    $("#used-count").textContent = "0 / 10";
    $("#mode-label").textContent = "模拟阶段";
    $("#board-title").innerHTML = '第 <b id="round-number">1</b> 次查询';
    $("#submit-button").innerHTML = '提交模拟 <span>→</span>';
    $("#finish-early").hidden = false;
    $("#history-list").innerHTML = "";
    $("#empty-history").hidden = false;
    $("#result-screen").hidden = true;
    showMessage("平衡排列已经填好；你可以直接提交，也可以先改动。 ");
    renderBoard();
    renderRoundTrack();
    updateResearch();
    if (showRules) $("#rules-dialog").showModal();
  }

  async function shareGame() {
    const data = { title: "白纸考试 · BWBM", text: "10 次模拟，破解 15 道题的隐藏答案。", url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        showToast("链接已复制");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        const area = document.createElement("textarea");
        area.value = data.url;
        document.body.append(area);
        area.select();
        document.execCommand("copy");
        area.remove();
        showToast("链接已复制");
      }
    }
  }

  function init() {
    buildBoard();
    buildRoundTrack();
    $$("[data-fill]").forEach((button) => button.addEventListener("click", () => fillBoard(button.dataset.fill)));
    $("#submit-button").addEventListener("click", submit);
    $("#finish-early").addEventListener("click", enterFinalMode);
    $("#new-game").addEventListener("click", () => startNewGame(false));
    $("#play-again").addEventListener("click", () => startNewGame(false));
    $("#rules-button").addEventListener("click", () => $("#rules-dialog").showModal());
    $("#close-rules").addEventListener("click", () => $("#rules-dialog").close());
    $("#start-game").addEventListener("click", () => $("#rules-dialog").close());
    $("#share-button").addEventListener("click", shareGame);
    startNewGame(true);
  }

  init();
})();
