# Proposal: 跨页面支持（xnews / rili）

## Why

脚本 `@match` 了三个域名（www.jin10.com / xnews.jin10.com / rili.jin10.com），但当前所有功能只在 www 首页验证过。xnews（快讯页）与 rili（日历页）的 DOM 结构、导航结构不同，广告选择器与 `.item-time` 定位很可能失效。用户切换到快讯/日历页时会出现"广告未去除 / AI 按钮缺失"的体验断层。

## What Changes

- 在 xnews.jin10.com 与 rili.jin10.com 上验证并适配：
  - 广告元素选择器（各页面独立容器类名）
  - 快讯/事件条目的时间元素选择器（AI 按钮锚点）
  - 顶部导航结构（设置入口锚点）
- 将页面相关的选择器抽为按域名分发的配置表，避免 if 堆叠
- 兜底策略：某页面不支持的锚点缺失时静默跳过该能力（不报错、不影响其他页面）

## Non-goals

- 不新增对第三个站点的支持
- 不改变现有功能行为（www 首页）

## Success Criteria

- 三个域名下：广告减负生效、AI 按钮出现且点击可用、设置入口可用
- www 首页回归无变化
