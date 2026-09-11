# GeoOmni Meeting Suite Overlay v2

目标底座：`goat0330/GeoOmni-Agent`。制作时对齐主仓库 `master @ 923fc85d306459799be9f87f5ec78aef81a4c27f`，并吸收 `goat0330/GeoOmni-Meeting-Minutes` 已验证的智能纪要能力。

本版按照最终确认流程收束：**不再进入“防御响应方案协同编辑 / 会商结论与响应等级确认”中间页面。**

## 最终流程

```text
防御响应
→ 原生专家库
   → 内嵌必填「会商主题」
   → 邀请 / 连线专家
   → 「确认邀请」
→ 加入会议
   → 摄像头预览
   → 麦克风选择
   → 摄像头选择
→ 应急会商室
   → 顶部「智能纪要」按钮
   → 点击后右侧展开唯一一套智能纪要 Sidebar
→ 结束会议
   → meetingContext + finalMinutes → meetingRecord
→ 历史会议记录
```

### 明确删除的旧链路

```text
专家库 → 进入会商室 → 防御响应方案协同编辑 / 等级确认 → 加入会议
```

本版不会再经过这个中间界面。

## 本版新增 / 调整

### 1. 专家库会前信息

现有 expertsCard 编译组件保持不动，通过极薄扩展层在专家 Tab 上方增加：

```text
会商主题 * [气象预警类区域防御响应会商] [智能纪要] [历史会议]
```

- 「进入会商室」改名为「确认邀请」。
- 「结束会话」改名为「取消」。
- 主题必填并自动预填，可由主持人修改。
- 点击「确认邀请」后直接进入设备选择，不执行原来被砍掉的中间页面。

### 2. 会前智能纪要

专家库中的「智能纪要」直接打开右侧 Sidebar，不增加新页面。

会前只展示：

- 会议概览；
- 会商主题；
- 响应区域；
- 当前响应等级；
- 已邀请人员；
- 风险研判 / 处置建议 / 责任事项空状态。

不会在会议尚未开始时伪造完整纪要。

### 3. 加入会议

「确认邀请」后直接出现加入会议界面：

- 摄像头实时预览；
- 麦克风设备选择；
- 摄像头设备选择；
- 浏览器无权限时可使用占位画面继续演示。

### 4. 应急会商室

点击「加入会议」后进入最终视频会商室。顶部保留：

- 宫格布局 / 右侧人员布局；
- 智能纪要；
- 全屏。

智能纪要**默认关闭**，点击顶部「智能纪要」后在右侧展开。

### 5. 智能纪要定稿

会前和会中只维护**一套**智能纪要组件。会中状态包含：

- 会议概览；
- 风险研判总结；
- 处置建议；
- 责任事项；
- 编辑纪要；
- 发送给责任人。

样式全部基于现有 `/design-system` 的 `--geo-*` Tokens 和 `.geo-ui-*` primitives，不再形成第二套黑色 / 大圆角 / 自定义字体视觉。

### 6. 历史会议

只有点击「结束会议」才自动归档最终会议记录；「离开会议」不会生成一条伪历史记录。

历史页：

```text
http://127.0.0.1:4173/meeting-history
```

包含：主题、时间、时长、主持人、响应区域、响应等级、参会人员、最终风险研判总结、处置建议、责任事项和发送记录。

## 数据链

```text
会商主题 + 已邀请人员
        ↓
meetingContext
        ↓
设备选择
        ↓
应急会商室
        ↓
唯一 Smart Minutes Sidebar
        ↓
finalMinutes
        ↓
结束会议
        ↓
meetingRecord
        ↓
历史会议
```

## 技术边界

不修改：

- `mirror-clean6/**` 编译 Vue / CSS / JS；
- 原 expertsCard 专家列表、搜索、分页和邀请逻辑；
- GeoOmni Design System；
- DeepSeek / RAG；
- Render / Docker / 企业工程化结构。

覆盖层会修改接入文件：

- `index.html`
- `native.html`
- `serve.mjs`
- `package.json`
- `.gitignore`
- `AGENTS.md`

第一次安装前备份到 `.meeting-suite-backup/v2/`。

## 安装

关闭当前服务，将 ZIP **内部内容**覆盖到 `GeoOmni-Agent` 根目录，然后：

```powershell
.\install-meeting-suite.ps1
npm start
```

打开：

```text
http://127.0.0.1:4173/defense-response
```

## 验收

按顺序执行：

```text
1. 打开原生专家库
2. 会商主题存在且必填
3. 邀请至少一位专家
4. 点击「确认邀请」
5. 直接进入「加入会议」设备选择
6. 不出现“协同编辑 / 会商结论与响应等级确认”页面
7. 点击「加入会议」进入应急会商室
8. 智能纪要默认关闭
9. 点击顶部「智能纪要」→ 右侧展开定稿 Sidebar
10. 编辑纪要 / 发送责任人可操作
11. 点击「结束会议」
12. /meeting-history 出现最终记录
```

自动验收：

```powershell
npm run meeting:check
npm run meeting:test
npm run meeting:audit
# npm start 后另开终端
npm run meeting:smoke
npm run design:audit
npm run smoke
```

## v1 升级

如果此前已经覆盖过 Meeting Suite v1，可直接覆盖 v2 后再次执行：

```powershell
.\install-meeting-suite.ps1
```

安装器包含 v1 → v2 幂等升级逻辑。

## 回滚

```powershell
.\rollback-meeting-suite.ps1
```
