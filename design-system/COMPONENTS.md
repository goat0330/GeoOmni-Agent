# GeoOmni Components v1

新功能不要重新发明 Button、Input、Dialog。优先使用以下类名组合。

## Button

```html
<button class="geo-ui-button geo-ui-button--primary">确认</button>
<button class="geo-ui-button">取消</button>
<button class="geo-ui-button geo-ui-button--secondary">编辑</button>
<button class="geo-ui-button geo-ui-button--text">查看详情</button>
```

Variants：`--primary` / `--secondary` / `--text` / `--danger`；Size：`--sm` / default / `--lg`。

## Form

```html
<label class="geo-ui-field">
  <span class="geo-ui-label">附言</span>
  <textarea class="geo-ui-textarea" placeholder="请输入"></textarea>
  <small class="geo-ui-help">辅助说明</small>
</label>
```

同类：`.geo-ui-input` / `.geo-ui-select` / `.geo-ui-checkbox`。

## Dialog

```html
<div class="geo-ui-backdrop">
  <section class="geo-ui-dialog geo-ui-dialog--compact">
    <header class="geo-ui-dialog__header">
      <div class="geo-ui-dialog__heading">
        <h2 class="geo-ui-dialog__title">标题</h2>
        <p class="geo-ui-dialog__subtitle">辅助说明</p>
      </div>
      <button class="geo-ui-dialog__close">×</button>
    </header>
    <div class="geo-ui-dialog__body">...</div>
    <footer class="geo-ui-dialog__footer">...</footer>
  </section>
</div>
```

默认 Dialog 720px；紧凑选择/确认类使用 `--compact` 510px。

## Tabs

```html
<div class="geo-ui-tabs">
  <button class="geo-ui-tab is-active">政府人员</button>
  <button class="geo-ui-tab">专家</button>
</div>
```

## Card / List

```html
<section class="geo-ui-card">
  <header class="geo-ui-card__header">
    <h3 class="geo-ui-card__title">处置建议</h3>
  </header>
  <div class="geo-ui-card__body">...</div>
</section>
```

List 使用 `.geo-ui-list` + `.geo-ui-list-row`。

## Avatar / Tag / Status

```html
<span class="geo-ui-avatar">政</span>
<span class="geo-ui-tag geo-ui-tag--warning">待落实</span>
<span class="geo-ui-status geo-ui-status--online">在线</span>
```

## Recipient Picker Pattern

“发送给责任人”类功能使用：

```text
geo-ui-dialog
└── geo-pattern-recipient-picker
    ├── geo-ui-tabs
    ├── geo-pattern-recipient-list
    │   └── geo-pattern-recipient
    │       ├── geo-ui-checkbox
    │       ├── geo-ui-avatar
    │       ├── recipient content
    │       └── online state
    └── geo-ui-field / geo-ui-textarea
```

完整视觉实现见 `/design-system/examples.html`。
