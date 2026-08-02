---
name: resume-material-kb
description: >-
  为程序员从 Git 提交记录（可按作者筛选）与需求/技术方案/实施文档，初始化或增量更新一份人可读的「简历素材知识库」。
  产出 STAR 工作卡片、SWOT、金字塔总览、项目全局亮点与可学习经验，并记录日期范围与终点游标（commitId 等）以支持定期 diff 更新。
  只要用户提到：简历素材、工作素材沉淀、从 commit 提炼简历、初始化/更新简历知识库、STAR 素材库、从仓库总结工作经历、增量更新求职素材——即使没说「知识库」也要使用本 skill。
  本 skill 独立于简历生成工具；知识库本身应可被人直接阅读与手工挑选，不强绑定任何简历排版 skill。
compatibility: 需要 git CLI；可选 Python 3 运行 scripts/collect_commits.py
---

# 简历素材知识库（Resume Material KB）

面向**程序员**：日常工作主要是写代码与文档，仓库有可追溯的 commit。目标是把「做过什么」沉淀成**可长期维护、人可直接阅读挑选**的求职素材库。

本 skill **不负责生成最终简历排版**。知识库是上游素材；用户可手工挑条目写入简历，也可日后自行用其他工具消费。

---

## 1) 判断场景

| 场景 | 触发信号 | 动作 |
|------|----------|------|
| **初始化** | 尚无知识库，或用户说「初始化 / 从零建立」 | 全量扫描 → 建库 |
| **定期更新** | 已有 `meta.json`，或用户说「更新 / 增量 / 同步最近 commit」 | 读终点游标 → 只处理新增 → 合并 |

若路径上已有合法 `meta.json` 且用户未明确要求重建，**默认走增量更新**（避免覆盖人工精修）。重建需用户明确确认。

---

## 2) 必收集输入

缺一不可时再追问，已提供的不要重复问。

| 输入 | 说明 |
|------|------|
| **知识库根目录** | 默认 `./idoc/resume-material-kb/`（用户可覆盖） |
| **仓库路径列表** | 支持**多个仓库写入同一知识库** |
| **commit 作者筛选** | name 与/或 email；多别名时全部列入 |
| **文档材料（可选但强烈建议）** | 需求、技术方案、开发/实施记录、设计稿说明等 |
| **时间范围（可选）** | 初始化时可限制 `--since` / `--until`；未指定则取作者相关全历史（过大时先抽样确认） |

仅有文档、没有仓库时：仍按标准目录初始化，`meta.json` 的 `repos` 可为 `[]`，并设 `"mode": "documents_only"`；工作卡片来源写文档路径。

---

## 3) 标准目录结构（必须遵守）

```
<kb-root>/
├── meta.json                 # 机器可读：多仓游标、作者、日期范围、更新日志索引
├── index.md                  # 人读总目录 + 金字塔总览入口
├── works/                    # 每项工作一张 STAR 卡片（.md）
├── analyses/
│   ├── swot.md               # SWOT（个人求职视角，可按周期滚动更新）
│   └── pyramid.md            # 金字塔原理：结论 → 论据 → 事实
├── project-highlights/       # 项目全局亮点 & 可复制学习经验（非仅本人提交）
└── changelog/                # 每次初始化/增量的变更摘要（按日期命名）
```

人读优先：`works/`、`index.md`、`analyses/`、`project-highlights/` 必须是通顺 Markdown。`meta.json` 只管状态与游标，不要把正文只放在 JSON 里。

模板见：
- `references/meta.schema.md`
- `references/work-card.template.md`
- `references/desensitization.md`
- `references/writing-guide.md`

---

## 4) 初始化流程

### Step A — 准备目录与 meta

1. 创建上述目录结构。
2. 写入初始 `meta.json`（见 schema）：`kb_version`、`created_at`、`authors`、`repos[]`（path、remote、endpoint 先空）、`date_range`。

### Step B — 采集本人提交

对每个仓库，优先使用捆绑脚本（确定性、可复现）：

```bash
python <SKILL_DIR>/scripts/collect_commits.py \
  --repo <REPO_PATH> \
  --author "<name>" \
  --author-email "<email>" \
  --all-refs \
  --out <kb-root>/_raw/<repo-slug>-commits.json
```

多仓写入同一知识库时：根目录建议放在工作区级 `idoc/resume-material-kb/`（勿挂在单一业务仓下）；`works/<repo-id>/` 分仓存放卡片，`meta.repos[]` 各记 endpoint；跨仓同一专题在 `index.md` 用专题链接聚合。全量历史请加 `--all-refs`，否则只扫当前分支会漏提交。作者筛选会传给 `git log --author`（避免 `-n` 先截断全员提交导致本人早期 commit 被挤出窗口）。
无 Python 时用等价 git 命令（`--author` 可多次；记录所用命令到 changelog）。

输出需包含：hash、author、date、subject、body、files changed 摘要。大仓库按主题/路径/时间聚类，避免「一 commit 一卡片」。

### Step C — 聚类成「工作项」

把 commit + 用户文档聚类为工作项（feature / 专项 / 重大修复 / 架构改造等）：

- 同一需求/同一技术方案下的多次提交 → **一项**
- 琐碎 chore/typo 可并入邻近项或标为「维护性贡献」附录，不单独占 STAR 主卡片
- **全面覆盖**：用户提供的文档与筛出的本人提交，都必须能在 `index.md` 或某张卡片的「来源」里追溯到；无法归类的列入 `works/_unclassified.md` 并提示用户确认

### Step D — 写 STAR 工作卡片

每张卡片遵循 `references/work-card.template.md`：

- **Situation / Task / Action / Result** 齐全
- 成就优先、尽量量化；缺数字时标注 `[待补充量化]`，不要编造
- 分点使用「**加粗概括：**详情」风格（与常见简历素材习惯一致，便于人直接复制）
- 遵守脱敏规则（`references/desensitization.md`）

### Step E — 项目全局视角（多仓同样适用）

除本人提交外，扫一眼仓库/文档的全局信号（架构、性能、协作方式、产品复杂度等），写入 `project-highlights/`：

- 项目亮点（客观）
- **可复制学习经验**（用户可写进简历的「我从项目中掌握/实践了…」）
- 明确区分：`本人主导` / `参与` / `旁观学习`（避免贪功）

### Step F — SWOT + 金字塔

- `analyses/swot.md`：围绕目标岗位（若未知则按「资深/中级程序员」通用版），基于已沉淀素材，勿空泛
- `analyses/pyramid.md`：先给 1 句总结论（你是什么样的工程师），再 3–5 个论据，每论据下挂事实卡片链接

### Step G — 落游标与 changelog

对每个 repo 写入：

- `endpoint.commit`：本次扫描范围内**最新**本人 commit 的完整 hash
- `endpoint.committed_at`、`endpoint.collected_at`
- `date_range.start` / `date_range.end`

写 `changelog/YYYY-MM-DD-init.md`：仓库列表、commit 数量、工作项数量、未归类项、脱敏说明。

更新 `index.md` 总目录。

---

## 5) 定期更新流程

1. 读 `<kb-root>/meta.json`，确认 `repos[].endpoint.commit`。
2. 对每个 repo 采集 **endpoint 之后** 的本人提交：

```bash
python <SKILL_DIR>/scripts/collect_commits.py \
  --repo <REPO_PATH> \
  --author "..." \
  --since-commit <endpoint.commit> \
  --out <kb-root>/_raw/<repo-slug>-incremental.json
```

3. 若无新提交：在 changelog 记「无增量」并结束（仍可因用户新丢文档而只更新文档侧）。
4. 有增量时：
   - 能并入已有工作项 → **更新该卡片**（追加 Action/Result，保留历史来源 commit）
   - 新主题 → **新建卡片**
   - 刷新受影响的 SWOT / 金字塔 / project-highlights（小步更新，不要无故重写全文）
5. 推进各 repo 的 `endpoint`，写 `changelog/YYYY-MM-DD-update.md`，刷新 `index.md`。

**禁止**在增量时静默删除用户手改过的段落；若 AI 生成区与手改冲突，用 changelog 提示「请人工合并」，并可用 HTML 注释 `<!-- ai:start --> ... <!-- ai:end -->` 包裹可覆盖区（可选约定，写入卡片即可）。

---

## 6) 脱敏与合规（强制）

详见 `references/desensitization.md`。摘要：

- 替换/省略：内部项目代号、未公开接口路径、真实客户名、内网域名、密钥与工号
- 接口表述：只保留**业务含义 + 关键字段**，或改为 `GET /api/v1/{resource}` 这类模拟路径
- 数字与公开技术栈可保留；不确定是否可公开时标记 `[敏感-待确认]` 而非直接写出

---

## 7) 写作质量（人读 + 可粘贴进简历）

详见 `references/writing-guide.md`。核心：

- 成就优先，而非职责罗列
- STAR 完整；Result 尽量有指标或可验证结果
- 重点突出：每项工作卡片顶部用 1–2 句「简历可用一句话」
- 全面覆盖优先于文笔华丽；宁肯多一张 `_unclassified`，不可偷偷丢掉用户材料

---

## 8) 输出验收 Checklist

完成后自检并在回复中简要报告：

- [ ] 目录结构完整，`meta.json` 含每个仓库的 endpoint
- [ ] `index.md` 可导航到全部工作项与分析
- [ ] 用户提供的文档与本人提交均有归属或进入未归类
- [ ] 每张主卡片含 STAR；SWOT、金字塔已生成/已更新
- [ ] `project-highlights` 含全局视角与学习经验，且贡献边界清晰
- [ ] 脱敏已执行
- [ ] changelog 记录本次日期范围与终点
- [ ] **未**强行调用或捆绑其他「简历排版/生成」skill

---

## 9) 对用户的交付话术

1. 知识库路径与如何打开 `index.md`
2. 本次新建/更新了哪些工作项（列表）
3. 未归类或待补充量化的项
4. 下次增量时只需说：「更新简历素材库」并确认仓库仍在 meta 中
