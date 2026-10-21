# Reeff 变现模型 v2（全功能免费 · 页面广告 · 会员预留）

> **状态：v2 已取代 v1（2026-10-20）。**
> v2 的核心变化：**取消配额、取消登录前置、取消激励广告、取消工具遮罩**。
> 11 个工具**全部免费、无限次使用与导出**；收入**只来自页面展示广告**；
> 会员（去广告）作为**未来可选项**，现在不实现。
>
> v1 的完整设计与论证保存在 git 历史（`71485da:docs/monetization.md`），
> 本文档**附录 A** 保留了可复用的关键设计，将来重启会员时不必重写。
>
> 本文档是商业化的唯一依据。变更时同步更新：
> `src/lib/ads.ts`（版位与开关）、`src/components/ads/*`、`src/messages/*.json`（广告标签）、
> `/privacy` 与 `/terms`（子域当前**尚无**这两个页面，见 §4.4）。
> 相关文档：`docs/brand-brief.md`（品牌定位与 Never-do 清单）。
>
> **实现现状（2026-10-21）：** v1 遗留的配额分支已从代码中彻底移除——
> `src/lib/plan.ts`（free 版 `mergeMaxFiles: 2` / `splitMaxBreaks: 1` / `pdfToImageMaxDpi: 150` / `zipExport: false`）
> 与仅供调试切换套餐的 `src/lib/flags.ts` 已删除；合并 / 拆分 / 转图片三个工具里的
> VIP 升级文案（`PdfMerge.dev|upload|footer|errors.freeLimit`、`PdfSplit.dev|errors.freeLimit`、
> `PdfCrossMerge.upload.prompt` 的 "(VIP)" 后缀）也一并移除，10 个语言同步。
> 现在**代码层面不存在任何文件数 / 拆分点 / DPI / 导出方式限制**。
> 将来若重启会员，按附录 A 重新引入，不要恢复配额与激励广告。
>
> **广告骨架（同一天完成，Step 2 + Step 3 的版位已就位，默认全关）：**
> `src/lib/ads.ts`（配置源）、`src/lib/ads-script.ts`（按需加载）、`src/lib/ads-consent.ts`（兜底 CMP 状态）、
> `src/components/ads/{AdProvider,AdSlot,ConsentBanner}.tsx`；P1/P2 接在 `ToolPageShell`，P3 接在首页；
> 工具页补上了页脚（隐私政策可达性）。
> 由于 `NEXT_PUBLIC_ADS_ENABLED` 默认 `false`，当前构建**零广告 DOM、零广告脚本、零请求**；
> 拿到 ad unit id 后按 §3.5 填环境变量即可逐版位开启，不需要改代码。
> P4（移动锚定）按 §9 #2 的决定暂不实现。

---

## 0. 一页速览

| 维度 | **现在（v2）** | 未来（可选，v3） |
|---|---|---|
| 可用工具 | **11 个全部可用**（含 `edit` / `organize`） | 不变 |
| 使用次数 | **无限制** | 不变 |
| 导出次数 | **无限制、无水印** | 不变 |
| 登录 / 账号 | **不需要**（全站无服务端状态） | 会员需要 |
| 服务端 / DB | **不需要**（纯静态即可运行） | 订阅校验需要 |
| 收入 | **页面展示广告** | 广告 + 去广告订阅 |
| 广告 | 每页 ≤2 个内容位 + 1 个移动锚定；导出流程内**零广告** | 会员零广告 |

**三条不可退让的底线（广告模式的生死线）**

1. 加广告**不能让工具变慢或变难用** —— 广告只在空白区域，**工具工作区零广告**
2. **导出 / 下载按钮附近禁放广告** —— Google 政策原文见 §4.1，这是最高频的封号原因
3. 广告被拦截时**工具照常可用**（不提示、不惩罚、不留白块）

### 为什么放弃 v1（配额 + 激励广告 + 会员）

| v1 的问题 | v2 的判断 |
|---|---|
| 配额直接砍掉"打开即用"的卖点，与品牌三支柱（打开就能用／不排队／交代清楚）冲突 | 免费无门槛才是这类工具的转化核心；**先要流量** |
| 账号 + DB + 服务端计数 + webhook + 遮罩 ≈ 2–3 周工程量，且全部发生在**收到第一分钱之前** | 广告可以先上线，工程量≈一个组件 + 一个配置文件 |
| 激励广告要自建 opt-in 屏 + 事件状态机 + 兜底，而"看广告换导出"本质是负向体验 | **不做** |
| "1 次/工具/天"极易被截图传播成"假免费"，伤害口碑 | **不做** |
| 没有流量时，会员定价与价值主张无从验证 | 先用广告验证流量与留存，4–8 周后再谈会员 |

---

## 1. 收入模型（先把预期摆正）

**计费口径**：`月收入 ≈ 月广告曝光 ÷ 1000 × RPM`，
其中 `曝光 ≈ 月 PV × 每页平均成功填充的广告位数量`（经验值 1.2–1.6）。

| 月 PV | 曝光（×1.5） | @ RPM $0.8 | @ RPM $1.5 | @ RPM $3.0 |
|---|---|---|---|---|
| 10,000 | 15,000 | $12 | $23 | $45 |
| 50,000 | 75,000 | $60 | $113 | $225 |
| 200,000 | 300,000 | $240 | $450 | $900 |
| 1,000,000 | 1,500,000 | $1,200 | $2,250 | $4,500 |

> **RPM 是假设值**，必须用 Ad Manager 实测替换。
> 工具类站点的全球混合流量通常低于内容站；US / EU 占比越高、RPM 越高。
> 成本侧：Cloudflare 免费额度 + 域名 ≈ **$1/月** → 约 **1,000 PV/月即可覆盖成本**。

**三句必须记住的结论**

1. 广告模式在**成本上**立刻成立，但**绝对收入取决于流量**，不要指望早期收入；
2. 本阶段唯一该优化的是：**收录与点击（SEO）→ 工具完成率 → 曝光**；
3. 会员不是"更高级的产品"，而是**流量足够大时才值得做的 ARPU 提升**（门槛见 §6.1）。

---

## 2. 广告位规划

设计原则：广告只出现在**用户不需要专注的位置**，且**远离所有"下载／导出／操作"按钮**。

| 版位 | 位置 | 尺寸 | 端 | 说明 |
|---|---|---|---|---|
| **P1 顶部横幅** | Navbar 下方、工具工作区**上方** | 970×90 ／ 728×90 ／ 320×100（响应式） | 全 | 桌面用 970/728，移动用 320×100；高度必须预留（防 CLS） |
| **P2 工作区下方** | 工具卡片与正文（`ToolContent`）之间 | 336×280 ／ 300×250 ／ fluid | 全 | 用户"已经做完事"才看到，转化损失最小 |
| **P3 正文内** | 正文第 2 段之后（首页 / 长文页） | fluid（in-article） | 全 | 每页只放 1 个 |
| **P4 移动锚定** | 屏幕底部（可关闭） | auto | 仅移动 | AdSense 自动广告的 Anchor，或在 GAM 中用固定 slot + 自建可关闭 UI 实现 |
| ❌ **禁止** | 工具工作区内部、文件拖放区、**导出按钮周边 96px**、按钮与按钮之间 | — | — | 政策红线（§4.1） |
| ❌ **禁止** | 弹出式／插屏／带声自动播放视频 | — | — | Better Ads Standards + 体验 |

**每页上限**：1 个 P1 + 1 个 P2（或 P3）+ 1 个 P4（仅移动）
→ **桌面 ≤2 个内容位，移动 ≤3 个**。

**导出流程内零广告**：凡是有"下载／导出"按钮的那一屏，**不放任何广告**。
将来若做成步骤式导出视图，同样适用（那里是政策高危区）。

---

## 3. 技术实现（Google Ad Manager / GPT）

### 3.1 选型

| 方案 | 结论 |
|---|---|
| **Google Ad Manager（GAM）** | ✅ **推荐**：版位/尺寸统一管理、可用 house line item 兜底、将来对会员关闭广告只换 unit、报表更细 |
| AdSense 直接接入 | 起步更简单，但控制力弱、后期迁到 GAM 要改代码；可作为 GAM 的需求来源（能否关联以账号类型说明为准） |
| 第三方网络（Ezoic 等） | ❌ 现在不引入：脚本重、伤 LCP，与"快"的定位冲突 |

> GAM / AdSense 都需要**申请 + 站点审核**（人工复核，时间不定）→ **今天就提交**，
> 代码可以先写好、ID 拿到后填进 `src/lib/ads.ts`。

### 3.2 文件与职责

| 文件 | 职责 |
|---|---|
| `src/lib/ads.ts` | **单一配置源**：`ADS_ENABLED`、`ADS_CLIENT`（默认取 ads.txt 的 `pub-`）、`ADS_CMP`、版位表（`p1`/`p2`/`p3` → ad unit id + 尺寸组 + 预留高度）、`isPlacementReady()`、`pushAd()` |
| `src/lib/ads-script.ts` | **按需**注入 `adsbygoogle.js`（`id="reeff-ads"` 幂等）；由第一个真正渲染的广告位调用 → 无广告位的页面零请求 |
| `src/lib/ads-consent.ts` | 兜底 CMP 的同意状态存储（`useSyncExternalStore` + `localStorage['reeff.ads.consent.v1']`，跨标签页同步） |
| `src/components/ads/AdSlot.tsx` | 客户端组件：「Advertisement」标签 → 高度预留 → `push({})` → 观测 `data-ad-status`；未启用 / 未配置该版位时**渲染 `null`**（不留 DOM）；无填充、被拦截、4 秒无回应都折叠 |
| `src/components/ads/AdProvider.tsx` | 提供 `enabled` / `canServe`（现在恒 `true`）；将来读到会员 `adFree` 即置 `false` → **广告组件零改动** |
| `src/components/ads/ConsentBanner.tsx` | 兜底 CMP（仅 `ADS_CMP=builtin`）；未同意前**不加载任何广告脚本**。生产默认 `google`，由 Funding Choices 承担 |
| `public/ads.txt` | 授权卖方清单，**两个域各一份**：`pdf.reeff.app/ads.txt`（本仓库 → CF Pages）+ `reeff.app/ads.txt`（`reeff-home` → Vercel）。AdSense「添加网站」只接受注册域，根域那份决定账户里的站点状态 |

### 3.3 广告生命周期（Next 客户端路由的坑，必须逐条照做）

> 当前实现走 **AdSense 手动版位**（client `ca-pub-4891040014815847`，与 `ads.txt` 一致）。
> 下表按实现逐条列出，右侧是代码位置；将来迁到 GAM 只需替换 `AdSlot` 内部，
> 版位表与外层布局都不用动。

| 要求 | 实现位置 / 原因 |
|---|---|
| 广告脚本**全站只执行一次** | `lib/ads-script.ts` 用 `#reeff-ads` 幂等注入；重复注入会让 slot 行为异常 |
| 脚本只在**真的有广告位**时才加载 | `AdSlot` 的 effect 里调用 → `/privacy`、`/terms`、404 零请求 |
| 路由变化时**换新的 `<ins>`**，不复用旧容器 | `key={pathname}` + `requestedFor` 记录 `${pathname}::${placement}`；否则旧广告残留在新页面（"广告串页"） |
| 每个容器的 id / 槽位**不重复** | `<ins data-ad-slot>` 固定 + React 每次重新挂载；AdSense 不允许同一 `<ins>` 被 push 两次 |
| 组件卸载时**清理观测器与定时器** | effect 返回 `clearTimeout` + `observer.disconnect()`，防幽灵曝光 |
| **不要**为了多曝光而重复 `push({})` | 可能被判无效流量（扣款风险） |
| 逻辑只在客户端 | `"use client"` + `typeof document` 守卫，SSR 阶段不触碰 `document`，静态导出首屏不报错 |

### 3.4 性能与 CLS（必须达标）

| 项 | 要求 |
|---|---|
| 脚本加载 | `next/script` `strategy="afterInteractive"`，且**仅在** `ADS_ENABLED` **且**已取得同意时加载 |
| 首屏 | P1 **不得**把工具工作区推出首屏；移动端必要时隐藏 P1、只留 P4 |
| 高度预留 | 容器 `min-height` 与尺寸组一致（90 / 250 / 280 / 100）；无填充时折叠为 0，**不允许跳动** |
| 无填充 | 折叠容器并移除外边距；**不要**留空白灰块 |
| 广告被拦截 | 与无填充同处理：静默折叠，工具完全可用，**不弹任何提示** |
| 目标 | **CLS < 0.1**；LCP 相对"关广告"回归 **< 10%**（用 PageSpeed Insights 对比） |

### 3.5 开关

| 变量 | 默认 | 作用 |
|---|---|---|
| `NEXT_PUBLIC_ADS_ENABLED` | 未设 = `false` | 总开关；`false` → 全站**零广告 DOM、零广告脚本、零请求**（本地开发、staging、紧急关闭用） |
| `NEXT_PUBLIC_ADS_CLIENT` | `ca-pub-4891040014815847`（与 `ads.txt` 一致） | 发布商 ID |
| `NEXT_PUBLIC_ADS_SLOT_P1/P2/P3` | 空 | 各版位 ad unit id；**留空的版位直接不渲染**，所以可以先上线 2 个版位 |
| `NEXT_PUBLIC_ADS_CMP` | `google` | `google` = Funding Choices 负责同意；`builtin` = 用内置 `ConsentBanner` 闸门（非 TCF 认证，EEA 不要用） |
| `NEXT_PUBLIC_ADS_TEST` | 未设 | `true` → 加 `data-adtest="on"`，只出测试广告，别用来验收 RPM |

- 会员预留：`AdProvider.enabled` 现在恒等于「开关打开且 client 存在」；将来 = `!session.isAdFree`。
- **`NEXT_PUBLIC_*` 是构建期内联**，本站又是纯静态导出（`out/`），广告 `<ins>` 是**构建时烧进 HTML** 的：
  只改变量不重建 = 线上零变化。CF Pages 的准确路径：
  ```
  Workers & Pages → my-pdf-app → Settings → Variables and Secrets
    → Add（Type: Text，不要选 Secret）→ Environment: Production（Preview 需另加一遍）→ Save
    → Deployments → 最新部署右侧 "…" → Retry deployment
  ```
  本地等价：`NEXT_PUBLIC_ADS_ENABLED=true … npm run build && npx wrangler pages deploy out --project-name my-pdf-app`。
  变量清单见仓库根 `.env.example`（不会被 Next 读取，仅作模板，避免 `builtin` 误上生产）。
- **每次构建后跑** `npm run check:ads`（`scripts/check-ads.mjs`）：按当前环境变量断言每页广告数
  （工具页 2 / 首页 1 / 法务页 0）、确认脚本没有进静态 HTML、P2 与工具卡片保持 96px + 分隔线。
  它**读的是构建产物**，所以必须与部署用同一组环境变量跑，否则断言的是上一次的配置。
- **上线顺序**：先在 AdSense 建 3 个 ad unit → 填 `ADS_SLOT_*` → 在 Privacy & messaging 开启 CMP → 才把 `ADS_ENABLED=true`。
  若 CMP 还没配好就要先看效果，用 `ADS_CMP=builtin`，此时未点「接受」不会加载任何广告脚本。
- **站点必须是根域**：AdSense 表单拒收子域 → 账户里的站点是 `reeff.app`；`pdf.reeff.app` 的放量
  依赖根域审核通过。根域 `ads.txt`（`reeff-home`）与子域 `ads.txt`（本仓库）必须同时在线且 pub id 一致。
- 根域站点刻意**不迁到 Cloudflare**：它就是一份静态 `ads.txt` 的需求，迁移 Next 16 应用到
  `@opennextjs/cloudflare` 要重建构建链、换域名与环境变量，风险与收益不成比例。

---

## 4. 合规（不做 = 封号，逐条核对）

### 4.1 广告位置政策（官方原文）

> *"Publishers are not permitted to encourage users to click on Google ads in any way.
> This includes implementing the ads in a way that they might be mistaken for other site
> content, such as a menu, navigation, or download links. **Be careful when placing links,
> play buttons, download buttons, navigation buttons (e.g., "Previous" or "Next"), game
> windows, video players, drop-down menus, or applications near ads because they might lead
> to accidental clicks. Even if the layout unintentionally leads to accidental clicks,
> publishers may still receive a violation notification.**"*
> —— Google AdSense《Ad placement policies》

**对我们的硬约束**

| 要求 | 落地做法 |
|---|---|
| 导出／下载按钮附近禁放广告 | 广告与"导出"按钮之间**至少隔一个独立区块**（分割线 + ≥96px 间距），且**不在同一张卡片内** |
| 广告不得伪装成 UI | 广告容器背景/边框与工具卡片明显不同；不与文件列表、按钮同色同形状 |
| 必须标注 | 广告上方固定小字标签：中文「广告」／英文「Advertisement」（i18n `Ads.label`）；官方只允许 "Advertisements" / "Sponsored Links" 这类明确标注 |
| 不得诱导点击 | 全站文案不得出现"点广告支持我们""看广告帮助站点"之类表述 |
| 不得用箭头/动画指向广告 | 广告容器内不放装饰性指引、不做闪烁 |
| 移动锚定不得遮挡操作 | anchor 与底部导出按钮保持安全距离，且用户可关闭 |
| Better Ads Standards | 不做插屏、不做带声自动播放、不做大面积遮挡 |

### 4.2 ads.txt 与授权卖方

> *"You must not: place Google-served ads on a domain that uses ads.txt where you are not
> included as an authorized seller of the inventory in the ads.txt file."*

- `https://pdf.reeff.app/ads.txt` 必须 **200**，内容为 Google 提供的行
  （形如 `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`）
- **按 host 生效**：`pdf.reeff.app` 与 `reeff.app` 是不同 host，各自需要自己的 `ads.txt`

### 4.3 CMP 与同意（EEA / 英国 / 瑞士）

- 必须使用 **Google 认证的 CMP**（TCF v2.2）；**未取得同意前不得加载广告脚本或写广告 Cookie**
- 已采用 AdSense 内置的 **Privacy & messaging / Funding Choices**（免费、合规、零开发），
  具体填值见 §7 Step 4.5
- 非 EEA 用户：至少提供"隐私设置"入口，可随时撤回同意（Funding Choices 消息自带「隐私设置」链接）
- 同意状态必须**与广告请求联动**（Consent Mode），不能只是弹个窗了事；因此生产固定
  `NEXT_PUBLIC_ADS_CMP=google`，内置 `ConsentBanner` 只用于 CMP 就绪前的自测

### 4.4 隐私政策与条款

| 现状 | 需要做 |
|---|---|
| ✅ `/privacy`、`/terms` 已存在（10 语言），首页与**所有工具页**页脚均有链接（工具页页脚是随广告骨架一起补上的） | 无（保持随实现更新） |
| ✅ 隐私政策已含：Google 广告 Cookie 与标识符、个性化广告说明、Google Ads Settings 与 aboutads.info 两个 opt-out 入口、EEA/UK/CH 先同意后写 Cookie | 等 Funding Choices 真正开启后，再补一句同意记录方式 |
| 现有 `ToolContent.privacy` 文案（"文件不离开设备"） | ✅ **依然正确，不要改**；广告与文件处理无关，页面广告标签已足够说明 |
| `/terms` | ✅ 已含免费、无 SLA、页面含广告、第三方链接免责 |

---

## 5. 指标与实验

| 指标 | 来源 | 用途 |
|---|---|---|
| PV / UV / 国家分布 | Cloudflare Analytics（迁移后） | 判断 RPM 天花板 |
| 广告曝光 / 可见曝光 / viewability | Ad Manager 报表 | 版位质量 |
| RPM、会话 RPM | Ad Manager | 收入基线 |
| 工具完成率（上传 → 导出） | 轻量埋点（**无 Cookie、无 PII**，如 Plausible 或自建计数端点） | 广告是否损伤体验 |
| CLS / LCP | PageSpeed Insights（开/关广告对比） | 性能底线 |

**实验（一次只改一个变量）**

1. P2 vs P3 的 RPM 与跳出率
2. 移动锚定开 / 关
3. P1 桌面 970 vs 728
4. 每页 2 位 vs 3 位（观察完成率是否变差）

**决策点**：连续 4 周数据后回答两个问题 ——
① 广告是否已覆盖成本并随流量增长？② 加会员是否会显著提高 ARPU？（门槛见 §6.1）

---

## 6. 未来：去广告会员（预留，不现在做）

### 6.1 触发条件（任一满足再启动）

- 月 PV ≥ 50,000 **且** 连续 3 个月 RPM 稳定；或
- 用户反馈中出现明确的付费意愿信号（≥10 例，或问卷 ≥5% 愿付）

### 6.2 形态

| 项 | 设计 |
|---|---|
| 卖点 | **只有一件事：去广告**（不做功能分级、不做配额） |
| 价格 | $12–19 / 年（PPP 折扣另议） |
| 结算 | Lemon Squeezy（商户审核需提前 2–4 周排期） |
| 账号 | 仅用于"证明订阅有效"：Google 一键登录 + 会话 |
| 权益 | `adFree = true` → `AdProvider.enabled = false`（**零重构**） |
| 退款 | 遵循 LS 政策 + 自助取消 |

### 6.3 届时需要新增（复用附录 A）

账号 / 会话 / DB / LS webhook —— 但**不需要**配额表、**不需要**激励广告、
**不需要**工具遮罩。工程量约为 v1 的 40%。

---

## 7. 实现顺序与验收

> 每一步独立可验收后再进入下一步。

### Step 1 · 申请与账号（今天提交，等审核）
- Ad Manager（推荐）或 AdSense；提交站点 —— **AdSense 的「添加网站」表单只收注册域**，
  子域会被拒绝，所以站点填 `reeff.app`（不是 `pdf.reeff.app`），审核看的是根域首页。
- 根域 `ads.txt` 必须可达：`https://reeff.app/ads.txt`（`reeff-home` 仓库 `public/ads.txt`，
  Vercel）。没有它「网站」页会一直报「ads.txt 未找到」。
- **验收**：审核通过 → 站点状态「就绪」+ ads.txt「已授权」；拿到 `pub-` ID 与至少 1 个 ad unit。
- **审核通过后必查**：`pdf.reeff.app` 是否真的放量（AdSense「网站」/报告里应出现该子域的请求）。
  若被标「站点未获批准」，先重试添加子域，再联系支持（子域与根域同一主体）。

### Step 2 · 广告组件骨架（可在拿到 ID 前完成）✅ 2026-10-21
- 产出：`src/lib/ads.ts`、`src/lib/ads-script.ts`、`src/lib/ads-consent.ts`、
  `AdProvider`、`AdSlot`、`ConsentBanner`、`NEXT_PUBLIC_ADS_ENABLED` 开关
- **验收**：`ADS_ENABLED=false` 时全站**零**广告 DOM、零外部请求
  （DevTools Network 过滤 `googlesyndication` / `doubleclick` 结果为 0）
  → 已用 jsdom 行为用例 + 静态产物 grep 双向验证（140 个语言页均为 0 个 `<ins>`、0 个脚本标签）

### Step 3 · 接入 3 个版位 ✅ 2026-10-21（P1/P2/P3 全部放量）
- 产出：`ToolPageShell` 接 P1 + P2；首页接 P3；移动端 P4（暂缓，见 §9 #2）
- **ad unit 建表**（名称只是后台标签，不进代码；代码只认 10 位 slot id）：

  | 版位 | AdSense 名称 | **类型（创建后不可改）** | 格式 | 线上 `data-ad-slot` |
  |---|---|---|---|---|
  | P1 | `P1 · 工具页顶栏` | 展示广告 | 自适应 | `8169674524` ✅ |
  | P2 | `P2 · 工具页下方` | 展示广告 | 自适应 | `5623227227` ✅ |
  | P3 | `P3 · 首页正文内嵌` | **文章内嵌 In-article** | 自适应 | `1115724748` ✅ |

  > ⚠️ P3 建错类型（建成「展示广告」）时 `layout="in-article"` 拿不到 fluid 素材，**必须删掉重建**再换 id；
  > 「按网站 → 自动广告」保持**关闭**，否则它会自己插版位、绕过 §2 的预算与导出按钮 96px 约束。
- **验收**：任一工具页广告数 ≤2（桌面）/ ≤3（移动）；**导出按钮 96px 内无任何广告容器**；
  Lighthouse 移动端 **CLS < 0.1**
  → 广告数为 2 / 1 / 0（工具页 / 首页 / 法务页）已用构建产物逐页断言；
    P2 位于工具卡片之外并保留 `mt-24` + 分隔线；P4 未实现所以不存在遮挡风险；
    开广告后的 CLS 仍在真实 ad unit 上跑一次 Lighthouse（Step 5）。
  → **线上全量实测（2026-10-21，`npm run check:ads:live`）**：sitemap 140 页全绿 ——
    首页 10 × P3 `1115724748`（`data-ad-format="fluid"` + `data-ad-layout="in-article"`）、
    工具页 110 × (P1 `8169674524` horizontal + P2 `5623227227` rectangle)、法务页 20 × 0；
    预渲染 HTML 里没有 `pagead2.googlesyndication.com`（脚本按需注入）。
  → **踩过的坑**：P3 首次部署没出来，原因是 CF Pages 变量名末尾多了个空格（`NEXT_PUBLIC_ADS_SLOT_P3 `）——
    界面不报错、`P1/P2` 正常，只有首页静默少一个版位。**改完变量必须 Retry deployment**，
    再用 `npm run check:ads:live` 复核；静态检查 `check:ads` 只读本地 `out/`，看不出线上配置错。

### Step 4 · 合规补齐 ✅ 2026-10-21
- 产出：`/privacy`、`/terms`（至少 en + zh 完整）、页脚链接、`public/ads.txt`、robots 复查
- **验收**：`curl -I https://pdf.reeff.app/ads.txt` → `200`；`curl -I https://reeff.app/ads.txt` → `200`
  （根域那份在 `reeff-home`，两处必须同一 pub id、`text/plain`、无跳转）；
  `/en/privacy` 可访问且含广告 Cookie 说明；`robots.txt` 不屏蔽 `/`（当前已 `allow: "/"` ✅）
  → 实测：两个 `ads.txt` 均 `200 text/plain`、授权行在**第一行**、无跳转；
    工具站 140 个语言页均有页脚隐私链接；根域 `/en/privacy` 200、首页含工具站入口。

### Step 4.5 · GDPR 消息（Funding Choices）✅ 2026-10-21
> 必须性：自 **2024-01-16**（EEA + 英国）、**2024-07-31**（瑞士）起，面向这些地区投放必须使用
> **Google 认证的 CMP**；没有它这些地区的广告请求会被丢弃（甚至不投放）。本站 10 语种、
> de/fr/es/pt 都会带来 EEA 流量，**不能跳过**。

AdSense → **隐私权与消息 → GDPR → 创建消息 / 管理**，实际填值：

| 字段 | 值 | 说明 |
|---|---|---|
| 消息名称 | `GDPR · reeff.app` | 任意 |
| **隐私权政策网址** | `https://pdf.reeff.app/en/privacy` | 实测 `200` 且含 AdSense/Cookie 说明；**不要**用 `/privacy`（302 跳转，Google 要求直达） |
| **徽标** | `public/brand/icon-512.png` | 可选；正方形 PNG/JPG，尺寸/大小上限见界面提示 |
| **语言** | 默认 `English` + 添加 `zh ja ko hi ms es pt de fr` | 非必填但强烈建议：Google 按访客浏览器语言匹配，缺失回退默认语言 |
| 应用网站 | 所有网站 | 子域 `pdf.reeff.app` 一并覆盖（站点登记为根域） |
| 发布 | 必点 | 保存 ≠ 生效；发布后几分钟内上线 |

- 代码侧配合：`NEXT_PUBLIC_ADS_CMP` 保持默认 `google`（`src/lib/ads.ts`）；**生产禁止** `builtin`
  —— 内置 `ConsentBanner` 不是 TCF 认证 CMP。
- **验收**：EEA 节点 + 无痕窗口打开工具页 → 出现同意弹窗；拒绝后 DevTools 里
  `googlesyndication` 请求应显著减少/无个性化广告；同意后广告位出图。
- 可选但推荐：**美国州隐私消息**（CCPA/CPRA），不影响投放，只影响合规覆盖面。

### Step 5 · 灰度上线
- 产出：先只在 2 个高流量工具页开广告 → 观察 1 周 → 全量
- **验收**：AdSense 有曝光；CLS / LCP 未回归；GSC 无异常波动
- 部署后 4 条机器可查的检查（`ADS_TEST=true` 阶段也适用）：

  ```bash
  curl -s https://pdf.reeff.app/en/merge-pdf | grep -o 'data-ad-slot' | wc -l   # 期望 2
  curl -s https://pdf.reeff.app/en            | grep -o 'data-ad-slot' | wc -l   # 期望 1
  curl -s https://pdf.reeff.app/en | grep -c 'pagead2.googlesyndication.com'      # 期望 0（按需注入）
  curl -sI 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4891040014815847' | head -1
  ```
  再加本地两条：`npm run check:ads`（读 `out/`，用与部署同一组 env）
  与 `npm run check:ads:live`（爬线上 sitemap 140 页，抓 CF Pages 配错变量这类**只有线上才看得见**的问题；
  staging 上断言零广告用 `npm run check:ads:live -- <url> --off`）。
- **验收通过后**：删掉 `NEXT_PUBLIC_ADS_TEST` → 再 Retry deployment（否则一直在出测试广告）。

### Step 6 · 观察 4 周 → 会员决策
- **验收**：产出《广告 4 周报告》（PV、曝光、RPM、完成率、CLS），并给出"是否启动会员"的结论

---

## 8. 端到端用例（上线前必须手测）

| # | 用例 | 期望 |
|---|---|---|
| 1 | 任意工具全流程（上传 → 处理 → 导出） | 成功，**无任何次数限制提示** |
| 2 | 每页广告数量 | 桌面 ≤2、移动 ≤3，无第三个内容位 |
| 3 | 导出按钮周边 | 96px 内无广告容器；广告不与其同卡片 |
| 4 | 广告标签 | 每个广告上方有「广告 / Advertisement」 |
| 5 | `NEXT_PUBLIC_ADS_ENABLED=false` | 零广告、零广告请求，工具完全正常 |
| 6 | 开启 AdBlock | 工具完全正常；**不提示**；无空白块（折叠） |
| 7 | EEA 用户首次访问 | 出现 CMP；拒绝后 **无广告请求**（Network 面板验证） |
| 8 | 客户端路由切换（工具 A → 工具 B） | 广告正确重渲染，无"串页 / 空白 / 重复" |
| 9 | 无填充（Ad Manager 测试流量或强制） | 容器折叠，不留灰块，不遮挡内容 |
| 10 | 移动端 anchor | 可关闭；不遮挡导出按钮与正文关键操作 |
| 11 | Lighthouse（移动） | CLS < 0.1；LCP 相对关广告回归 < 10% |
| 12 | `ads.txt` | `https://pdf.reeff.app/ads.txt` 与 `https://reeff.app/ads.txt` → 均 200、含同一授权行、`text/plain` |
| 13 | 根域站点 → 子域放量 | AdSense 站点为 `reeff.app`；审核通过后 `pdf.reeff.app` 能正常出广告（见 Step 1） |

---

## 9. 开放问题

| # | 问题 | 现状 / 建议 |
|---|---|---|
| 1 | GAM 还是 AdSense 起步 | 建议 GAM（控制力强）；若审核太慢，先用 AdSense 上线，后续迁 GAM |
| 2 | 移动端是否保留 P1 | 待 A/B；担心首屏被挤压 → 可只留 P4 |
| 3 | CMP 自建还是 GAM 内置 | 建议 GAM 内置 Funding Choices（免费、合规、零开发） |
| 4 | 是否接第二个广告网络（瀑布流） | 暂不接；先看单一网络的填充率与 RPM |
| 5 | 会员启动时点 | 见 §6.1 门槛，不设死日期 |
| 6 | 广告是否按语言/地区差异化 | 先统一；看 Ad Manager 报表里各语言的 RPM 差异再定 |
| 7 | 站点只能用根域时，子域能不能放量 | 待验证（AdSense 表单拒子域，但 API 的 Site 定义含 subdomain）。审核通过后 24h 内查「网站」/报告；不放量则先重试添加子域 → 联系支持 → 最后才考虑把工具站迁到根域路径 |

---

## 附录 A · v1（配额 + 激励广告 + 会员）可复用设计摘要

> 完整版：`git show 71485da:docs/monetization.md`

- **工具分组**：A 组 9 个开放工具、B 组 `edit` / `organize`；配额桶 9 个
- **额度**：匿名 1 次/工具/天（≤9/天）、注册 3 次/工具/天（≤27/天）、订阅无限
- **服务端原子扣减**（D1 / SQLite 与 Postgres 通用写法）：

```sql
insert into export_quota (user_id, tool_key, day, used)
values (:userId, :toolKey, :day, 1)
on conflict (user_id, tool_key, day)
  do update set used = export_quota.used + 1
  where export_quota.used < :limit
returning used;            -- 无返回行 = 额度已用尽
```

- **匿名计数**：`localStorage['reeff.quota.v1.<toolKey>.<YYYY-MM-DD>']`；
  storage 不可用（隐私模式/配额满）时 **fail-open**（按 used = 0 放行）
- **激励广告**：只在 `rewardedSlotGranted` 时发奖（官方要求广告可见 5 秒），
  `isEmpty` / 超时 **放行**（库存是我们的问题），`rewardedSlotClosed` 后**销毁 slot**，
  同一时刻**只能有一个** rewarded slot
- **导出视图**：必须用内存 store + overlay（`File` 只在浏览器内存，刷新即失效）
- **遮罩**：`inert` + 只覆盖操作区 + SSR 正文原样输出（SEO 不退化）
- **LS 订阅绑定**：结账时传 `checkout_data[custom][user_id]`，webhook 读 `meta.custom_data.user_id`

> **若重启会员**：只取「账号 + 会话 + LS webhook + `AdProvider.enabled=false`」，
> **不要**恢复配额与激励广告 —— v2 已判定为负向体验。


