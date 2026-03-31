# Claude Code 最佳實踐

[English](README.md)

你問 Claude 一個函式是怎樣運作的。它給你一個詳盡、自信的解釋。

你根據它說的繼續做了一個小時。然後你發現它說的是錯的。

---

又或者這個：你改了一個函式，Claude 幫你完成了，測試通過，你 ship 了。三天後 code review，有人說「這裡有四個地方都在呼叫這個函式，全部壞掉了。」Claude 從來沒有提醒你。你也從來沒有想到要問。

這不是偶發的。每次用 Claude Code 做真實專案都會遇到。根源只有一個：**Claude 沒有辦法在你的程式碼庫裡導航。** 讀得太少就猜測；讀得太多又把 token 全燒在找路上，根本沒辦法做正事。

以下就是解決方法。

---

## 核心概念

**將整個 repo 變成一個 graph，用 BFS + LSP 做搜尋和遍歷。**

就是這樣。AI coding assistant 的瓶頸不是智慧——是導航。Claude 拿到正確的資訊後推理得很好。問題是它把大部分能力浪費在「找資訊」這件事上。

```
/generate-index          → 建立 graph（deterministic script + Claude 精修）
        ↓
    AI_INDEX.md          → graph 本身（adjacency list——nodes 是 domains，edges 是連接）
        ↓
/investigate-module      → 讀 graph 上的某個 node（有根據，有來源）
/trace-impact            → 沿著 edges 做 BFS（找出所有受影響的位置）
```

在這張 graph 的任何一個 node 丟入一個 bug 或 feature 需求，系統就沿著所有 edges 追蹤出受影響的位置——在你寫下第一行改動之前。

---

## AI_INDEX.md — 不是檔案列表，是 graph

市面上有幾十個 AI_INDEX template。大部分長這樣：

```
auth → src/auth/
api  → src/api/
db   → src/models/
```

這是一個 flat file list。Claude 知道去哪裡找東西，但它完全不知道改了 `auth` 會影響 `api`。沒有任何結構把它們連起來。這是一本電話簿，不是一張地圖。

我們的 AI_INDEX 是一個 **graph data structure**——具體來說是 adjacency list（鄰接表）：

```markdown
### Auth
- Entry: src/auth/middleware.py
- Search: verifyToken, AuthError
- Tests: tests/test_auth.py
- 連接至：
  - API layer — via requireAuth() in src/api/routes.py
  - DB layer — via UserModel.findById() in src/models/user.py

### API layer
- Entry: src/api/routes.py
- Search: router, handleRequest
- Tests: tests/test_routes.py
- 連接至：
  - Auth — via requireAuth middleware
  - Rule evaluation — via POST /api/evaluate
```

每個 domain 是一個 **node**。每個 `連接至` 是一條 **edge**。這就是 `/trace-impact` 能運作的原因——它是在這個 graph 上面做 BFS 遍歷。沒有 edges，你只有一個目錄列表；有了 edges，你有一個演算法可以走的網絡。

Edges 來自真正的 imports，不是猜的。`/generate-index` 掃描你的 actual import statements 來建立 graph。

一個原則：控制在 250 行以內，只寫指標。一旦開始解釋「程式碼怎麼運作」而不是「東西在哪裡」，Claude 就會從 index 推論，不讀原始碼。

**保持新鮮度：** 過時的 graph 比沒有 graph 更危險——Claude 會信任它然後走上死路。結構有變就重跑 `/generate-index`。

參考：[`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md)

---

## LSP — graph 的搜尋引擎

BFS 在每個 node 需要精確的 lookup。grep 做不到——它是字串比對，`authenticate` 會 match 到注解、變數名、不相關的檔案。40 個結果，15 個雜訊，token 預算燒掉一半。

LSP 直接問語言的型別檢查器。語義比對，不是字串。一樣的查詢，6 個精確結果。

| | grep | LSP findReferences |
|---|---|---|
| 速度 | 基準 | 快 900 倍 |
| Token 消耗 | 高 | 低 20 倍 |
| 準確度 | 字串比對，有誤報 | 語義比對，零誤報 |

在 `.claude/settings.json` 啟用：
```json
{ "env": { "ENABLE_LSP_TOOL": "1" } }
```

**VS Code**：language server 已經在跑——開 flag 就好。**Terminal**：要先裝 language server：

```bash
pip install python-lsp-server                         # Python
npm install -g typescript-language-server typescript  # TypeScript
go install golang.org/x/tools/gopls@latest            # Go
```

---

## 三個技能

**`/generate-index`** — 自動建立 graph

掃描你的 imports、目錄結構、exported symbols，輸出完整的 AI_INDEX.md，所有 `連接至` edges 從 actual import statements 填入。Deterministic——80% 零 token 完成。Claude 精修最後 20%（HTTP endpoints、前後端連接等 script 看不到的）。

新 repo 跑一次。結構變了再跑。

---

**`/investigate-module`** — verification-first prompting

核心機制：**強制 Claude 在做出任何判斷之前，先說明它讀了哪個檔案的哪個函式。** 這消除了「自信地瞎猜」的中間地帶——Claude 要嘛讀了 source（準確），要嘛說「不確定」（你知道要深入查）。

讀 AI_INDEX 找到對應的 node → grep/LSP 定位確切的符號 → 只讀相關段落 → 回報讀了什麼讓你驗證。

---

**`/trace-impact`** — 在 graph 上做 BFS 遍歷

Graph 的價值在這裡體現。不再靠記憶想有哪些 caller，`/trace-impact` 在 AI_INDEX 的 adjacency list 上做系統性的廣度優先搜尋：

- **Level 0**：你要改動的 node
- **Level 1**：直接呼叫者（LSP findReferences——語義精確，不是 grep）
- **Level 2**：呼叫那些呼叫者的地方
- **跨域**：沿著 `連接至` edges 跨越 module 邊界
- **測試**：涵蓋到上述任何位置的測試

廣度優先——先看清楚所有直接影響，再往下追。到達 API 邊界停止。不會漏。

---

### 三者如何協作

```
新 repo：
  /generate-index → 建立地圖，所有連接都在裡面

修 bug：
  1. /trace-impact rule_evaluator.py:evaluate_rule
     → 動手前先知道完整的影響範圍
  2. /investigate-module 查詢需要理解的部分
     → 有根據的事實，有來源，不是猜測
  3. 進行修改
     → 你已經知道其他什麼地方需要一起更新

加 feature：
  1. /trace-impact 對每個接觸點 → 先畫出影響範圍
  2. /investigate-module 調查你不熟悉的域
  3. 實作 feature
  4. /generate-index 如果加了新 module 或新的跨域連接
```

---

## CLAUDE.md — 用 XML 標籤，不是 markdown

CLAUDE.md 裡的規則在 context 壓力下會被降優先——Anthropic 會包一層 *「這段 context 可能與當前任務相關，也可能無關」*。XML 標籤的穩定性高得多：

```xml
<investigate_before_answering>
不要對你還沒有開啟過的程式碼做出推測。
先讀 AI_INDEX.md——僅作導航用途，不是事實來源。
在讀取任何檔案前，先用 grep/LSP 定位確切的位置。
只讀相關段落，使用行數範圍，不是整個檔案。
說明你讀了什麼：「根據 src/foo.py:bar()...」
不確定時：說「不確定」，不要猜測。
每個檔案只讀一次，不重複讀取。
</investigate_before_answering>
```

**指令配額：** ~150–200 個空間。系統 prompt 佔 ~50。CLAUDE.md 每個 bullet 佔一個。超額 = 所有規則同時降質。控制在 200 行以內。

**硬性規則 → `settings.json` deny**，不是 CLAUDE.md。CLAUDE.md 可以被忽略，deny rules 不行：

```json
{
  "permissions": {
    "deny": [
      "Bash(git push --force*)",
      "Bash(rm -rf*)"
    ]
  }
}
```

---

## 自主性——可逆性，不是動作類型

**不需要問：** 編輯檔案、跑測試、grep、git add、feature branch 上 git commit——全部可逆。
**必須問：** 推送到遠端、發布、刪除檔案、強制操作——不可逆或對外可見。

Push 是那條線。

---

## Context 管理

- **`/clear` 在不相關的任務之間** — context 殘留會污染下一個任務
- **`/compact focus on X`** — 帶方向的壓縮，不是盲目壓
- **把進度寫到 `PLAN.md`** — 能在 `/clear` 後繼續；對話記錄不行
- **一個 session 專注一個主要任務** — 每次重新開始都是最佳狀態

詳細說明：[`docs/context-management.md`](docs/context-management.md)

---

## 快速上手

將以下 prompt 複製到你的 Claude Code 中：

```
請讀取 https://github.com/ithiria894/claude-code-best-practices 中的這些檔案：
- README.md
- .claude/skills/investigate-module/SKILL.md
- .claude/skills/trace-impact/SKILL.md
- templates/AI_INDEX_TEMPLATE.md
- CLAUDE.md

讀完後，用繁體中文向我解釋每個部分——從它解決的問題開始說起：
沒有它時會發生什麼讓人頭痛的事、為什麼會這樣，以及這個方案如何解決它。
語言要口語化、具體，讓我能說「這個問題我也有」再聽解法。

請解釋以下五項：
1. /investigate-module — Claude 在沒有讀程式碼的情況下回答問題會出什麼問題
2. /trace-impact — 改了一個地方卻不知道什麼東西會跟著壞掉的問題
3. AI_INDEX.md — 為什麼 Claude 在不熟悉的程式碼庫上會迷失方向或變慢
4. CLAUDE.md 的 <investigate_before_answering> 規則 — 為什麼告訴 Claude「小心一點」沒用
5. LSP — 為什麼用 grep 找程式碼會浪費 token 還容易出錯

解釋完五項後，詢問我要安裝哪些。
在我確認前，不要安裝任何東西。
```

---

## 範本與設定檔

| 檔案 | 說明 |
|---|---|
| [`scripts/generate-ai-index.mjs`](scripts/generate-ai-index.mjs) | Deterministic AI_INDEX 生成器——掃描 imports，輸出 routing manifest |
| [`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md) | 完整的 AI_INDEX 格式，含 Connects to |
| [`templates/MEMORY_INDEX_TEMPLATE.md`](templates/MEMORY_INDEX_TEMPLATE.md) | Memory 檔案結構與 frontmatter |
| [`CLAUDE.md`](CLAUDE.md) | 含 XML 驗證規則的 CLAUDE.md 範本 |
| [`.claude/settings.json`](.claude/settings.json) | LSP + deny rules + hook 架構 |

---

## 延伸閱讀

- [`docs/context-management.md`](docs/context-management.md) — 何時 `/clear`、何時 `/compact`、如何把狀態寫到檔案
- [`docs/verification-prompting.md`](docs/verification-prompting.md) — 強制 Claude 驗證後再回答的具體措辭
- [`docs/best-practices.md`](docs/best-practices.md) — 完整說明與所有研究來源

---

## 貢獻

這是一份持續更新的文件，每項最佳實踐都來自實際驗證。

貢獻規則：
- 每個技巧都必須有來源或第一原理說明
- 不接受「加上這個就好」而沒有解釋為什麼有效
- 失敗案例和成功案例一樣有價值
