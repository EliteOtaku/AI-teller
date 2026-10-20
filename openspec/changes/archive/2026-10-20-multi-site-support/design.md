# Design: 多站支持

## 现状

所有选择器硬编码（removeAds / addAIButton / addSettings 内部），仅适配金十。跨站复用需要抽象出按 hostname 分发的配置表。

## 方案

### 1. PAGE_CONFIG 配置表

```js
var PAGE_CONFIGS = {
  'jin10.com': {            // hostname 后缀匹配（www/xnews/rili 共用）
    adCss: [...],
    adSelectors: [...],
    itemSelector: '.jin-flash-item-container[id^="flash"], .jin-flash-item.flash',
    timeSelector: '.item-time',
    flashDropSelectors: '.jin-flash-date-line, .flash-time, .jin-flash-date, .flash-tags, .detail-btn, .share-tools-popover',
    navSelector: '.left-navs .navs-item',
    navAppendMode: 'append',
    gearStyle: 'nav'
  },
  'fx678.com': { ... },     // kx 页
  'cls.cn': { ... }         // telegraph 页
};
```

- key 用 hostname 后缀（`.endsWith('jin10.com')`），子域名共享配置
- `getPageConfig()` 返回当前站点配置或 null（未匹配 → 全部能力静默跳过）

### 2. 能力函数签名

- `removeAds(cfg)`：遍历 `cfg.adSelectors` 移除 + 注入 `cfg.adCss`
- `addAIButton(item, cfg)`：按 `cfg.timeSelector` 锚定插入点，`cfg.flashDropSelectors` 排除非正文元素，`cfg.textIncludeSelector` 可选限定正文来源（无则用整条目文本）
- `addSettings(cfg)`：`cfg.navSelector` 存在 → 挂导航；否则回退 fixed 右下角 ⚙ 按钮（新站通用路径）

### 3. 存储共享

GM 存储沿用 `j10_*` keys（API Key / 开关 / 模型 / 档位全局共享）；缓存 store `j10_ai_cache` 共用（按文本内容，跨站天然去重）。

### 4. 站点差异点

| 站 | 条目 | 时间 | 文本排除 | 导航 |
|---|---|---|---|---|
| 金十 | `.jin-flash-item-container[id^=flash]` | `.item-time` | 时间/标签/按钮 | `.left-navs .navs-item` append |
| 汇通 kx | `li.body_zb_li[id^=newsid]` + `li.inter_content_li[id^=topnewsid]` | `.zb_time a` / `.fb_time` | `.zb_flag/.zb_star/.zb_more/.comment-btn/.history_btn/.kx-quote` | `#nav li` append |
| 财联社 | `.w-894` 内 `div.p-t-20.p-b-20.b-b-w-1` | `span[style*="rgb(222, 4, 34)"]` | 标签行 `.c-b a[href^="/subject/"]`、底部行 `.c-b.f-s-12` | 无 → fixed 按钮 |

### 5. 动态监听

- 金十：现有 body 级 MutationObserver 不变
- 汇通：socket 追加进 `#nowul`，body 级观察同样覆盖
- 财联社：React 渲染进 `.w-894` 容器，body 级观察覆盖；AI 按钮注入防重（按条目 id/唯一标记）

## 风险

- 财联社无语义类名（原子类），选择器脆弱：限定 `.w-894` 作用域降低误命中；`b-b-w-1` 分隔线类随改版可能变化，配置表单一数据源便于修复
- 汇通 kx 页置顶/数据快讯结构不同：条目选择器取并集，文本提取容错（无正文 span 时跳过按钮注入）
- 广告位 ID（`#hta_*`）可能随改版增减：按前缀匹配（`[id^="hta_"]`）并 CSS 层双保险
