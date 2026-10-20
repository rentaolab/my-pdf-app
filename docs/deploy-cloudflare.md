# 部署：Cloudflare Pages（pdf.reeff.app）

> 状态：**已部署到 `https://my-pdf-app.pages.dev`**（分支 `feature/cloudflare-migration`，commit `3a189f6`）。
> 目标：把 `pdf.reeff.app` 从 Vercel（Hobby，禁止商用）迁到 Cloudflare Pages 免费额度内的**纯静态**部署。

## 0. 为什么可行（迁移前的事实核对）

| 检查项 | 结果 |
|---|---|
| route handlers / server actions | **无** |
| `cookies()` / `headers()` / `next/headers` | **无** |
| `force-dynamic` / `revalidate` | **无**（仅重建时 `force-static`，见 §1） |
| `next/image`（需要图片优化服务） | **未使用** |
| 服务端逻辑 | 仅 `src/proxy.ts`（语言协商）→ 已由 `functions/_middleware.ts` 接管 |
| 构建产物 | `out/`，787 个文件，最大单文件 0.4 MB，总计 26 MB |
| `next build` with `output: "export"` | ✅ 通过（Turbopack + TypeScript 全绿） |

## 1. 迁移改动（本分支）

| 文件 | 作用 |
|---|---|
| `next.config.ts` | 新增 `output: "export"`；删除 `headers()`（静态导出下无效） |
| `public/_headers` | 接管安全头（`frame-ancestors` 等）与 `_next/static` 一年缓存 |
| `functions/_middleware.ts` | **语言协商 + 尾斜杠 301**，替代 next-intl 中间件 |
| `public/_routes.json` | Function 只在页面路径运行，`/_next/*`、`/brand/*` 直接走静态 |
| `src/app/{sitemap,robots,manifest}.ts` | 加 `export const dynamic = "force-static"`（`output: export` 的硬性要求） |
| `src/proxy.ts` | 保留给 `next dev`；注释说明生产由 Pages Function 负责 |
| `package.json` | 移除 `start`（静态导出无法 `next start`），新增 `preview` |

## 2. 本地命令

```bash
npm run dev       # next dev（走 src/proxy.ts，行为与线上一致）
npm run build     # 生成 out/
npm run preview   # npx wrangler pages dev out —— 静态 + Functions 全真模拟
```

## 3. 首次上线（Cloudflare Dashboard）

1. **Workers & Pages → Create → Pages → Connect to Git**，选 `rentaolab/my-pdf-app`
2. Project name：`my-pdf-app`（决定 `<name>.pages.dev`；当前线上为 `my-pdf-app.pages.dev`）
3. **Production branch**：迁移期填 `feature/cloudflare-migration`（验证通过后再改成 `main`）
4. Build command：`npx next build`；**Build output directory：`out`**
5. 环境变量：**`NODE_VERSION=22`**
   > ⚠️ 必须是 22 或更高。`pdfjs-dist@6` 声明 `engines: node >=22.13.0`，且在模块顶层就求值
   > `Iterator.prototype` 的 polyfill；Node 20 没有全局 `Iterator`，预渲染 `/crop-pdf`、
   > `/organize-pdf`、`/pdf-to-image` 时会直接 `ReferenceError: Iterator is not defined` 并中断构建。
   > 仓库里已放 `.node-version` / `.nvmrc`（均为 `22`），Dashboard 的变量是双保险。
6. **Save and Deploy** → 得到 `https://my-pdf-app.pages.dev`
7. 跑 §5 验收清单 → 绑 `staging.pdf.reeff.app` → 再绑 `pdf.reeff.app`

> 如果 Pages 构建内存不足（大仓库偶发），改用本地构建 + 上传：
> `npm run build && npx wrangler pages deploy out --project-name my-pdf-app`

## 4. 域名与 DNS 切换

| 步骤 | 操作 |
|---|---|
| 1 | Pages 项目 → **Custom domains** → 添加 `staging.pdf.reeff.app` |
| 2 | 若 `reeff.app` 已在同一 Cloudflare 账号：直接一键绑定（自动建 CNAME） |
| 3 | 验证 §5 全绿（**先 staging，不动生产**） |
| 4 | 把 Pages 项目的 Production branch 改为 `main` |
| 5 | 添加 `pdf.reeff.app` → 更新 CNAME 指向 `<project>.pages.dev` |
| 6 | 保留 Vercel 项目 **2 周**（回滚方案：CNAME 改回 `cname.vercel-dns.com`） |
| 7 | 2 周无异常 → 删除 Vercel 项目与 `pdf` 记录 |

> 切 DNS 前把记录的 TTL 调短（Cloudflare 代理记录无手工 TTL，直接切换即可）。

## 5. 验收清单

**已于 2026-10-20 对 `https://my-pdf-app.pages.dev` 全量跑通**（结果见 §5.1）。切 `staging.` / 生产域名后按同一套脚本复跑即可。

```bash
# 语言协商
curl -sI https://staging.pdf.reeff.app/ | head -1                 # 302
curl -sI https://staging.pdf.reeff.app/ | grep -i '^location'    # /en 或 /zh（按 Accept-Language）
curl -sI -H 'Accept-Language: zh-CN' https://staging.pdf.reeff.app/ | grep -i '^location'   # /zh
curl -sI https://staging.pdf.reeff.app/merge-pdf | grep -i '^location'   # /zh/merge-pdf 等带前缀

# 页面与规范形式
curl -sI https://staging.pdf.reeff.app/en/merge-pdf | head -1     # 200
curl -sI https://staging.pdf.reeff.app/en/merge-pdf/ | head -1    # 301 → 无尾斜杠

# 元数据与安全头
curl -s  https://staging.pdf.reeff.app/robots.txt                  # allow: /
curl -s  https://staging.pdf.reeff.app/sitemap.xml | grep -c '<url>'   # 120
curl -sI https://staging.pdf.reeff.app/en | grep -i 'content-security-policy'  # frame-ancestors 'self'
curl -s  https://staging.pdf.reeff.app/en/merge-pdf | grep -o 'rel="canonical" href="[^"]*"'  # https://pdf.reeff.app/...

# 非生产域名必须 noindex（生产域不应出现该头）
curl -sI https://staging.pdf.reeff.app/en | grep -i x-robots-tag   # noindex, nofollow
```

### 5.1 2026-10-20 `my-pdf-app.pages.dev` 实测结果

| 用例 | 结果 |
|---|---|
| `/` + `en-US` / `zh-CN` / `ja-JP` / `ms-MY` | 302 → `/en` `/zh` `/ja` `/ms` ✅ |
| `/merge-pdf` + `ko` | 302 → `/ko/merge-pdf` ✅ |
| `Set-Cookie` | `NEXT_LOCALE=ko; Path=/; Max-Age=31536000; SameSite=Lax` ✅ |
| 9 个抽查页面（含 `edit` / `organize` / `crop` / `pdf-to-image`、`zh`/`ja`/`de`） | 全部 **200** ✅ |
| `/en/merge-pdf/` | **301** → 无尾斜杠 ✅ |
| `/en/not-a-tool` | **404** ✅ |
| `robots.txt` / `sitemap.xml` | 正常 / **120** 条 URL ✅ |
| 安全头 | `frame-ancestors 'self'`、`nosniff`、`SAMEORIGIN`、`strict-origin-when-cross-origin` ✅ |
| canonical / og:image / hreflang | 均指向 `https://pdf.reeff.app/...` ✅ |
| `/_next/static/*` | `public, max-age=31536000, immutable` ✅ |
| `*.pages.dev` 索引状态 | `X-Robots-Tag: noindex, nofollow` ✅（`pdf.reeff.app` 不带此头） |

### 5.2 2026-10-20 11:02 UTC 生产切换 `pdf.reeff.app` 验收结果

| 用例 | 结果 |
|---|---|
| DNS | `2606:4700:3031::ac43:d749` 等 → Cloudflare anycast（不再是 `vercel-dns-017.com`）✅ |
| 证书 | Google Trust Services WE1，`CN=pdf.reeff.app`，11:02:53 签发，2027-01-18 到期 ✅ |
| **`X-Robots-Tag`** | **生产域无此头**；`pages.dev` 与 `staging.` 仍为 `noindex, nofollow` ✅ |
| `<meta name="robots">` | 无残留 noindex ✅ |
| `x-vercel-*` | 已全部消失 ✅ |
| 语言协商 | `en-US→/en` `zh-CN→/zh` `ja-JP→/ja` `ms-MY→/ms` `ko-KR→/ko` ✅ |
| Cookie 优先级 | `Cookie: NEXT_LOCALE=ko` + `Accept-Language: en-US` → `/ko/merge-pdf`（cookie 胜）✅ |
| 无前缀深层页 | `/merge-pdf` + `de` → 302 `/de/merge-pdf` ✅ |
| 11 个工具（en） | 全部 200 ✅ |
| 10 个语言根 | 全部 200 ✅ |
| 未知路径 | 404 且渲染出 404 页 ✅ |
| 尾斜杠 | `/en/merge-pdf/` → 301 `https://pdf.reeff.app/en/merge-pdf` ✅ |
| 安全头 | CSP `frame-ancestors 'self'` / `SAMEORIGIN` / `nosniff` / `strict-origin-when-cross-origin` ✅ |
| sitemap / robots | 120 条 URL / `Allow: /` ✅ |
| 静态资源 | `_next/static/*` → `max-age=31536000, immutable` ✅ |
| RSC payload | `/en/merge-pdf.txt` → 200，内容为 `1:"$Sreact.fragment"` ✅ |
| 缓存行为 | HTML 与 302 均 `cf-cache-status: DYNAMIC` + `max-age=0`（noindex/重定向不会滞留边缘）✅ |
| HTTP→HTTPS | 301 → `https://pdf.reeff.app/en` ✅ |


浏览器手测（**必做**，静态导出对客户端行为最敏感）：

- [ ] 11 个工具全部走通：上传 → 处理 → 导出（`edit` / `organize` 最重）
- [ ] 客户端路由切换（首页 → 工具 A → 工具 B → 首页）无白屏、无 404
- [ ] 语言切换器切到 `ja` 后再刷新，仍是 `ja`（`NEXT_LOCALE` cookie）
- [ ] 刷新深层页 `/ja/crop-pdf` 直接 200（不是 404）
- [ ] 直接输入 `/de/rotate-pdf/`（带尾斜杠）→ 301 → 正常显示
- [ ] 断网/慢网时不出现无限 loading（静态资源 404 监控）

## 6. 已知差异与代价

| 项 | Vercel（迁移前） | Cloudflare Pages（迁移后） |
|---|---|---|
| 语言协商 | next-intl middleware | `functions/_middleware.ts`（同一套规则） |
| 安全头 | `next.config` `headers()` | `public/_headers` |
| 尾斜杠 | Vercel 自动处理 | 显式 301 去除（与 canonical 一致） |
| Analytics | Vercel Analytics | Cloudflare Web Analytics（无 Cookie，免费） |
| 费用 | Hobby **禁止商用** | 免费额度内 **$0**，且允许商用 |

**代价**：`next start` 不再可用；将来若要加"必须联网"的功能（账号、云 OCR），需要另外起 Workers + D1（见 `docs/monetization.md` §6）。

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| **构建环境 Node < 22.13**（最易踩） | 症状：`ReferenceError: Iterator is not defined` + 预渲染失败。对策：`NODE_VERSION=22` + 仓库内 `.node-version`/`.nvmrc`；代码层已改为惰性加载 pdf.js（见 §7.1），即使 Node 20 也能构建 |
| Pages 构建内存/时间超限 | 本地 `npm run build` + `wrangler pages deploy out` |
| 未知 locale 路径（`/xx/merge-pdf`） | 重定向到 `/en/xx/merge-pdf` → 404 页（与迁移前一致） |
| Function 调用量 | `_routes.json` 已排除 `/_next/*`、`/brand/*`；免费额度 10 万次/天 |
| SEO 抖动 | 迁移后立刻重提 sitemap，并在 GSC 观察 2 周；canonical / hreflang 不变 |
| 回滚 | CNAME 改回 `cname.vercel-dns.com`（Vercel 项目保留 2 周） |

### 7.1 为什么 pdf.js 改成惰性加载

`pdfjs-dist@6` 在模块顶层就执行 `Iterator.prototype.join` 的 polyfill 与 worker 路径设置，而**客户端组件在
预渲染时也会被 Node 求值**（SSR 成 HTML）。原来 4 个文件是顶层 `import * as pdfjsLib from 'pdfjs-dist'`：

- `src/lib/pdf-edit.ts`、`src/lib/pdf-to-image.ts`
- `src/components/features/PdfCropTool.tsx`、`src/components/features/PdfOrganizeTool.tsx`

于是构建期的 Node 版本直接决定了构建能否通过。现在统一改为 `src/lib/pdfjs.ts` 的

```ts
const pdfjsLib = await getPdfjs();   // 首次调用才 import('pdfjs-dist')，并顺手设置 workerSrc
```

收益：

1. 构建不再求值 pdf.js → 换 Node 版本不会再炸；`out/` 与服务端 chunk 更小
2. pdf.js（约 400 KB）从首屏 chunk 移到独立异步 chunk，只在真正打开 PDF 时才下载
3. worker 路径只在浏览器里设置一次，不会在 Node 中触发 `GlobalWorkerOptions` 副作用

### 7.2 `_routes.json` 与 Functions 免费额度（100k 请求/天）

橙云代理生效后，**每一次 Pages Functions 调用都计入 Free 档的 100,000 请求/天**，超了直接报错（不是降级）。

静态导出的产物里有 **605 个 `.txt`**（Next.js 的 RSC payload），客户端导航/预取会抓它们；再加上 `sitemap.xml`、
`robots.txt`、各类图标。中间件只有在「路径含 `.`」时才 `context.next()` 透传，所以这些请求**不需要**进 Function，
但没有排除前它们照样消耗额度，单次浏览可能 3–12 次调用。

因此 `public/_routes.json` 排除了它们（`include: ["/*"]` + 扩展名黑名单）。判定方式：

```bash
# 1 = 进了 Function（计费）；0 = 静态直出（不计费）
curl -sI https://staging.pdf.reeff.app/en/merge-pdf.txt | grep -ci x-robots-tag   # 期望 0
curl -sI https://staging.pdf.reeff.app/en                | grep -ci x-robots-tag   # 期望 1
```

> 注意：排除规则只匹配**请求路径**，不影响 Pages 把 `/en` 解析到 `en.html` 的 pretty URL 行为；
> `/en`、`/`、尾斜杠 301、404 仍然全部走 Function（它们需要语言协商与 noindex 改写）。

预算参考：收紧后约 1 次调用/页面浏览 → 免费额度可支撑约 10 万 PV/天；超过后升 Workers Paid（$5/月，含 1000 万请求/月）。

> 调试注意：CF 对 `.txt` 有默认边缘缓存（`max-age=14400`）。若只改了排除规则而同名文件内容没变，ETag 命中会让边缘
> 继续返回**旧响应头**最长 4 小时 —— 用 `curl "$URL/robots.txt?nocache=1"` 绕过缓存即可看到新行为。HTML 是
> `max-age=0`，不会被边缘缓存，所以 `noindex` 这类头不会滞留。



