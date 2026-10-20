# 部署：Cloudflare Pages（pdf.reeff.app）

> 状态：迁移进行中（分支 `feature/cloudflare-migration`）。
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
2. Project name：`reeff-pdf`（决定 `<name>.pages.dev`）
3. **Production branch**：迁移期填 `feature/cloudflare-migration`（验证通过后再改成 `main`）
4. Build command：`npx next build`；**Build output directory：`out`**
5. 环境变量：`NODE_VERSION=20`
6. **Save and Deploy** → 得到 `https://reeff-pdf.pages.dev`
7. 跑 §5 验收清单 → 绑 `staging.pdf.reeff.app` → 再绑 `pdf.reeff.app`

> 如果 Pages 构建内存不足（大仓库偶发），改用本地构建 + 上传：
> `npm run build && npx wrangler pages deploy out --project-name reeff-pdf`

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
```

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
| Pages 构建内存/时间超限 | 本地 `npm run build` + `wrangler pages deploy out` |
| 未知 locale 路径（`/xx/merge-pdf`） | 重定向到 `/en/xx/merge-pdf` → 404 页（与迁移前一致） |
| Function 调用量 | `_routes.json` 已排除 `/_next/*`、`/brand/*`；免费额度 10 万次/天 |
| SEO 抖动 | 迁移后立刻重提 sitemap，并在 GSC 观察 2 周；canonical / hreflang 不变 |
| 回滚 | CNAME 改回 `cname.vercel-dns.com`（Vercel 项目保留 2 周） |
