# Claude Code — Smart Codebase Navigation
### 唔讀晒全部 source，但又唔亂估嘅完整方法

> 整理日期：2026-03-31  
> 核心問題：改一個 function 要找所有影響，讀晒全部會爆 token，唔讀會 hallucinate。

---

## 根本問題

Claude Code 有兩個互相衝突的本能：

- **讀得少** → 猜測答案 → hallucination
- **讀得多** → 爆 token → session 降質甚至中斷

傳統做法（全部 source 讀入）唔可持續。解法係用更聰明嘅工具，而唔係讀更多文字。

---

## 核心原則：黏菌模式

黏菌（slime mold）在搜尋食物時的策略：
- 同時向四面八方伸出觸手
- 強化有回報的路徑
- 收回死路
- 最終找到最優路徑，唔浪費資源探索無關地方

對應到 Claude Code 就係：
1. **先用 index 定位 domain**（唔係全部讀）
2. **用工具（LSP/grep）精確找到 symbol**（唔係猜）
3. **系統性 BFS 向外擴展**（找所有相關點）
4. **到 domain 邊界就停**（唔係無限擴展）

---

## 第一層：CLAUDE.md 配置

### 重要發現

Anthropic 在 CLAUDE.md 外面加了這句話：
> *"this context may or may not be relevant to your tasks"*

即係 Claude **被設計成可以選擇性忽略** CLAUDE.md。所以：

- 每個 list item ≈ 1 條 instruction
- Claude 總 instruction budget ≈ 150–200 條（系統 prompt 自己用了 ~50 條）
- **XML tags 比 markdown heading 更穩定**——Claude training 裡 XML 是高優先度結構
- CLAUDE.md 超過 200 行 → 規則整體降質，唔係只係後面被忽略

### 正確寫法

**用 XML 包住關鍵規則：**
```xml
<investigate_before_answering>
Never speculate about code you have not opened.
Before making any claim:
1. Check AI_INDEX.md — navigation only, not source of truth
2. grep/glob to locate exact file and function
3. Read only the relevant section (line ranges, not whole files)
4. Name what you read: "Based on src/foo.py:bar()..."
5. If uncertain: say "uncertain" instead of guessing
Read each file once. No redundant reads.
</investigate_before_answering>
```

**High-ROI content for CLAUDE.md：**
- Common pitfalls（每行防止一個 10-15 min review cycle）
- 環境 quirks（必需 env vars、奇怪 bash commands）
- Domain boundaries（哪些 module 是獨立的）

**不要放入 CLAUDE.md：**
- File-by-file descriptions → 放 AI_INDEX.md
- Detailed API docs → 放 @link 指向的文件
- `NEVER do X` 的 hard rules → 放 `settings.json` deny rules

### Hard Rules 放 settings.json，唔係 CLAUDE.md

```json
{
  "permissions": {
    "deny": [
      "Bash(git push --force:*)",
      "Bash(rm -rf:*)"
    ]
  }
}
```

CLAUDE.md 是建議（advisory），settings.json deny 是強制執行（enforcement）。

---

## 第二層：AI_INDEX.md — 機場指示牌，唔係設計文件

### 核心原則

AI_INDEX.md 只做一件事：**告訴 Claude 去邊度找，唔係解釋係點運作**。

**好的 AI_INDEX = 機場指示牌**
```markdown
# AI_INDEX.md

## How to use this file
- Navigation only. Do not treat as source of truth.
- Before making claims, read the actual source files.
- Prefer grep/glob/symbol search before opening large files.

## Main domains

### Rule evaluation
- Purpose: evaluate rules and generate actions
- Entry: src/rule_evaluator.py
- Search: evaluate_rule, ActionExecutor
- Tests: tests/test_rule_evaluator.py
- Connects to:
  - Content Type Handling — via ActionExecutor.execute()
  - API layer — via POST /api/rules/evaluate (src/api/rules.py)

## Investigation rules
- Read only files needed for current task.
- If uncertain, say uncertain.
- Do not infer behavior from this index alone.
```

**壞的 AI_INDEX = 二手設計文件**
- 大段 execution flow 描述
- 跨 module 關係推論
- Edge case 結論
- 「通常」「應該」「大概」這類語言
- 任何 Claude 可以直接拿來答題而唔需讀 source 的 summary

### 保留 vs 重寫標準

**保留（符合全部條件）：**
- 少於 150–250 行
- 每個 module 只有 4–8 行
- 有 file path、symbol、test path、grep hint
- 明確寫「not source of truth」

**重寫成 pointer-only 格式（出現以下任一）：**
- 長篇 execution flow
- Words: "usually", "roughly", "generally", "should"
- 任何 Claude 可以不讀 source 直接回答的段落

---

## 第三層：LSP — Impact Analysis 的核心工具

### 為什麼 LSP 比 grep 好

| 維度 | grep | LSP findReferences |
|------|------|--------------------|
| 速度 | 慢 | 快 900x |
| Token 消耗 | 高（讀大量文件） | 低 20x（精確返回位置） |
| 精確度 | 字串匹配，有誤報 | 語義匹配，type-aware |
| 跨語言 | 任何語言 | 需裝 language server |

### 開啟方法

**settings.json 加入：**
```json
{
  "env": {
    "ENABLE_LSP_TOOL": "1"
  }
}
```

**安裝 language servers：**
```bash
# Python
pip install python-lsp-server

# TypeScript / JavaScript
npm install -g typescript-language-server typescript
```

### LSP 可用工具

| 工具 | 用途 |
|------|------|
| `findReferences` | 搵所有用緊呢個 symbol 的地方 |
| `goToDefinition` | 跳去定義位置 |
| `documentSymbol` | 列出整個 file 的 symbol 結構（唔需讀成個 file）|
| `getDiagnostics` | 改動前偵測編譯錯誤 |

---

## 第四層：trace-impact 工作流

### 核心概念

改一個 symbol，用 BFS 向外擴展找所有受影響的地方。每一層都是「一跳」：

```
Origin: 要改的 function/class/type

Level 1（直接）:
  → findReferences → 所有直接 caller
  → 讀每個 caller 的簽名（唔係全文）

Level 2（間接）:
  → 每個 Level 1 caller 再 findReferences
  → 找 indirect callers

Cross-domain:
  → 查 AI_INDEX "Connects to" section
  → 找相鄰 domain 的入口點
  → 檢查 interface contract 有冇變

停止條件:
  → 到達外部 API boundary（呢層唔係你改的）
  → 已去 3+ 跳（間接影響，記錄但唔深挖）
  → 找到穩定 interface（established API contract 冇變）
```

### 場景 A：加新 Feature

```
1. 搵入口：grep 或 AI_INDEX 找到相關 domain entry file
2. 用 documentSymbol 列出 module 結構
3. 用 findReferences 找所有現有 caller patterns
4. 問：新 feature 需要加在哪層？（API? Service? DB?）
5. 逐層向外確認：每一層的 interface 要唔要改？
6. 搵 tests：哪些 test files cover 這條路徑？
```

### 場景 B：Debug

```
1. 從 error message 出發（唔係從別人描述出發）
2. grep error string / exception class → 找到 throw 位置
3. 向上追：findReferences 找誰 call 了這個位置
4. 向下追：讀函數 body，找 downstream calls
5. 追 data write path：grep `.field = ` / `update()` / `save()`
6. 確認 root cause 之前唔好解釋給用戶聽
```

---

## 第五層：Subagent 保護主 Context

**官方確認：subagent 有獨立 context window**，做探索性工作時用 subagent，唔污染主 session。

### 適合用 subagent 的情況
- 需要探索 5 個以上文件
- 唔確定要讀哪些文件（先探索再決定）
- 大型 codebase 的 impact analysis

### Subagent prompt 格式
```
Use a subagent to investigate [module/feature].
Treat AI_INDEX.md as navigation only.
Read minimum files needed.
Return exact files/functions read.
Do not implement yet.
```

---

## Aider Repo Map — 評估結果

**結論：值得用於生成 AI_INDEX 的 symbol 骨架，但唔適合直接當 AI_INDEX。**

**工作原理（讀過 source code）：**
1. tree-sitter 解析每個 file，抽出所有 function signatures（唔係實現）
2. 建 dependency graph（file A import file B → edge）
3. **PageRank 算法**排出最重要的 file（被最多人 depend on 的）
4. 輸出排名高的 file 的 signatures，大概 1000 tokens

**優點：**
- 唔需要 LLM call 就能生成 map（只需要 token counting）
- PageRank 比 naive 方法更聰明
- Python + TypeScript 支援完整

**缺點：**
- Identifier uniqueness 假設在大型 codebase 會失效（GitHub issue #2341）
- 輸出格式係 signatures，唔係 routing manifest（仍然是「解釋 code」唔係「指向 code」）
- 需要安裝 aider-chat

**最佳用法：** 用 aider repo map 做初始 symbol inventory，然後人手整理成 routing manifest 格式的 AI_INDEX。

```bash
pip install aider-chat
aider --map-tokens 2000 --show-repo-map  # 生成骨架
# 然後人手篩選，轉換成 routing manifest 格式
```

---

## 完整 Config Checklist

| 項目 | 做法 | 狀態 |
|------|------|------|
| CLAUDE.md < 200 行 | 精簡，用 XML tags 包關鍵規則 | |
| AI_INDEX = routing manifest | pointer only，有 "Connects to" | |
| LSP 開啟 | settings.json + language servers | |
| .claudeignore | 排走 node_modules/.venv/datasets | |
| settings.json deny rules | hard blocks 放這裡，唔放 CLAUDE.md | |
| Subagent for exploration | 5+ files → delegate | |
| "uncertain" instead of guess | XML rule in CLAUDE.md | |

---

## 參考來源

- [Aider Repo Map — aider.chat](https://aider.chat/2023/10/22/repomap.html)
- [LSP Integration with Claude Code — spec-weave.com](https://spec-weave.com/docs/guides/lsp-integration/)
- [Writing a Good CLAUDE.md — HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [CLAUDE.md Guide — potapov.dev](https://potapov.dev/blog/claude-md-guide)
- [Codebase-Memory Knowledge Graph — arXiv 2603.27277](https://arxiv.org/html/2603.27277v1)
- [Repository Intelligence Graph — arXiv 2601.10112](https://arxiv.org/abs/2601.10112)
- [Navigating Large Codebases — claudelab.net](https://claudelab.net/en/articles/claude-code/claude-code-large-codebase-navigation-guide)
- Anthropic 官方文件：memory, settings, hooks, skills, best-practices
