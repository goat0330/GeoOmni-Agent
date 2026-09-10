# GeoOmni-Agent Enterprise Overlay v1

适用基线：`goat0330/GeoOmni-Agent`，`master` 当前公开头 `ef6733a`。本包采用**覆盖 + 幂等精确补丁**方式，不重写 Vue 编译包，不拆前后端，不改变现有 4173 单体结构。

## 直接使用

1. 先关闭正在运行的 `node serve.mjs` / `npm start`。
2. 将本 ZIP **全部内容覆盖/复制到 GeoOmni-Agent 仓库根目录**。允许覆盖 `package.json`。
3. 最简单的方式直接执行：

```powershell
npm start
```

`prestart` 会自动、幂等地应用补丁。若想先做完整安装检查再启动，也可以：

```powershell
.\install-enterprise.ps1
npm start
```

另开终端验收：

```powershell
npm run smoke
```

第一次补丁会自动保留：

```text
serve.mjs.pre-enterprise.bak
.enterprise-local.json
```

其中 `.enterprise-local.json` 仅用于保持你当前本机开发环境的既有地图/地形回源能力，已加入 `.gitignore` 和 `.dockerignore`。如果 `serve.mjs` 已经打过本包补丁，再次执行不会重复修改。

## 本轮实际增加的能力

- `SOURCE_ORIGIN`、源环境代理、TLS 校验全部配置化；生产默认不访问原测试环境。
- 首次本地应用补丁时，会把原本写死在 `serve.mjs` 的回源配置迁移到 Git 忽略的 `.enterprise-local.json`；开发模式继续保持原地图回源行为，生产/Docker 不携带这份本地配置。
- `/healthz` 存活探针、`/readyz` 就绪探针。
- `X-Request-Id` 与 JSON 结构化 HTTP 日志。
- Chat 接口按客户端 IP 的基础分钟限流。
- 生产环境 500 错误脱敏，详细错误只进服务端日志。
- `SIGTERM` / `SIGINT` 优雅停机。
- 请求体、HTTP timeout、keep-alive 等运行参数配置化。
- Dockerfile + Docker Compose + Nginx；Nginx 已关闭 SSE buffering，避免 DeepSeek 流式响应被攒成整段。
- Docker 非 root 用户、只读运行文件系统、`no-new-privileges`。
- GitHub Actions：补丁验证、静态审计、真实启动、四路由/API/SSE smoke。

## 完全不动的内容

- `mirror-clean6/` 原 GeoOmni Vue/Cesium 编译资源。
- `index.html` / `native.html` 页面入口。
- `app.js`、`prototype.js`、`prototype.css` 业务/原型逻辑。
- Mock API 数据与既有接口路径。
- 本地 Markdown 检索算法和 DeepSeek SSE 业务协议。
- 4173 作为 Node 应用端口的运行方式。

## 本地启动

`.env` 不是必须的。不开 DeepSeek 时仍保持仓库原有本地演示回答。

要使用 DeepSeek，可以继续使用原来的：

```powershell
.\setup-deepseek.ps1
```

或在 PowerShell 中设置对应 `$env:...` 环境变量。`npm start` 本身不会自动读取 `.env`；`.env` 主要供 Docker Compose 自动读取。不要把真实 Key 写入 Git。

默认生产安全行为：

```text
ALLOW_SOURCE_PROXY=false
SOURCE_ORIGIN=
SOURCE_TLS_VERIFY=true
```

只有在明确授权的内部环境需要地图/地形回源时，再显式配置：

```powershell
$env:ALLOW_SOURCE_PROXY="true"
$env:SOURCE_ORIGIN="https://your-authorized-source"
$env:SOURCE_TLS_VERIFY="true"
```

不建议把 `SOURCE_TLS_VERIFY=false` 用于生产。

## Docker 本地/服务器试部署

先确保当前目录已有完整的 `mirror-clean6/` 等原仓库文件，然后：

```powershell
Copy-Item .env.example .env
# 如需 DeepSeek，仅在本地 .env 中填写 DEEPSEEK_API_KEY；.env 已由原仓库 .gitignore 排除。
docker compose up -d --build
```

访问：

```text
http://127.0.0.1:8080/chat-engine/chatting
```

检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8080/healthz
docker compose ps
docker compose logs -f geo
```

## 服务器 HTTPS

`docker-compose.yml` 默认只提供 HTTP `8080`，便于本机和内网验收。生产公网建议让现有网关/Ingress/Nginx 在外层终止 TLS。`deploy/nginx-https.example.conf` 提供单机 HTTPS 示例，但证书域名和路径必须按真实服务器修改。

不要直接给当前页面强套严格 CSP：`index.html/native.html` 含 inline script，而且 Cesium/原编译包有自己的资源加载方式。当前包只加不会破坏页面的基础响应头。

## 回滚

若只需恢复 `serve.mjs`：

```powershell
.\rollback-enterprise.ps1
```

`package.json` 和新增工程化文件属于覆盖包内容；如需彻底回到 Git 当前版本，可在确认本地改动已备份后使用 Git 恢复。

## 验收标准

`npm run smoke` 会检查：

- `/healthz`
- `/readyz`
- `/chat-engine/chatting`
- `/risk-analysis`
- `/defense-response`
- `/task-track`
- `/api/system/user/getInfo`
- `/api/dizai/online/heartbeat`
- `/api/dizai/ai/agent/chat` 的 SSE 与 `[DONE]`

所有检查通过才视为本包完成基本回归验收。
