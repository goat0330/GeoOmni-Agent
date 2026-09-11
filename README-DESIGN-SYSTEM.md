# GeoOmni Design System Overlay v1

适配仓库：`goat0330/GeoOmni-Agent`  
提取基线：`master`（制作时最新提交 `84194255b1bfe65ae95d6e43ca845eb931cc891d`）

本覆盖包不改 Vue 编译包、不改现有业务架构，也不重写已有功能。它把当前仓库已经存在的视觉语言沉淀成一套可复用 Design System，并给 Codex/Agent 增加明确的 UI Contract。

## 会安装什么

- `design-system/tokens.css`：颜色、字体、字号、圆角、间距、阴影、控件高度；
- `design-system/base.css`：Scoped light-mode、字体继承、表单基础行为；
- `design-system/primitives.css`：Button / Input / Textarea / Dialog / Tabs / Card / List / Avatar / Tag / Status；
- `design-system/patterns.css`：责任人选择器、业务 Section、Action Bar；
- `design-system/theme-bridge.css`：与 Element Plus 和现有 `#geo-smart-prototype` 的兼容桥；
- `design-system/examples.html`：可直接打开的 Golden Reference；
- `design-system/DESIGN.md`：给产品、设计、开发、AI Worker 共同使用的规则；
- `design-system/COMPONENTS.md`：基础组件和业务 Pattern 的直接用法；
- `AGENTS.md`：安装器自动创建或追加 Design Contract；
- `.gitignore`：只追加 `.design-system-backup/`，避免本地备份进入 Git；
- `scripts/design-system-audit.mjs`：检查未来新增 CSS 是否绕过 token；
- `tests/design-system.test.mjs`：结构/接入回归测试。

## 安装

把 zip **全部内容覆盖/解压到 GeoOmni-Agent 根目录**，然后在 PowerShell：

```powershell
.\install-design-system.ps1
npm run design:test
npm run design:audit
npm start
```

浏览：

```text
http://127.0.0.1:4173/design-system/examples.html
```

## 安装器会修改的现有文件

仅做小范围、可回滚修改：

- `index.html`：在原始编译 CSS 后加载 `/design-system/index.css`；
- `native.html`：同上；
- `package.json`：追加 `design:apply / design:check / design:audit / design:test`；
- `AGENTS.md`：不存在则创建，存在则追加带 marker 的 Design Contract；
- `.gitignore`：追加 Design System 本地备份忽略项。

首次安装前会备份到 `.design-system-backup/v1/`。重复执行是幂等的。

## 为什么不会再轻易出现“新弹窗突然变黑”

Design System 不修改 `body` 或原始 Element Plus 全局主题，而是把新功能放在 `.geo-ui` / `#geo-smart-prototype` 范围内，并明确：

```css
color-scheme: light;
font-family: var(--geo-font-family);
```

Button/Input/Dialog 等组件自身也都有明确的 light surface、text、border、radius token，因此不再依赖外围旧页面的 dark inheritance。

## 新功能最小写法

```html
<div class="geo-ui">
  <button class="geo-ui-button geo-ui-button--primary">确认</button>
</div>
```

业务弹窗直接组合现有 primitives，而不是从零重新写 CSS。

## 回滚

```powershell
.\rollback-design-system.ps1
```

Design System 新增文件不会自动删除，但原始 `index.html`、`native.html`、`package.json`、`.gitignore`、`AGENTS.md` 会恢复到安装前状态。
