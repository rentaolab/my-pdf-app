# 上线验收与 CWV 记录

本文档是 SEO/CWV 改造（commit `0d9781d..dace213`）的上线验收清单与性能记录模板。
每次部署后按第 1、2 节走一遍，把第 3 节的表填上 —— 数据不落地就没有「优化前/后」可言。

## 0. 前置确认

```bash
npm run build            # prebuild = 字典门禁, postbuild = 产物 SEO 审计
```

- 构建输出必须出现两行绿色：`✓ 10 locales, 598 keys each`、`✓ 160 pages audited`。
  任一失败说明 Cloudflare Pages 也不会部署成功，先修本地。
- 本次新增的可选环境变量（不设置则不输出对应 meta 标签）：
  - `NEXT_PUBLIC_GSC_VERIFICATION` → `google-site-verification`
  - `NEXT_PUBLIC_BING_VERIFICATION` → `msvalidate.01`
- 静态导出只改变量不重建无效 —— 改完 CF Pages 的 Variables 必须 Retry deployment。

## 1. 部署后 10 分钟（curl，无浏览器）

```bash
BASE=https://pdf.reeff.app
curl -sI $BASE/ | head -1                                  # 200
curl -sI $BASE/zh/merge-pdf | head -1                       # 200
curl -sI $BASE/de/rotate-pdf/ | grep -iE '^(HTTP|location)'  # 301 → /de/rotate-pdf
curl -sI $BASE/zh/does-not-exist | head -1                  # 404（不是 200 软 404）
curl -sI $BASE/pdf.worker.6.3.289.min.mjs | grep -iE '^(HTTP|cache-control|content-type)'
                                                            # 200 + immutable + javascript
curl -sI $BASE/ | grep -i content-security-policy            # frame-ancestors 'self'
curl -sI $BASE/en/about | head -1                            # 200（介绍页）
curl -sI $BASE/en/how-it-works | head -1                     # 200（工作原理页）
curl -s $BASE/sitemap.xml | grep -c '<loc>'                  # 160
curl -s $BASE/robots.txt | grep -i sitemap                   # 存在
```

worker 请求若返回 404，说明 `public/pdf.worker.*.min.mjs` 没随构建发布 ——
`prebuild` 生成的 `src/lib/pdf-worker-path.ts` 已入库，重新构建即可。

## 2. 人工验收（浏览器，8 项）

| # | 项目 | 步骤 | 通过标准 |
|---|---|---|---|
| 1 | 工具端到端 | 11 个工具各上传一次真实 PDF，走完处理与导出 | 导出文件能打开、页数/顺序正确；`organize`/`edit` 最重，放最后测 |
| 2 | 客户端路由 | 首页 → 工具 A → 工具 B → 首页（只用站内链接） | 无白屏、无 404、滚动位置正常；返回后工具状态干净 |
| 3 | 语言持久化 | 切到 `ja` → 刷新 → 再切到 `de` | 刷新后仍是 `ja`（`NEXT_LOCALE` cookie），切换后 URL 前缀随之变化 |
| 4 | 深链直开 | 新标签直接输入 `/ja/crop-pdf` | 200 且标题、面包屑、FAQ 均为日语 |
| 5 | 尾斜杠 | 输入 `/de/rotate-pdf/` | 301 到无斜杠版本，不出现双斜杠或循环 |
| 6 | worker 预取范围 | DevTools → Network 筛 `pdf.worker`，分别开 `/merge-pdf` 与 `/organize-pdf` | merge 页**无**该请求；organize 页在空闲时以 low priority 拉一次，上传后不再重复请求 |
| 7 | 字体关键路径 | Network 筛 `font` | 首屏只有 1 个 woff2；mono 字体直到出现 `font-mono` 文本（工具区页码）才加载 |
| 8 | 深色系统首帧 | 系统设为深色后硬刷新首页 | 不出现黑色背景一闪再变浅灰（旧版 `prefers-color-scheme` 死代码已移除） |

第 6、7、8 项是本次改动新增的行为，回归时最容易被后续改动破坏，优先测。

## 3. PSI / CrUX 记录模板

每轮记录都追加一个新表格，不要覆盖历史。

代表 URL（覆盖三种页型）：

- `/`（首页，无 pdf.js）
- `/merge-pdf`（pdf-lib 类工具）
- `/organize-pdf`（pdf.js 类工具）

| 日期 | URL | 设备 | 性能分 | LCP | INP | CLS | TBT | FCP | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| 2026-10-31 | `/` | 移动 |  |  |  |  |  |  | 基线 |
| 2026-10-31 | `/merge-pdf` | 移动 |  |  |  |  |  |  | 基线 |
| 2026-10-31 | `/organize-pdf` | 移动 |  |  |  |  |  |  | 基线 |

判定线：LCP ≤ 2.5 s、INP ≤ 200 ms、CLS ≤ 0.1（第 75 百分位）。

注意三点：

1. **PSI 的移动端是"实验室"数据**，广告位填充与否每次不同；同一天连测两次若差很多，
   以 CrUX（Search Console → Core Web Vitals）为准。
2. 广告开启后 P1 版位在工具区上方，是 LCP 的主要竞争者。`AdSlot` 已按尺寸组预留高度
   （CLS 安全）并有 4 s 无填充看门狗，但如果 LCP 明显变差，先怀疑广告而不是工具代码。
3. 本地产物指标只能用来判断"有没有回退"，不能当作线上分数。当前基线
   （`out/zh.html`）：

   | 指标 | 值 | 说明 |
   |---|---|---|
   | HTML 字符数 | 85,501 | 改造前 112,518（−24%），同口径对比 |
   | HTML 字节数 | 94,256 | 中文 3 字节/字，字符数与字节数不可混用 |
   | HTML gzip | 17,276 B | Cloudflare 实际传输量级 |
   | 字体 preload | 1 个 | 改造前 2 个（mono 已移出关键路径） |
   | 首页 JS gzip | 193 KB | 框架基线，页面自身仅多 2 KB |

## 4. Search Console / Bing

1. GSC → 网址检查 → 请求编入索引：`/`、`/merge-pdf`、`/organize-pdf`。
2. GSC → 国际定位 → 确认 10 个 locale 的 hreflang 无「无返回标签」。
   `zh` 的注解现为 `zh-Hans`，URL 前缀仍是 `/zh/`，这是预期行为。
3. Rich Results Test 抽 3 页：`BreadcrumbList` 与 `FAQPage` 都应无错误。
   FAQ 富媒体结果自 2023-08 起只对政府/医疗类站点展示，抓不到 SERP 特型属正常，
   只要无「标记无效」即可。
4. 覆盖率报告：新增页面应在 1–2 周内出现；`_not-found`/`404` 被排除是预期。

## 5. 回归门禁

```bash
npm run check:messages   # 字典：10 语言键位、长度预算、FAQ/useCase 完整性、
                         # 以及 use client 里的 useTranslations 是否都在 CLIENT_NAMESPACES
npm run check:seo        # 产物：title/description/canonical/hreflang/og/JSON-LD/单一 h1/
                         # sitemap 每条 URL 都有 HTML
npm run check            # 两者串跑（需要先 build 出 out/）
```

新增页面或工具时，本节无需改动；但 sitemap 页数期望在
`scripts/check-seo.mjs` 里是 `LOCALES.length * 14`，新增路由要同步改这个数字，
否则会以「sitemap 广告了不存在的 HTML」或「URL 数不符」报出。

## 6. 本次上线实测（2026-10-31，commit `b8dfb19`）

第 1 节的自动断言已全部在线上跑过，结果留存于此作为下次改动的对照基线。

| 断言 | 结果 |
|---|---|
| `/` | 302 → `/en`（locale 协商，预期行为） |
| `/zh/merge-pdf` | 200 |
| `/de/rotate-pdf/` | 301 → `https://pdf.reeff.app/de/rotate-pdf` |
| `/zh/does-not-exist` | 404（硬 404，非软 404） |
| `/pdf.worker.6.3.289.min.mjs` | 200 · `application/javascript` · `max-age=31536000, immutable` |
| CSP / XFO / nosniff / referrer | `frame-ancestors 'self'` / `SAMEORIGIN` / `nosniff` / `strict-origin-when-cross-origin` |
| sitemap | 140 条 `<loc>` |
| robots.txt | `Sitemap: https://pdf.reeff.app/sitemap.xml` |
| 首页传输量 | gzip 15,840 B，TTFB 0.18 s |
| `/zh/merge-pdf` 传输量 | gzip 14,515 B |
| 首页字体 preload | 1 个 |
| worker prefetch | `/zh/organize-pdf` 有，`/zh/merge-pdf` 无（范围正确） |
| `/zh/merge-pdf` 结构化数据 | `BreadcrumbList`、`FAQPage`(5 Q&A)、`SoftwareApplication`+`Offer`、`WebSite` |
| 可见 FAQ | 5 个 `<dt>`，与 JSON-LD 的 5 个 `Question` 一一对应 |
| `<h1>` | 恰好 1 个 |

仍需浏览器完成的部分：第 2 节 8 项人工验收、第 3 节 PSI 数值、第 4 节 GSC 收录状态。

仍需浏览器完成的部分：第 2 节 8 项人工验收、第 3 节 PSI 数值、第 4 节 GSC 收录状态。

## 7. P2-B / P2-C / P2-D 增量的验收（2026-10-31，commit `f8a93cd`）

本轮改动只增加内容与两个页面，不改工具逻辑、不新增请求。断言集中在「少的没少、多的都在」：

```bash
BASE=https://pdf.reeff.app
curl -s $BASE/sitemap.xml | grep -c '<loc>'                       # 160
curl -s $BASE/en/about | grep -o '<h1[^>]*>[^<]*</h1>'            # About these PDF tools
curl -s $BASE/en/how-it-works | grep -c 'Runs locally'            # ≥1（徽章说明）
curl -s $BASE/en/merge-pdf | grep -c 'Runs locally'               # 1（工具页徽章）
curl -s $BASE/en/merge-pdf | grep -o 'href="/en/\(about\|how-it-works\)"' | sort -u   # 两条页脚链接
curl -s $BASE/zh/merge-pdf | grep -c '<dt'                        # 7（4 通用 + 1 工具 + 2 长尾）
```

| 断言 | 结果（2026-10-31 线上实测） |
|---|---|
| `sitemap.xml` `<loc>` 条数 | **160**（10 × 16） |
| `/en/about`、`/en/how-it-works` | **200**；各 1 个 `<h1>`；canonical 自指；11 条 hreflang（10 + x-default） |
| 抽检 5 个语言的两页 | `zh` / `ja` / `hi` / `ms` / `de` 的 about 与 how-it-works 均 **200** |
| 工具页可见 FAQ | `/en/merge-pdf` **7 个 `<dt>` = 7 条 `Question`** |
| 工具页徽章 | `/en/merge-pdf` 有 🟢 `Runs locally`，`/zh/merge-pdf` 显示「本机运行」，`/ja` 无英文残留 |
| 页脚内链 | `/en/merge-pdf` 同时输出 `/en/about` 与 `/en/how-it-works` |
| gzip 体积 | `/en` 16,226 B（§6 基线 15,840，**+386 B**）· `/en/merge-pdf` 13,947 B · `/en/about` 11,683 B · `/en/how-it-works` 12,504 B · `/zh/merge-pdf` 15,215 B |

收尾动作：GSC / Bing 各重提一次 `sitemap.xml`，并在「网页」报告里确认
`/about`、`/how-it-works` 进入「已发现」；两页的 `lastmod` 为 2026-10-31。

> 说明：`lastmod` 已在 `src/app/sitemap.ts` 手工推进到 2026-10-31，不要再被 `new Date()` 覆盖。


### 7.1 hi / ms 校对（2026-10-31）

P2-B/P2-C 新增的印地语与马来语文案是手写的，其余旧文案一并过了一遍。改动只涉及措辞，
键结构不变（`check:messages` 仍是 598 键 × 10 语言）。

| 语言 | 改动 | 原因 |
|---|---|---|
| hi | `पृष्ठ` → `पेज`（99 处） | 同一个词两种写法混用；正文与长尾文案本来就用 `पेज`，用户搜索也是 `पेज` |
| hi | 上传提示改为「चुनें / खींचकर छोड़ें」 | 原文「यहाँ क्लिक करें या खींचकर अपलोड करें」语法不顺，且与「文件不上传」自相矛盾 |
| hi | 删除页提示、裁剪提示、编辑页标题重写 | 悬垂结构、夹带英文括号 |
| hi | `noPagesSelected` 语序调整 | 「पहले समायोजित करने के लिए पेज चुनें」→「पहले वे पेज चुनें जिन्हें समायोजित करना है」 |
| ms | `lakaran` → `pratonton`（缩略图） | `lakaran` 意为「草图」，指代缩略图是误译 |
| ms | `garis panduan` → `garis besar`（大纲） | `garis panduan` 意为「指南/方针」 |
| ms | `cermin` → `cerminkan` | 名词直接当动词用 |
| ms | `margin` → `jidar`、`Tanpa rugi` → `Lossless` | 与同文件其他位置术语统一 |
| ms | `Padam Halaman` / `Ekstrak Halaman` 句首小写 | 与「Susun PDF」「Gabung PDF」等标签统一 |
| ms | 品牌口号补 `di`、`pada` → `kepada` | 语法 |

两条通用规则：

- 「上传」类动词只保留在 FAQ / 隐私页里**说明不会上传**的句子中；按钮与提示改成「选择 / 打开」，
  否则界面一边说「不上传」一边让用户「上传」。
- 缩略图、大纲、边距这类术语，10 语言各定一个说法，后续新增文案照抄表里的词。

