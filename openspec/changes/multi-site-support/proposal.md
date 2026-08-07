# Proposal: 多站支持（汇通网 / 财联社）

## Why

脚本目前只覆盖金十数据三个域名（www / xnews / rili）。调研确认汇通网快讯页（fx678.com/kx）与财联社电报页（cls.cn/telegraph）与金十定位相近：7x24 快讯流 + 大量广告（汇通）或高价值电报内容（财联社）。用户期望同一套"广告减负 + AI 解读"能力在这些站点上复用。

## What Changes

- 新增 `PAGE_CONFIG` 多站配置表：`www.jin10.com`（现有三个金十域名共用同一配置，key 用 hostname 前缀匹配）→ `www.fx678.com`（kx 页）→ `cls.cn`（telegraph 页）
- 配置项：`adCss` / `adSelectors`（广告）、`itemSelector` / `timeSelector` / `flashDropSelectors` / `textIncludeSelector`（快讯条目与文本提取）、`navSelector` / `navItemSelector` / `navAppendMode`（设置入口；未配置时回退为固定右下角 ⚙ 按钮）
- 设置与 API Key 全局共享（GM 存储沿用现有 `j10_*` keys，跨站共用），缓存 store 共用
- `@match` 增加 `https://www.fx678.com/kx*` 与 `https://www.cls.cn/telegraph*`
- 保持 ES5 语法、单文件结构、金十行为零回归

## Non-goals

- 不改造财联社/汇通非快讯页面（首页、日历、详情页）
- 不解锁任何付费内容（财联社电报、汇通 VIP 不触碰）
- 不做接口级爬取（只操作页面 DOM）

## Success Criteria

- 三站（金十 www、汇通 kx、财联社 telegraph）各自：广告减负生效、AI 按钮出现且点击可用、设置入口可用
- 金十 www 首页回归无变化
- 未匹配域名静默跳过（不报错）
