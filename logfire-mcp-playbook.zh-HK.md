# Logfire MCP Auth / Recovery Playbook

呢份係喺呢部機修 Logfire MCP `Auth required` / `Needs authentication` 嘅完整流程。重點唔係「browser 入到 Logfire 就得」，而係 **本機 MCP token store 要成功食到 OAuth callback**。

## Scope

- 修 `mcp__logfire__` / `claude mcp` 顯示 `Auth required` / `! Needs authentication`
- 修 browser 已登入 Logfire，但 MCP tool 仍然未通
- 修 approve 咗 OAuth，但最後去 `localhost:<port>/callback` 時 `ERR_CONNECTION_REFUSED`

唔包：

- Logfire product 本身 account / project 權限設定
- 一般 query / trace investigation SQL 寫法

## Mental Model

要分清楚三層：

1. **Browser session**
   - 你可唔可以入到 `https://logfire-us.pydantic.dev/...`
   - 呢層通，只代表 Chrome 已登入

2. **MCP server status**
   - `claude mcp list`
   - `claude mcp get logfire`
   - 呢兩個只係睇狀態，唔會自己完成 auth

3. **Local MCP token store**
   - 真正俾 `mcp__logfire__.*` tool 用
   - 要靠 OAuth callback 寫返本機

最易中伏位：

- **只用 browser login**：唔夠
- **只睇 `claude mcp get logfire`**：唔夠
- **approve 太遲 / approve 時 auth process 已經 exit**：callback 會打去 dead `localhost` port，最後 `ERR_CONNECTION_REFUSED`

## Quick Symptoms -> Meaning

- `mcp__logfire__... -> Auth required`
  - MCP token store 未通

- `claude mcp get logfire -> ! Needs authentication`
  - server config 仲在，但 auth 未完成

- browser 已經可以開 `Live · alltrue/playground · Pydantic Logfire`
  - 只代表 browser session 通，**唔代表 MCP 通**

- OAuth approve 後去 `localhost:<port>/callback?...` 見 `ERR_CONNECTION_REFUSED`
  - approve 嗰刻 **已經冇 listener**
  - 即係 auth flow 起咗，但等 callback 嗰個 process 已經死咗 / exit 咗

## Baseline Checks

先用呢幾個 command 睇現況：

```bash
claude mcp list
claude mcp get logfire
```

如果 `logfire` server 唔存在，先補返：

```bash
claude mcp add --scope user --transport http logfire https://logfire-us.pydantic.dev/mcp
```

呢條 command 係 safe / idempotent，用嚟確認 config 存在。

## Correct Recovery Flow

### 1. 用真 tool path 觸發 auth，唔好只用 status check

`claude mcp list/get` 唔夠，要用一次真 Logfire MCP invocation。

可行方法：

- 喺 Codex/Claude 直接 call 一個 `mcp__logfire__` tool
- 或開一個互動 `claude` session，叫佢 authenticate Logfire MCP，並且 **keep auth flow alive until callback**

重點：

- **一定要用一個會 keep 住 process 嘅 flow**
- 唔好用會即刻 exit 嘅 one-shot path 然後先去 browser approve

### 2. 從 log / prompt 攞 auth URL

auth flow 起咗之後，通常會見到完整 authorization URL。  
如果要睇 log：

```bash
ls -1t ~/Library/Caches/claude-cli-nodejs/-Users-wleung-company/mcp-logs-logfire | head
tail -n 120 ~/Library/Caches/claude-cli-nodejs/-Users-wleung-company/mcp-logs-logfire/<latest>.jsonl
```

重要 log pattern：

- `Using redirect port: <port>`
- `Authorization URL: https://logfire-us.pydantic.dev/api/oauth/authorize?...`
- `Initial auth result: REDIRECT`

如果見到：

- `Skipping connection (cached needs-auth)`

代表之前個 needs-auth cache 令新 call 短路。先清：

```bash
python3 - <<'PY'
import json, os
p=os.path.expanduser('~/.claude/mcp-needs-auth-cache.json')
with open(p) as f:
    data=json.load(f)
data.pop('logfire', None)
with open(p,'w') as f:
    json.dump(data,f,separators=(',',':'))
print(open(p).read())
PY
```

之後再重觸發一次真 auth flow。

### 3. 用公司 Chrome profile 完成 OAuth

一定用公司 Chrome profile：

- `Google Chrome`
- `Default`
- `nicole@alltrue.ai`

OAuth consent page 要留意：

- account：`nicole@alltrue.ai`
- organization：按當時需要選；今次實測應該揀 **Alltrue / `alltrue`**
- project：通常 `All projects`

如果只是 company work，一般唔用 personal profile。

### 4. 最重要：Approve 時 listener 要仲喺度

呢步係最關鍵。

如果你喺 browser approve 嗰刻，等 callback 個 auth process 已經 exit：

- browser 會跳去 `http://localhost:<port>/callback?...`
- 然後報 `ERR_CONNECTION_REFUSED`
- 咁 browser 雖然 approve 咗，但 MCP token store 仍然未更新

所以正確姿勢係：

- 先起 auth flow
- 確認嗰個 `claude` / tool auth process 仲 alive
- 然後即刻去 browser approve

## Practical Recovery When `localhost` Refused

如果你已經見到：

- `localhost:<port>/callback?code=...&state=...`
- 但頁面係 `ERR_CONNECTION_REFUSED`

即代表：

- code / state 已經有咗
- 但當時冇 listener 接 callback

最穩陣修法：

1. 唔好再假設 browser login 已完成 MCP auth
2. 重新起一個 **keep-alive** auth flow
3. 再攞新 auth URL
4. 再 approve 一次
5. 令 callback 真正打返去 live listener

如果當前 tool surface 有 dedicated manual callback completion tool，先考慮直接餵返完整 callback URL。  
如果冇，就唔好死磨舊 callback，直接重跑完整 flow。

## Verification

成功標準唔係 browser 入到 Logfire，而係下面真 tool 通：

```bash
claude mcp get logfire
```

狀態唔應該再係 `! Needs authentication`。

再用真 MCP tool 驗：

- `mcp__logfire__.project_list`
- `mcp__logfire__.query_schema_reference`

其中一個成功就算 auth 真正通。

## Recommended End-to-End Sequence

```bash
claude mcp get logfire
claude mcp add --scope user --transport http logfire https://logfire-us.pydantic.dev/mcp
python3 - <<'PY'
import json, os
p=os.path.expanduser('~/.claude/mcp-needs-auth-cache.json')
with open(p) as f:
    data=json.load(f)
data.pop('logfire', None)
with open(p,'w') as f:
    json.dump(data,f,separators=(',',':'))
PY
```

之後：

1. 開互動 `claude`
2. 叫佢 authenticate Logfire MCP，並 keep auth flow alive
3. 從 prompt / log 攞完整 auth URL
4. 用公司 Chrome profile 開 URL
5. account 用 `nicole@alltrue.ai`
6. org 選 **Alltrue / `alltrue`**
7. 按 `Approve`
8. callback 成功後，再試 `claude mcp get logfire`
9. 最後 call `mcp__logfire__.project_list` 或 `query_schema_reference`

## Evidence To Capture

最少留低以下 evidence：

- `claude mcp get logfire` before / after
- latest `mcp-logs-logfire/*.jsonl` 內：
  - `Using redirect port`
  - `Authorization URL`
  - callback 成功後相關 success 訊息
- browser page：
  - consent page account / org 選項
  - 或 callback 成功頁
- 第一個成功嘅 `mcp__logfire__` tool call

## Common Failure Patterns

### Pattern 1: Browser already logged in, but MCP still `Auth required`

原因：

- browser session 同 MCP token store 係兩回事

處理：

- 重新走 MCP OAuth flow

### Pattern 2: `cached needs-auth`

原因：

- `~/.claude/mcp-needs-auth-cache.json` 將 `logfire` 短路

處理：

- delete `logfire` entry，再重試

### Pattern 3: Approve 後 `localhost refused to connect`

原因：

- auth listener 死咗

處理：

- 重跑 keep-alive auth flow，再 approve

## What To Remember Next Time

- 先確認係 **browser login 問題** 定 **MCP token store 問題**
- `claude mcp list/get` 只係 status
- 要用 **真 Logfire MCP invocation** 觸發 OAuth
- approve 前，要確認 auth process 仲 alive
- company work 一律用公司 Chrome profile
- 今次 org 要揀 **Alltrue / `alltrue`**
