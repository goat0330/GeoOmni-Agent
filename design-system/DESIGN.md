# GeoOmni Design System v1

这套规范不是重新设计 GeoOmni，而是从当前仓库已经存在的两层 UI 反向提取：

1. 原始 Vue 编译包的 **Element Plus light** 基线；
2. `prototype.css` 中已经稳定使用的 GeoOmni 蓝灰色政务业务视觉。

目标只有一个：后续新增智能纪要、责任人选择、风险研判、Agent Workflow、表单、弹窗等功能时，继续像“同一个产品”，而不是每次由 AI 临时生成一套 UI。

## 1. 设计源优先级

### Foundation：原始编译应用

原始 `mirror-clean6/assets/index-B1RU7MSh.css` 提供 Element Plus 的基础视觉语义：

- 页面/浮层背景：白色；
- 页面浅灰背景：`#f2f3f5`；
- 基础字号：14px；
- 字号层级：12 / 13 / 14 / 16 / 18 / 20px；
- Primary：Element Plus `#409eff`；
- Primary text：`#303133`；
- Regular text：`#606266`；
- Secondary text：`#909399`；
- Border：`#dcdfe6`；
- Fill light：`#f5f7fa`；
- Base radius：4px。

**禁止为了新功能去修改 minified 编译 CSS。**

### Product semantic layer：GeoOmni 自定义功能

`prototype.css` 已经形成一套更适合地象产品业务弹窗的语义层：

- 主操作蓝：`#3561fa`；
- Hover：`#315ce0`；
- 主文字：`#27364a`；
- 正文：`#455165`；
- 辅助文字：`#7f8a9c`；
- 边框：约 `#dde2ea ~ #e3e7ee`；
- 弱背景：`#f4f6f9 / #f5f7fa`；
- 成功状态：约 `#38a168`；
- 控件圆角：6–8px；
- 列表/分区：9–10px；
- Dialog：12px；
- Dialog shadow：`0 16px 48px rgba(39,55,77,.20)`。

这些值已经被提取为 `tokens.css` 的 `--geo-*` 变量。

## 2. UI 语言

GeoOmni 新增业务 UI 默认使用 **浅色、克制、政务行业系统** 视觉：

- 白色 Surface + 浅灰分层，而不是黑色/深灰浮层；
- 蓝色只用于主操作、选中态、链接和轻提示；
- 状态颜色只表达状态，不作为大面积装饰；
- 组件边界依靠 1px 轻边框和有限阴影；
- 不使用大面积毛玻璃、霓虹、渐变按钮、过度发光；
- 不通过 emoji 充当产品功能图标。

除非 PRD 明确要求 Dark Mode，否则 **Modal / Drawer / Form 默认不得使用深色主题**。

## 3. Typography

| 角色 | Token | 建议 |
|---|---|---|
| 辅助/状态 | `--geo-font-size-xs` | 12px / 400 |
| 次级正文 | `--geo-font-size-sm` | 13px / 400 |
| 正文/控件 | `--geo-font-size-md` | 14px / 400–500 |
| 小标题 | `--geo-font-size-lg` | 16px / 600 |
| Dialog 标题 | `--geo-font-size-xl` | 18px / 600 |
| 大标题 | `--geo-font-size-2xl` | 20px / 600 |

字体只使用 `--geo-font-family`。不要在功能 CSS 中重新声明新的 font stack。

## 4. Radius

| 组件 | Token |
|---|---|
| 基础/兼容 | `--geo-radius-xs` = 4px |
| Button / Input | `--geo-radius-sm` = 6px |
| Textarea / Tabs | `--geo-radius-md` = 8px |
| List | `--geo-radius-lg` = 9px |
| Card | `--geo-radius-card` = 10px |
| Dialog | `--geo-radius-dialog` = 12px |

不要新写 14px、16px、18px 等任意圆角。截图中的“大黑底 + 大圆角 Dialog”正是要避免的样式漂移。

## 5. Spacing

以 4px 为基础网格，只使用：4 / 8 / 12 / 16 / 20 / 24 / 28 / 32px。

优先用 `--geo-space-*`，不要在新功能里产生大量 11px、17px、23px 之类不可复用的间距。

## 6. Components

新 UI 先查 `primitives.css`：

- `.geo-ui-button` + variant；
- `.geo-ui-input / .geo-ui-textarea / .geo-ui-select`；
- `.geo-ui-card`；
- `.geo-ui-backdrop + .geo-ui-dialog`；
- `.geo-ui-tabs + .geo-ui-tab`；
- `.geo-ui-list / .geo-ui-list-row`；
- `.geo-ui-avatar`；
- `.geo-ui-tag`；
- `.geo-ui-checkbox`；
- `.geo-ui-status`。

业务组合先查 `patterns.css`：

- `.geo-pattern-recipient-picker`；
- `.geo-pattern-recipient-list / recipient`；
- `.geo-pattern-section`；
- `.geo-pattern-action-bar`。

### Dialog 标准

- Background：white / `--geo-bg-surface`；
- Radius：12px；
- Header：64px 左右；
- Footer：60px 左右；
- 标题：18px / 600；
- 内容区内部间距：20px；
- 主按钮放右侧；
- Backdrop 可使用深色半透明遮罩，但 **Dialog 本身保持 light**。

### Button 标准

- Primary：蓝底白字；
- Secondary：白底 + 蓝/中性边框；
- Text：透明背景；
- 默认 36px 高，紧凑场景 32px；
- 不自行定义字体、圆角、颜色。
- 对比度是硬规则：任何深色或主色背景上的文字必须使用 `--geo-text-on-primary`（白色），禁止继承深色正文色；提交前至少检查默认态和 hover/focus 态的实际文字颜色。
- 如果宿主编译 CSS 覆盖了主按钮文字色，只能在 `theme-bridge.css` 增加组件根节点下的窄作用域兼容规则，不能让深色底黑字进入 Golden Reference。

## 7. Element Plus 与 GeoOmni 的关系

不要全局覆盖：

```css
:root { --el-color-primary: ... }
```

这样会改变原始编译应用已有页面。

正确方式：

- 原始 Vue/Element Plus 页面继续使用 `--el-*`；
- 新增 GeoOmni 功能使用 `--geo-*`；
- `theme-bridge.css` 只做 scoped bridge，不修改全局 Element Plus 变量。

## 8. 新功能 CSS Contract

任何新增 feature stylesheet 第一行应包含：

```css
/* @geo-design-enforce */
```

然后：

1. 颜色必须来自 `--geo-*`；
2. 圆角必须来自 `--geo-radius-*`；
3. 字体必须来自 `--geo-font-family` 或直接继承；
4. 优先组合 primitives/patterns，而不是复制 CSS；
5. 新组件根节点用 `.geo-ui` 或位于 `#geo-smart-prototype` 内；
6. 提交前执行 `npm run design:audit` 和 `npm run design:test`。

## 9. 禁止项

- 不修改 `mirror-clean6/assets/*.js` 或 minified CSS 实现新 UI；
- 不在新组件直接写 raw hex/rgb/hsl 颜色；
- 不直接写新的 `font-family`；
- 不直接写任意 `border-radius: Npx`；
- 不创建第二套 Button/Input/Dialog 基础样式；
- 不默认创建 dark modal；
- 不使用 `!important`，除非在 `theme-bridge.css` 做 legacy compatibility。

## 10. Golden Reference

启动 GeoOmni 后访问：

`/design-system/examples.html`

这是新增 UI 的视觉参考页。Agent 交付新组件前，应与该页面核对字体、颜色、圆角、控件高度、Dialog 和状态表达。
