# Reeff 变现模型 v1（免费 / 注册 / 订阅 + 激励广告）

> 本文档是**商业化的唯一依据**。变更时请同步更新：
> `src/lib/plan.ts`（功能限额）、`src/messages/*.json`（额度与升级文案）、
> `/privacy` 与 `/terms`、导出流程组件、`edit`/`organize` 的遮罩组件。
>
> 相关文档：`docs/brand-brief.md`（品牌定位与 Never-do 清单）。

---

## 0. 一页速览（决策表）

| | **匿名（未登录）** | **注册未订阅** | **订阅** |
|---|---|---|---|
| **可用工具** | 9 个开放工具 | 11 个（含 edit / organize **可操作**） | 11 个 |
| **edit / organize** | 🔒 遮罩，仅可浏览页面 | ✅ 可操作，❌ **不可导出** | ✅ 可操作 + ✅ 可导出 |
| **每日免费导出** | **每工具 1 次** → 全站 ≤ **9 次/天** | **每工具 3 次** → 9 个开放工具共 ≤ **27 次/天** | **无限** |
| **额度用完后** | 看激励广告 → 解锁 1 次导出 | 看激励广告 → 解锁 1 次导出 | — |
| **edit / organize 导出** | — | 仅订阅（无广告解锁路径） | ✅ |
| **页面广告** | 内容区展示（每页 ≤1–2 个） | 内容区展示 | **无广告** |

**定价（待最终确认）**：$19 / 年（或再加 $2.99 / 月）；PPP 区域用折扣码给 ~$9 / 年。

---

## 1. 工具分组与标识

`toolKey` 与 i18n 的 `Tools.<key>` / `ToolPages.<key>` 完全一致，共 11 个：

| 分组 | toolKey | 路由 |
|---|---|---|
| **A. 开放工具（9 个）** | `merge` | `/merge-pdf` |
| | `split` | `/split-pdf` |
| | `rotate` | `/rotate-pdf` |
| | `reorderPages` | `/reorder-pdf-pages` |
| | `deletePages` | `/delete-pdf-pages` |
| | `extractPages` | `/extract-pdf-pages` |
| | `crop` | `/crop-pdf` |
| | `pdfToImage` | `/pdf-to-image` |
| | `imageToPdf` | `/image-to-pdf` |
| **B. 受限工具（2 个）** | `edit` | `/edit-pdf` |
| | `organize` | `/organize-pdf` |

- **配额桶只有 9 个**（A 组）。B 组不参与配额与激励广告。
- 密钥/常量放在 `src/lib/plan.ts` 或新建 `src/lib/entitlements.ts`，**不要在各组件里硬编码**。

---

## 2. 额度规则（定量）

| 规则 | 值 |
|---|---|
| 匿名：每工具每日免费导出 | **1 次** |
| 匿名：全站每日上限（9 个工具各 1 次） | **9 次** |
| 注册未订阅：每工具每日免费导出 | **3 次** |
| 注册未订阅：全站每日上限 | **27 次** |
| 订阅：导出 | 无限 |
| 激励广告解锁 | **+1 次**，不缓存、不叠加，仅限 A 组 9 个工具 |
| B 组（edit / organize）免费导出 | **0**（仅订阅） |
| 额度重置 | 登录用户按 **UTC 日期桶**；匿名按**本地日期桶** |
| 超额且广告不可用 | **放行本次导出**（见 §4.3，防死锁） |

> **为什么"每工具分别计数"**：对"随手用多个工具"的普通用户宽容（流量与口碑），
> 对"同一个工具一天用很多次"的高频用户收紧（这才是该付费的人）。
> 代价是全站免费总量偏大（匿名 9 / 注册 27），这是刻意的取舍。

## 3. 配额系统设计

### 3.1 登录用户：服务端计数（唯一可信来源）

**表结构**（Postgres 版本；下方附 D1/SQLite 差异）

```sql
create table if not exists export_quota (
  user_id    text        not null,          -- 账号 ID
  tool_key   text        not null,          -- 9 个开放工具的 key
  day        text        not null,          -- UTC 日期 YYYY-MM-DD
  used       integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, tool_key, day)
);
```

D1 / SQLite 差异：`updated_at text not null default current_timestamp`，其余相同
（SQLite 3.35+ 支持 `RETURNING` 与 `ON CONFLICT ... DO UPDATE ... WHERE`）。

**原子"检查并扣减"**（并发安全，不要在应用层做 read-then-write）：

```sql
insert into export_quota (user_id, tool_key, day, used)
values (:userId, :toolKey, :day, 1)
on conflict (user_id, tool_key, day)
  do update set used = export_quota.used + 1, updated_at = now()
  where export_quota.used < :limit
returning used;
```

- 返回一行 → 扣减成功，本次导出放行
- **没有返回行** → 额度已用完（`used >= limit`）→ 进入激励广告流程
- `:limit` 由身份决定：注册未订阅 = 3，订阅 = 不查表（直接放行）

接口形态（Route Handler / Worker）：

| 方法 | 路径 | 作用 |
|---|---|---|
| `POST` | `/api/export/consume` | 扣减一次额度，返回 `{ allowed: boolean, remaining: number }` |
| `GET` | `/api/export/quota?tool=merge` | 只读查询（用于按钮文案"今日剩余 N 次"） |

### 3.2 匿名用户：客户端计数（诚实用户设计）

- **键格式**：`reeff.quota.v1.<toolKey>.<YYYY-MM-DD>` → 已用次数（字符串数字）
- **日期桶**：本地时区日期（`toLocaleDateString('sv-SE')` 或手动格式化，避免 UTC 偏移）
- **读写**：`getUsed(toolKey)` / `consume(toolKey)`；每次写前重新读取（多标签页共享同一 origin）
- **存储不可用时（Safari 隐私模式 / 禁用 storage / 配额满）**：**按 used = 0 处理并放行**（fail-open），
  同时埋点记录 —— 这与"清缓存即可重置"属同一类已知且接受的绕过，不要让它变成"正常用户被卡住"。
- **每日上限校验**：匿名只看单工具计数（1 次/天），无需全站校验（全站 9 次是自然上限）。

### 3.3 边界情况（必须在实现时处理）

| 情况 | 处理 |
|---|---|
| 跨午夜 | 以"打开导出视图那一刻"的日期为准；导出一半跨天不重算 |
| 换设备 / 换浏览器 | 匿名不迁移（额度归零）；登录用户跟随账号 ✅ |
| 用户改系统时间 | 匿名可被绕过（已接受）；登录用户用服务端 UTC，不受影响 ✅ |
| 多标签页并发点击 | 登录用户：服务端原子 upsert 保证不超发；客户端加**单飞标志 + 按钮 disabled** |
| 额度刚好在导出过程中被用掉 | 以 `/api/export/consume` 的返回值为准，失败则不执行导出 |
| 存储被清空 | 匿名额度重置（已接受）；登录用户不受影响 ✅ |

### 3.4 与 `plan.ts` 的分工（不要混淆两件事）

| 关注点 | 归属 | 例子 |
|---|---|---|
| **功能限额**（工具能力上限） | `src/lib/plan.ts` | merge 最多 2 个文件、split 最多 1 个断点、DPI 上限 |
| **导出次数**（本文件的配额） | 本文档 §2/§3 | 匿名 1 次/工具/天、注册 3 次/工具/天 |
| **权益来源** | 会话（登录）→ DB 里的订阅记录 | 订阅 = 无限 + 去广告 + B 组可导出 |

> 三者都从同一个 `plan` 概念派生，但**不可互相替代**：功能限额拦的是"单次任务的规模"，
> 导出次数拦的是"使用频率"。实现时分别读取，不要合成一个数。

## 4. 激励广告（Google Ad Manager · rewarded ads for web）

> 依据（已核实的官方文档《Traffic rewarded ads for web》）：
> - *"The rewarded ad experience allows users to **voluntarily opt in** to an ad experience in exchange for a reward."*
> - *"Examples of a rewarded ad experience: ... **3 news articles**, 10 gold coins, an extra life in a game, **wifi access at an airport**"* → **内容/功能门槛是官方认可的用法，且不限于游戏**
> - *"The display must be in view for **5 seconds** for a reward to be granted."*（display 需求）
> - *"**Differentiate rewarded versus non‑rewarded ads. Do not show a rewarded prompt for a non‑rewarded ad.**"*
> - *"You **cannot** submit requests for multiple rewarded ads at the same time."*
> - *"**Destroy the ad slot when `rewardedSlotClosed` is called.**"*
> - *"Publishers are responsible for creating and displaying the screen where the user **opts in**, and for delivering the reward."*

### 4.1 前置条件（Ad Manager 侧）

| # | 事项 | 说明 |
|---|---|---|
| 1 | Ad Manager 账号 | 免费但需审核 → **尽早申请** |
| 2 | 创建 ad unit + line item | Reward 字段默认 "1 reward"，可设 **Reward type = `export`，Reward amount = `1`**（与业务语义对齐） |
| 3 | 关闭保护 | **Block non‑instream video ads** 必须关闭，否则不填充 |
| 4 | viewport meta | rewarded 仅对 mobile optimized 页面生效（项目已具备 ✅） |
| 5 | `ads.txt` | 按 host 生效 → **`pdf.reeff.app/ads.txt` 必须单独提供** |
| 6 | CMP + Consent Mode | EEA / 英国必需（Google 认证 CMP） |

### 4.2 导出流程状态机（事件驱动，**不要自己写倒计时**）

```
[点击导出]
   │
   ├─ 订阅 / 仍有免费额度 ──────────────► exporting（直接导出）
   │
   └─ 额度用尽
        │
        ▼
     optIn（自建 opt-in 屏："看一段广告，换 1 次导出"）
        │ 用户确认                    │ 用户取消 → 回到 idle（不扣额度）
        ▼
     requesting（请求一个 rewarded slot，同一时刻只能有一个）
        │
        ├─ SlotRenderEndedEvent.isEmpty = true ─► fallbackGrant（放行）
        ├─ 8 秒超时 / 抛错 / 被拦截 ────────────► fallbackGrant（放行）
        └─ 广告开始播放
              │
              ├─ rewardedSlotGranted  ─► unlockOnce = true ─► exporting
              └─ 用户中途关闭（未 granted）
                     └─ rewardedSlotClosed → 不发奖 → 提示"未完成观看，未获得导出机会"（可重试）
        │
        └─ 任意路径结束后：rewardedSlotClosed → **销毁该 slot**（官方要求，不可复用）
```

**硬性实现要求**
- `unlockOnce` 只对**当前这一次**导出有效：用完即清，不缓存、不叠加
- 同一时刻**只能存在一个** rewarded slot；上一个未关闭前禁止请求下一个
- 展示广告位**绝不能**被包装成"看了就送导出"（官方明令禁止给非奖励广告配奖励提示）

### 4.3 兜底规则（必须实现，防死锁）

| 情况 | 处理 | 理由 |
|---|---|---|
| `isEmpty`（无填充） | **放行本次导出** | 这是**我们的库存问题**，不是用户的问题 |
| 请求超时（8s）/ JS 异常 | **放行本次导出** | 同上 |
| 检测到 AdBlock | 按策略：**默认不放行**，友好提示"请关闭广告拦截，或订阅免广告" + 订阅按钮 | 这是**用户的选择**（业务决定），但做成开关（见下） |
| 用户中途关闭广告 | 不发奖，允许重试 | 官方要求提示会失去奖励 |
| 放行路径 | 不消耗当天免费额度（或按实现消耗一次，二选一并写进埋点） | 保持行为一致、可统计 |

**AdBlock 策略开关（工程保险）**

```
NEXT_PUBLIC_AB_POLICY = "block"   # 默认：无广告 → 不导出，提示关闭或订阅
                      = "allow"   # 一键翻回：检测到拦截器也放行（只提示）
```

> 目的：上线两周后如果"导出失败率"或订阅转化不达预期，改一个环境变量即可回退，无需改代码。
> 注意：AdBlock 检测本身**不可靠**（Brave / uBlock / Safari 内置 / DNS 拦截 / 企业代理 / VPN 都会误报），
> 因此命中时只做"提示 + 订阅出口"，**不要在页面加载时就弹窗或遮挡**，也不要因此封禁账号。

### 4.4 不接入激励广告的路径

- `edit` / `organize` 的导出：**不请求 rewarded**，直接展示订阅 CTA
  （避免"看完广告仍不能导出"的必须避免的坑）
- 订阅用户：完全不出广告，不请求任何 rewarded

### 4.5 展示广告位规则（被动收入）

| 位置 | 规则 |
|---|---|
| 工具工作区（上传区 / 控制面板 / 画布） | ❌ **零广告** |
| 工具页正文区（`ToolContent` 附近）/ 相关工具之间 | ✅ 每页 ≤1 个 |
| 导出视图（按钮下方） | ✅ 1–2 个，且必须与 rewarded 广告**明显区分** |
| 首页 / 品牌页 | ✅ ≤2 个 |
| 插屏 / 弹窗 / 锚定悬浮 / 自动播放视频 | ❌ 永不使用 |

**导出视图内容要求**（避免被判"为广告而存在的页面"）：文件摘要（页数/大小）、
"导出后会发生什么"、隐私说明行、相关工具链接；并且 **`noindex`**（不进 sitemap）。

## 5. 导出视图规范（内存 store，不做真跳页）

### 5.1 为什么不能真的"跳到下一页"

导出所需的数据（`File` 对象 / canvas 状态）**只存在于浏览器内存**：

| 场景 | 结果 |
|---|---|
| Next 客户端路由跳转（`router.push`） | ✅ 内存保留 |
| **刷新页面 / 新标签打开 / 前进后退 / iOS 回收内存** | ❌ **文件丢失** → 导出视图变成"没有文件可导" |

### 5.2 方案：同一路由内的全屏导出视图

- 视觉与"独立页"完全一致（全屏 overlay / 步骤视图），但**不改变 URL**
- 数据通过**应用层共享内存 store**（Context 或 Zustand，挂在 app shell 上）传递：
  `{ toolKey, files | canvasState, outputName, sourceToolLabel }`
- **兜底**：打开导出视图时若 store 为空 → 显示"文件已失效，请重新上传" + 返回工具的按钮（绝不显示空白页）
- ✅ 附带好处：既然是 overlay 就**没有新的 URL**，不存在"导出页被判薄内容/需要 noindex"的问题；
  广告仍然会渲染并产生曝光（曝光来自广告单元加载，不依赖 pageview）
  > 代价：不会增加 pageview 指标（如果你更看重这个指标，可改用"真路由 + IndexedDB 暂存文件"，但要额外处理大文件写入、配额与清理）

### 5.3 导出视图内容（必须包含）

| 区块 | 内容 |
|---|---|
| 文件摘要 | 文件名 / 页数 / 大小（来自 store 或工具组件） |
| 主操作 | **真正的导出按钮**（用户点击后才生成并下载） |
| 额度状态 | 有额度时显示"今日剩余 N 次"；无额度时显示 opt-in 或订阅 CTA |
| 说明 | "导出后会发生什么"（本地生成、不上传） |
| 隐私行 | 复用 `ToolContent.privacy` 文案 |
| 相关工具 | 复用 `RelatedTools` 组件 |
| 广告 | 按钮下方 1–2 个展示位（与 rewarded 明显区分） |

### 5.4 交互与无障碍

- **焦点管理**：进入导出视图时把焦点移到标题；`Esc` 可关闭返回工具；焦点不逃逸到背景
- **状态播报**：`aria-live="polite"` 播报"正在准备广告 / 已获得导出机会 / 广告未完成"
- 单飞：请求 rewarded 期间按钮 `disabled`，防重复请求（官方：同一时刻只能一个 rewarded）
- 键盘可达：所有 CTA 可 Tab 聚焦

---

## 6. `edit` / `organize` 匿名遮罩规范

### 6.1 行为

| 身份 | 工具区 | 导出按钮 |
|---|---|---|
| 匿名 | 🔒 **灰色半透明遮罩**（只可浏览页面） | — |
| 注册未订阅 | ✅ 完全可用 | 🔒 显示"订阅后可导出" + 订阅 CTA（**不请求 rewarded**） |
| 订阅 | ✅ | ✅ 可用 |

### 6.2 遮罩实现要求（含 SEO 硬约束）

| 要求 | 原因 |
|---|---|
| **只覆盖工具操作区**，不要覆盖页头/正文/相关工具 | 页面主体必须可读取、可索引 |
| **SSR 内容原样输出**：`<h1>`、描述、`ToolContent`（简介+怎么用+隐私）、`RelatedTools`、`BreadcrumbList` **全部照常渲染** | `edit pdf` 是搜索量最高的关键词之一，这两页**绝不能变成空页/薄内容** |
| 遮罩样式 | `bg-slate-900/60 backdrop-blur-sm` + 居中卡片（文案 + 注册/登录 CTA）；卡片内按钮在正常 DOM 顺序中，可 Tab 聚焦 |
| 对操作区使用 `inert`（现代浏览器） | 阻止 Tab/点击进入被遮罩控件，同时保留 DOM 供无障碍与爬虫解析 |
| **不要**用 modal/dialog 包裹整页，**不要**自动弹窗，**不要**给正文加 `aria-hidden` | 避免被判插屏、避免影响索引 |
| **不要出现"遮罩闪烁"**：仅在会话状态已知后才渲染遮罩，未登录判断期间显示中性骨架 | 避免已登录用户看到一秒的遮罩（体验事故） |

### 6.3 需要新增的 i18n key（× 10 语言）

```
Gate.anonMaskTitle        "这个工具需要登录后使用"
Gate.anonMaskBody         "免费注册即可操作；导出需要订阅"
Gate.registerCta          "注册 / 登录"
Gate.exportLocked         "订阅后可导出"
Gate.subscribeCta         "查看订阅"
Gate.quotaRemaining       "今日剩余 {count} 次导出"
Gate.quotaExhausted       "今天的免费导出次数已用完"
Gate.rewardOptInTitle     "看一段广告，换 1 次导出"
Gate.rewardOptInBody      "广告是我们的收入来源；订阅后没有任何广告"
Gate.rewardWatch          "开始观看"
Gate.rewardGranted        "已获得 1 次导出机会"
Gate.rewardClosedEarly    "未完成观看，未获得导出机会（可重试）"
Gate.rewardUnavailable    "广告暂时不可用，本次导出已免费放行"
Gate.adblockTitle         "检测到广告拦截"
Gate.adblockBody          "请关闭拦截器以继续导出，或订阅免广告"
Gate.exportMissingFile    "文件已失效，请重新上传"
```

> 文案基调遵循 `docs/brand-brief.md`：客气、直白、不指责用户、不使用促销腔。

## 7. 申请与合规清单

| # | 事项 | 为什么 | 何时 | 状态 |
|---|---|---|---|---|
| 1 | **Google Ad Manager 账号** | rewarded 广告的载体；**需审核** | **立刻**（要等） | ☐ |
| 2 | 创建 ad unit + line item（Reward type `export`，amount `1`） | 让奖励语义与业务一致 | 账号通过后 | ☐ |
| 3 | 关闭 **Block non‑instream video ads** | 否则 rewarded 不填充 | 与 2 同时 | ☐ |
| 4 | `ads.txt`（**`pdf.reeff.app/ads.txt`**，按 host） | 广告需求方要求 | 与 2 同时 | ☐ |
| 5 | **CMP + Consent Mode**（EEA/英国） | Google 强制要求 | 上线广告前 | ☐ |
| 6 | **Lemon Squeezy 商户审核**（KYC、收款到马来西亚） | 订阅收入通道 | 与 1 并行 | ☐ |
| 7 | 更新 `/privacy`：广告 Cookie、第三方广告、配额与标识记录 | 现状写着"不设置广告 Cookie" → **自相矛盾，必须改** | 上线广告前 | ☐ |
| 8 | 更新 `/terms`：订阅、退款、额度、广告条款 | 法务前置 | 与 7 同时 | ☐ |
| 9 | **Google OAuth 同意屏幕**发布（需隐私政策 URL ✅ 已有） | Google 一键登录 | Step 4 前 | ☐ |
| 10 | **平台决策 + 商用资格**（Vercel Pro $20/月 或 Cloudflare） | Hobby 禁止商用；账号+配额需要 DB | **Step 1 前** | ☐ |
| 11 | DB（配额 + 订阅状态）：Postgres / D1 | 服务端计数与权益 | Step 1 前 | ☐ |
| 12 | 定价页 + 升级入口 + 恢复购买 | 变现闭环 | Step 6 | ☐ |
| 13 | GSC：已提交 sitemap，盯索引曲线 | 流量基线 | 已完成 ✅ | ☑ |
| 14 | 马来西亚本地渠道（Billplz/toyyibpay）+ SSM | 本地用户付款（LS 不支持 FPX/TnG） | **二期**，视数据再决定 | ☐ |

---

## 8. 实现顺序与验收标准

> 每一步都应**可独立验收**后再进入下一步。

### Step 1 · 配额基础（匿名 + 服务端）
- 产出：`src/lib/entitlements.ts`（工具分组、限额常量）、匿名 localStorage 读写、`POST /api/export/consume`、`export_quota` 表
- **验收**：匿名第 1 次导出成功；第 2 次被拦截并显示"今日免费额度已用完"；清空 localStorage 后可再次导出（预期行为）；服务端接口在并发两次请求下不会超发（用两并发 curl 验证）

### Step 2 · 导出视图（overlay + 内存 store）
- 产出：共享 store、全屏导出视图组件、文件失效兜底、i18n key（`Gate.*`）
- **验收**：任意开放工具能打开导出视图并成功导出；**刷新页面后**显示"文件已失效，请重新上传"；URL 不变化；键盘可完成全流程；`aria-live` 播报状态

### Step 3 · `edit` / `organize` 遮罩
- 产出：遮罩组件（`inert` + 卡片 + CTA）
- **验收**：匿名打开 `/en/edit-pdf` 看到遮罩且**无法操作**；`curl` 抓取该页 HTML 仍包含 `<h1>`、正文简介、"How it works"、相关工具链接（SEO 不退化）；登录未订阅用户看到"订阅后可导出"而无遮罩；无遮罩闪烁

### Step 4 · 认证（Google 一键登录）
- 产出：会话、登录/登出、配额切换到服务端、账号删除入口
- **验收**：登录后换浏览器仍保留配额；登出后回到匿名计数；删除账号后相关记录清空

### Step 5 · 激励广告（Ad Manager rewarded）
- 产出：opt-in 屏、状态机、兜底、埋点
- **验收**：额度用尽 → opt-in → 观看 → **`rewardedSlotGranted` 触发后**按钮才解锁 → 导出成功 → slot 被销毁；`isEmpty` 时放行并提示；中途关闭不发奖可重试；**同一时刻只有一个 rewarded slot**；展示广告位与 rewarded 视觉可区分

### Step 6 · 订阅（LS + 账号绑定）
- 产出：`create-checkout` 时传 **`checkout_data[custom][user_id]`**、webhook 写订阅状态、权益读取
- **验收**：用测试模式完成结账 → webhook 收到 `meta.custom_data.user_id` → 页面刷新后无广告、无限导出、`edit`/`organize` 可导出；取消订阅后权益回收（webhook 更新）

### Step 7 · 展示广告 + 合规
- 产出：广告位组件（每页 ≤1–2）、CMP 接入、`ads.txt`、隐私/条款更新
- **验收**：工具工作区零广告；EEA 用户在未同意前**不加载**任何广告脚本；`https://pdf.reeff.app/ads.txt` 返回 200；`/privacy` 已如实描述广告数据

---

## 9. 端到端用例（上线前必须手测通过）

| # | 用例 | 期望 |
|---|---|---|
| 1 | 匿名用 `merge` 导出 1 次 | 成功，并显示"今日剩余 0 次" |
| 2 | 匿名用 `merge` 再导出 | 出现 opt-in → 观看广告 → 获得 1 次 → 导出成功 |
| 3 | 匿名在 `crop` 上导出（同一浏览器） | **成功**（每工具独立计数：crop 仍有 1 次） |
| 4 | 匿名打开 `/en/edit-pdf` | 遮罩 + 不可操作；页面正文与相关工具仍可见 |
| 5 | 注册并登录后用 `merge` 导出 4 次 | 前 3 次直接成功，第 4 次出现 opt-in |
| 6 | 登录用户打开 `/zh/organize-pdf` | 可操作；导出按钮提示"订阅后可导出"；**不出现 rewarded** |
| 7 | 订阅用户（测试模式） | 无任何广告；`edit`/`organize` 可导出；额度不显示 |
| 8 | 广告无填充（可用 Ad Manager 测试流量或强制 `isEmpty`） | **放行 + 提示"广告暂时不可用，本次已免费放行"** |
| 9 | 开启广告拦截器 + `AB_POLICY=block` | 提示关闭拦截器或订阅；**不出现死循环/空白** |
| 10 | 观看中关闭广告 | 提示未完成、未获得机会；可重试；额度未被扣除 |
| 11 | 导出视图刷新页面 | "文件已失效，请重新上传" + 返回按钮 |
| 12 | 并发双击导出按钮 | 只消耗 1 次额度（单飞 + 服务端原子扣减） |

---

## 10. 开放问题（待定，不影响前 3 步开工）

| # | 问题 | 现状 |
|---|---|---|
| 1 | 定价：$19/年 单独，或 + $2.99/月 | 建议 $19/年 + 可选月付；PPP 折扣 ~$9 |
| 2 | 平台：Vercel Pro（$20/月）vs Cloudflare（$0–5/月） | **必须在 Step 1 前定**（账号+配额需要 DB 与商用资格） |
| 3 | 服务端正向功能（发票查验 / 云 OCR / 批量 / API） | 强烈建议至少加 1 个，否则订阅价值仍是"去广告+解锁"的负向结构 |
| 4 | AdBlock 策略默认值 | 暂定 `block`（可一键翻转，见 §4.3） |
| 5 | 放行路径是否消耗当天额度 | 待定，需与埋点口径一致 |
| 6 | `edit` / `organize` 是否给"首次免费试导 1 次" | **已决定：不给**（导出严格仅订阅） ✅ |




