# 白纸考试 · BWBM

一个打开即玩的小游戏：玩家可以进行至多 10 次模拟查询，只观察总分，然后提交最终答案。

## 在线游玩

GitHub Pages 部署成功后访问：

**https://menghuainanfang.github.io/BWBM/**

本地也可以直接双击 `index.html`，没有外部资源或构建步骤。

## 游戏规则

- 15 个位置，字母表为 A–E。
- 隐藏答案中每个字母恰好出现 3 次。
- 3 个未知高价值位置命中得 30 分，其余位置命中得 10 分。
- 模拟查询允许留空；最终答案必须完整，但玩家的答卷不受组成约束。
- 最多模拟 10 次，之后提交一份最终答案，满分 210。

隐藏状态由答案向量和高价值位置集合共同组成，共有：

```text
168,168,000 × 455 = 76,516,440,000
```

## 项目结构

- `index.html`：单页游戏界面。
- `app.js`：游戏交互与展示逻辑。
- `core.js`：模型配置、计分、采样和候选过滤；所有实验共用同一规则实现。
- `scripts/benchmark.js`：1–4 轮开局策略的可复现实验。
- `tests/core.test.js`：核心规则测试。
- `.github/workflows/pages.yml`：GitHub Pages 自动部署。

## 测试与实验

需要 Node.js 18 或更高版本。

```powershell
npm test
npm run benchmark
```

指定随机种子和样本数：

```powershell
node scripts/benchmark.js 20260921 30000
```

实验结果会写入 `results/` 下的 JSON 和 CSV 文件。页面中的候选数量与信息量来自 Monte Carlo 样本，不是完整状态空间的精确枚举。

## 名称说明

Balanced Weighted Black-Peg Mastermind（BWBM）是本项目的工作名称，不声称它是文献中的既有术语。
