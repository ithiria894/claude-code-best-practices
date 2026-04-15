# AI Index

> 給 coding agent 用的 floor plan 加 wiring map。

[English](README.md)

## 先講白一點

很多人以為 AI 在大 repo 出錯，是因為它不夠聰明。

我自己而家比較相信，通常唔係。

更多時候其實係，你逼咗佢喺兩個爛選擇入面揀一個。

## 最煩嘅兩難

基本上每個用 Claude Code 嘅人，最後都會撞到同一個問題：

### 選項 A：畀 Claude 乜都睇晒

佢成個 repo 去 grep，開二十幾個 files，讀幾千行 code，盡量想做得 thorough。

聽落好似穩陣，但真實情況通常係：

- token 燒得好快
- context 愈睇愈嘈
- 到後面佢連自己五分鐘前睇過乜都開始唔太記得

### 選項 B：畀 Claude 自己估邊啲 relevant

咁佢係快啲。

通常開三四個 files，就會好有自信咁答你，甚至已經開始寫 code。

但最危險嘅 bug，通常就係咁嚟：

- 佢改中咗一條 obvious path
- 但另一條佢根本唔知存在嘅 path 完全冇睇
- 你以為搞掂，之後先發現原來成件事只改咗一半

講白啲，兩邊都唔好。

- 睇太多：貴、慢、亂
- 睇太少：會漏

所以第三條路其實係：

**畀 Claude 一張地圖。**

你可以當個 codebase 好似東京地鐵。

冇地圖都唔係去唔到。

但你會不停亂轉線，唔知邊度先係正確 transfer，成程都係靠估。

有地圖就唔同。

你望一眼，大概知道點行，之後先開始郁。

張地圖唔會限制你去邊。

佢只係幫你唔好一開波就上錯車。

`AI Index` 做的，就是這件事。

它不是建築物介紹手冊。
它不是導覽地圖。
它是維修地圖。
你可以當佢係你上車前會先望一眼嗰張東京地鐵圖。

## 這個 repo 到底想解決什麼

AI 其實已經很會讀 code 了。

它真正常卡住的，不是「看不懂語法」，而是：

- 該從哪裡開始
- 哪些檔案其實屬於同一個 change surface
- 哪些 repo 規則根本不會寫在 import 上
- 改完這裡之後，還有哪幾塊東西其實也要一起動

所以很多 AI 產生的修改，最麻煩的不是完全錯。

而是那種：

「這一小塊看起來是對的，但整體其實還沒改完。」

這就是 AI Index 想處理的核心問題。

## AI Index 到底是什麼

你可以把 AI Index 當成一張專門給 AI 用的 repo 地圖。

它的工作很單純：

- 告訴 agent 先開哪個 domain
- 告訴 agent 這個 domain 裡哪些 surface 是一起變動的
- 記下那些不容易從 code 直接看出來的「這裡改了，另外那邊也要看」規則
- 把 agent 直接帶回真正的 source code，而不是繞在大段 prose 裡

code 仍然係唯一嘅 source of truth。

AI Index 不是要取代 code。

它只是先幫 agent 少走冤枉路，減少那種「只改到一半」的情況。

## 點解我哋咁在意 single source of truth

呢個其實係我哋成套設計好核心嘅一個位。

好多 AI 出事，唔係因為佢睇唔明 code。

反而係因為佢先睇咗人類寫嘅 documentation，當咗嗰啲 prose 係真，之後就冇再返去核對 actual code。

如果份 doc stale 咗，或者 function 明明改過但啲字冇改，AI 就會直接食咗個舊 mental model，跟住一路錯落去。

所以 AI Index 故意唔做一件事：

佢唔會逐個 function 用人話幫你重寫一次。

如果 agent 真係想知個 function 做乜，最穩陣嘅做法就係直接開個 function 睇。

AI Index 只做導航：

- 告訴你去邊度睇
- 提醒你仲有邊啲位要一齊睇
- 但唔代替 code 本身講真相

講到最白就係：

- 地圖只係話你應該去邊
- 真正話畀你知「發生緊乜」嘅，永遠係 code

所以 AI Index 由設計開始就係 `navigation-only`。

咁做好處係兩個：

- graph 可以輕好多，唔使變成另一套會 stale 嘅 documentation
- AI 唔會咁容易畀舊 prose 錨死喺錯誤理解上面

## 呢個先係成件事嘅重點

其實成套設計濃縮返，就係下面幾句：

- AI Index 永遠保持 `navigation-first`
- code 永遠係唯一嘅 source of truth
- 只手寫 AI 無法穩定由 code 推到嘅少量規則
- 改完有意義嘅 code 之後，要同步更新 graph
- `pattern audit` / `full sweep` 仍然要留返做補充手段

一句講晒：

AI Index 唔係另一套 documentation system。

佢係一個畀 AI 用嘅 repo traversal system。

## 最容易懂的比較方式

你可以把這件事想成三種工具。

### 1. 直接 search code

直接 search 很像你拿著手電筒在大樓裡自己找路。

不是不行。

你最後當然有機會找到正確那間房。

但中間很可能會：

- 先開錯五扇門
- 以為已經找到答案
- 最後漏掉地下室那個真正關鍵的控制室

直接 search 很強的地方：

- 找 local truth
- 找 symbol
- 看實際 implementation

它比較弱的地方：

- 哪些 layer 本來就會一起動
- blast radius 到底有多大
- repo 裡那些不寫在 import 上的 coupling

### 2. 傳統 docs / knowledge graph

傳統 docs 比較像導覽手冊或 onboarding 文件。

它擅長講：

- 這棟樓是做什麼的
- 每一層大概怎麼分工
- 一個人如果要先理解全貌，應該先看什麼

這對下面這些情境很有用：

- onboarding
- 跟人解釋架構
- 建 mental model

但如果你的目標是：

「我要改這段 code，而且不要漏掉相關的東西」

那它通常不是最直接的工具。

你可以當成：

- 傳統 docs 比較似旅遊手冊
- AI Index 比較似你而家要搭邊條線嘅捷運圖

### 3. AI Index

AI Index 比較像維修人員真的會拿在手上的那張圖。

它會直接告訴 agent：

- 先從哪一區開始
- 哪些 routes、services、models、jobs、configs、tests 是一整串的
- 你碰這裡時，另外哪些地方最好一起看
- 真正重要的檔案在哪裡

所以它特別適合：

- bug fix
- feature implementation
- impact analysis
- review
- 避免「改了一個檔案，漏了另外五個」

## Tree 跟 Graph 的差別，真的差很多

這個是整件事最根本的差別。

### 傳統 documentation tree

通常長這樣：

```text
index
  -> feature doc
    -> deeper doc
      -> code pointers
```

這其實是一條「閱讀路線」。

它主要回答的是：

- 「這個 feature 是什麼？」
- 「人類下一步應該看哪份文件？」

### AI Index graph

AI Index 比較像這樣：

```text
AI_INDEX.md
  -> domain file
    -> change surfaces
    -> must_check rules
    -> critical nodes
    -> direct code paths
```

這是一條「動手路線」。

它回答的是：

- 「我應該從哪裡開始？」
- 「我改這裡，還有什麼會一起受影響？」
- 「我在說這個改動做完之前，還應該再檢查什麼？」

如果要再講得更貼地一點：

- 舊 knowledge graph 比較像旅遊手冊
- AI Index 比較像捷運圖加維修面板

旅遊手冊會告訴你這個城市有什麼。

捷運圖會告訴你你現在該搭哪條線，在哪裡轉車，漏了哪一站就會走錯。

## AI Index 裡面通常放什麼

預設 layout 會長這樣：

```text
AI_INDEX.md
AI_INDEX/
  domain-a.md
  domain-b.md
  domain-c.md
```

`AI_INDEX.md` 你可以把它當成 front desk：

- 先讀什麼
- repo-wide rules 是什麼
- 有哪些 domains

每個 domain file 則比較像那一區自己的維修卡：

- 這區在管什麼
- 這區有哪些重要 change surfaces
- 改的時候另外要檢查什麼
- 哪些 nodes 值得跟

重點是，它故意不做成一整套厚厚的 documentation。

它只留下那些 code search 不會第一時間告訴你的東西。

## Workflow 很簡單，就四步

### 1. Use

如果 repo 已經有 AI Index：

- 先讀 `AI_INDEX.md`
- 只開跟任務有關的 domains
- 先看 change surfaces
- 先看 `must_check`
- 然後才下去讀真正的 code

### 2. Generate

如果 repo 還沒有 AI Index：

- 先 inspect repo
- 找出真正的 domains
- 畫出主要 change surfaces
- 只留下高價值 nodes
- 不要寫一堆給人看的說明文

目標不是「把整個 repo 文件化」。

目標是：

「讓之後的改動更不容易漏東漏西。」

### 3. Sync

做完有意義的 code 改動之後：

- 看 changed files
- 對回受影響的 domains
- 更新那些 domain files
- 只有在 repo-wide 行為變動時才改 root rules

### 4. Validate

最後再檢查一下：

- 路徑還在不在
- links 還能不能 resolve
- domain boundary 現在還合不合理

## 為什麼現在傾向讓 AI 來建，而不是 script 來生

script 很會做一件事：

把 syntax 抓出來。

但它不太會做另一件更重要的事：

下判斷。

例如：

- 一個 domain 真正的邊界在哪裡
- 哪些 coupling 在實戰上最容易出事
- 哪些規則 import 根本看不出來
- 哪些 nodes 值得留下來

所以這個 repo 才慢慢從「先寫個 generator script」轉去「讓 AI 來 build 第一版 graph」。

因為 AI Index 最貴的地方，其實不是 parsing。

而是判斷什麼資訊真的值得留下來。

## Benchmark 在說什麼

公開文章在這裡：

https://dev.to/ithiria894/the-bottleneck-for-ai-coding-assistants-isnt-intelligence-its-navigation-2p30

這些 benchmark 不是在證明：

「graph 在每個超小任務上都一定最省。」

它真正想測的是：

`有地圖之後，agent 會不會比較少亂走，而且比較容易找到完整 change surface？`

### 幾個重點數字

- 跟 no-map baseline 比，median token savings 大約 `21%`
- 跟 no-map baseline 比，average tool-call reduction 大約 `34%`
- 當 task 會跨 routes、services、schemas、configs、jobs、tests，甚至跨 repo 時，graph 的優勢最明顯

### 幾個代表性結果

| 情境 | Graph | No map / 其他流程 | 差別在哪 |
|---|---:|---:|---|
| 小 repo bug fix | `14K` tokens / `10` tool calls | `14K` / `12` | token 差不多，但 graph 少走了幾步，而且比較容易看到 cascade impact |
| 小 repo 新功能規劃 | `11K` / `10` | `14K` / `14` | graph 少繞路，impact sweep 比較乾淨 |
| 大 repo 缺 feature flag | `48K` / `14` | `72K` / `26` | graph 更快把 agent 帶到對的區域 |
| 大 repo cross-repo investigation | `55K` / `18` | `82K` / `33` | graph 找到的不是只有 endpoint，還找到 wiring gap |

### 這些數字真正代表什麼

AI Index 不是魔法。

如果 task 非常小、非常 local，而且一眼就知道要改哪個 file，那直接看 code 可能還是更便宜。

但只要 task 變成下面這種：

- 「我要改這裡，但不要漏任何 related edits」
- 「我要追 blast radius」
- 「我要搞清楚哪些 layer 其實是一起動的」

這時候 graph 就開始回本了。

## 為什麼我會說 AI Index 可以 cover 大概 95% 大家真正拿 knowledge graph 來做的事

這不是在說舊 knowledge graph 的每一句話都能一比一搬過來。

我講的是 workflow 層面的價值。

平常真正有用的問題，通常是：

- 我要從哪裡開始
- 還有什麼跟這裡綁在一起
- 哪些檔案本來就會一起動
- 如果我只跟 import 走，會漏掉什麼
- 哪些 tests、jobs、configs、migrations 也應該一起看

而這些，剛好就是 AI Index 最擅長回答的。

所以對日常 coding、debug、review、impact analysis 來說，我覺得它大概可以 cover 掉 `95%` 傳統 knowledge graph 的實際用途。

剩下那 `5%`，大概是：

- onboarding narrative
- architecture storytelling
- 歷史設計理由
- 給人類溝通用的材料

這些不是沒價值。

只是對正在改 code 的 agent 來說，通常不是最該優先維護的 artifact。

## 什麼情況最適合上 AI Index

這幾種情況，AI Index 特別有用：

- repo 中大型
- task 常常跨 layer
- AI 常常改漏 related edits
- repo conventions 跟 import edge 一樣重要
- 你很在意 blast-radius analysis

特別適合：

- 有 side effect 的 bug fix
- 會同時動到多層的 feature work
- code review
- cross-repo tracing
- schema、config、migration、job 這些一動就容易連動的工作

## 那傳統 documentation 還有沒有價值

有，當然有。

只是位置不一樣了。

它比較適合：

- 新工程師要先聽故事
- 系統有很多 business context，不在 code 裡
- 你要的是跟人講架構，不是帶 AI 找路
- repo 很小，直接 sweep 一次就夠

所以重點不是：

「docs 沒用了」

而是：

「對 AI-assisted coding 來說，docs 往往不是最應該優先維護的主 artifact。」

## 好處

- 上手更快
- 少很多浪費掉的 tool calls
- impact analysis 會穩很多
- 比較不容易做出只改一半的修改
- 比一整套 prose docs 重複更少
- 維護成本通常比 full knowledge graph 低

## 代價

- 還是要維護
- 如果不做 sync，graph 一樣會 drift
- 它不能取代讀 source code
- 要講 onboarding narrative，還是沒有人類文件那麼順
- repo 太小的話，可能有點 overkill
- domain boundary 切不好，整張圖就會變吵

## 這個 repo 提供什麼

這個 repo 把整套方法整理成 Claude Code 比較好吃的形式：

- [`docs/AI_INDEX_SPEC.md`](docs/AI_INDEX_SPEC.md)
- [`templates/AI_INDEX_TEMPLATE.md`](templates/AI_INDEX_TEMPLATE.md)
- [`skills/ai-index/SKILL.md`](skills/ai-index/SKILL.md)
- [`skills/use-ai-index/SKILL.md`](skills/use-ai-index/SKILL.md)
- [`skills/generate-graph/SKILL.md`](skills/generate-graph/SKILL.md)
- [`skills/sync-graph/SKILL.md`](skills/sync-graph/SKILL.md)

## Quick Start

先裝成 Claude Code plugin：

```bash
/plugin add-marketplace https://github.com/ithiria894/AI-Index
/plugin install codebase-navigator
```

然後一般從這裡開始：

```text
/ai-index
```

常見模式：

- `/use-ai-index`：repo 已經有 index
- `/generate-graph`：從零開始建
- `/sync-graph`：做完有意義改動後同步

## 最後一句話

如果你的問題是：

`AI 不明白這個 feature 是什麼`

那你應該寫 docs。

如果你的問題是：

`AI 改了一個檔案，但另外五個相關檔案它完全沒碰`

那你應該建 AI Index。
