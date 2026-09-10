# GeoOmni 本地复现：接口契约

来源：2026-09-10 在授权测试环境中观察四个路由的浏览器网络请求。这里只保留路径和用途，不保留 Cookie、令牌、真实响应或业务数据。

## 页面链路

```text
SPA 路由
  ├─ chat-engine       问答、历史、SSE、语音
  ├─ risk-analysis     风险统计、斜坡单元、灾害点、行政区
  ├─ defense-response  预警、响应方案、专家、会商、处置详情
  └─ task-track        事件统计、流程节点、事件列表
       ↓
同源 /api/dizai/* JSON / SSE 服务
       ↓
Cesium 地图、地形和 WMTS 瓦片
```

## 已观察接口

### 公共布局与问答

- `GET /api/system/user/getInfo`
- `GET /api/system/menu/getRouters`
- `GET /api/dizai/ai/agent/chatHistory/list`
- `POST /api/dizai/ai/agent/chat`
- `GET /api/dizai/sse/connect`（EventStream）
- `POST /api/dizai/online/heartbeat`
- `GET /api/dizai/msgNotice/countStat`
- `GET /api/dizai/userAdRegion/{userId}`

### 动态风险

- `GET /api/dizai/riskAssessment/stat`
- `GET /api/dizai/riskAssessment/statChatBanner`
- `GET /api/dizai/riskAssessment/list`
- `GET /api/dizai/riskAssessment/todayTemDynamicRiskList`
- `GET /api/dizai/slopeUnit/list`
- `GET /api/dizai/hazardPoint/list`
- `GET /api/dizai/adRegion/list`
- `GET /api/dizai/autoMode/status`
- `GET /api/dizai/operLog/latest`

### 防御响应

- `GET /api/dizai/dataAlarm/matchList`
- `GET /api/dizai/taskHandle/riskOverview`
- `GET /api/dizai/taskHandleDetail/latest`
- `GET /api/dizai/defRespPlan/tree`
- `GET /api/dizai/defRespPlan/list`
- `GET /api/dizai/defRespPlan/{id}`
- `GET /api/dizai/defRespPlan/childGeoAdvice`
- `GET /api/dizai/role/expert`
- `POST /api/dizai/meeting/getMeetingId/{orgId}/{type}`
- `POST /api/dizai/meeting/getMeetingInfo/{meetingId}`

会商室的本地视图模型固定为四块：`participants`（角色、演示状态、是否选中）、`planDocument`（协同编辑文档）、`townRows`（当前等级、地象建议、最终确认）和 `actions`（刷新、预览、关闭、确认）。本地复现只放角色级演示数据，不写入真实人员姓名、电话、令牌或测试环境响应。

### 事件闭环

- `POST /api/dizai/taskDistList/stat-status`
- `POST /api/dizai/taskDistList/stat-source-type`
- `GET /api/dizai/taskDistList/stat-day`
- `GET /api/dizai/taskProcessChainNode/list/latest-process-node`
- `GET /api/dizai/slopeUnit/list`

## 编译包中发现但未在本次页面操作中触发的能力

- `/api/dizai/oss/upload`
- `/api/tts/stream`
- `/api/geocode/json`
- `/api/dizai/taskHandle/aiModifyReportStream`
- `/api/dizai/taskHandleDetail/generateEvacuationPlan/stream`

这些接口需要后续按具体交互逐个确认，不能仅凭字符串出现就当成已验证功能。
