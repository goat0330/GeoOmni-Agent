# GeoOmni 地象大模型 · 本地复现

这是基于授权测试环境浏览器可见内容制作的本地复现工程。它包含：

- `index.html`、`styles.css`、`app.js`：本地 UI 和四个主要路由；
- `serve.mjs`：零依赖本地静态服务器、资料库检索和 DeepSeek SSE 代理；
- `knowledge-base.md`：本地问答资料库种子内容，问答会先检索这里再生成回答；
- `setup-deepseek.ps1`：在终端隐藏输入 API Key 并启动本地服务，不把密钥写入前端；
- `mirror-clean6/`：从四个路由收集并脱敏后的前端编译资源、字体、图片和少量地图基础资源；
- `mirror-clean6/asset-manifest.json`：资源清单；
- `api-contracts.md`：脱敏后的接口契约和架构记录；
- `prototype.js`、`prototype.css`：叠加在原始编译包上的本地交互原型层；
- `tools/collect-assets.mjs`：重新采集同源静态资源的脚本。

## 启动

在本目录执行：

```powershell
npm start
```

浏览器访问：

`http://127.0.0.1:4173/chat-engine`

## 接入 DeepSeek 问答

先停止已有的 `npm start` 进程，然后在 PowerShell 执行：

```powershell
.\setup-deepseek.ps1
```

首次运行时脚本会隐藏输入 API Key，并保存到当前 Windows 用户环境变量；后续重新打开终端后直接运行 `npm start` 也会默认读取它。需要更换 Key 时执行 `.\setup-deepseek.ps1 -Reset`。默认模型是 `deepseek-v4-flash`，也可以用 `.\setup-deepseek.ps1 -Model deepseek-v4.1-flash` 切换。

问答请求会先检索 `knowledge-base.md`、`api-contracts.md` 和 `README.md`，再把命中的片段发送给模型；服务端按远端页面使用的 SSE 事件格式增量返回，因此沿用原始前端的检索提示、Markdown 渲染和流式动画。没有配置 Key 时仍会使用本地演示回答，方便先验收 UI。

也可以直接访问 `/risk-analysis`、`/defense-response`、`/task-track`。页面使用本地 Mock API，不会连接测试环境；`/defense-response` 以原始编译包为视觉底座，并叠加一条可演示的本地交互链路：`智能会商 → 人员库 → 会商室 → 加入会议 → 智能纪要 → 发送给责任人`。专家、分管乡长、分管县长等政府侧角色使用脱敏演示数据，设备入会、纪要生成和发送均为浏览器内状态演示，不申请摄像头/麦克风权限，也不调用真实会议或后端接口。

## 继续接真实接口

将 `app.js` 中的 API 请求保留为同路径，再把 `serve.mjs` 的 Mock API 替换为经过授权的后端代理；不要把会话令牌、地图密钥或真实业务响应写进静态文件。

## 边界

镜像的是浏览器获得的编译资源，不是原始 Vue/TypeScript 工程。后端源码、数据库、模型权重和内部业务规则需要项目仓库、部署镜像或后端方提供。
