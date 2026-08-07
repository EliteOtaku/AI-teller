# Design: 跨页面支持

## 现状

所有选择器硬编码在函数内部（removeAds、addAIButton、addSettings），仅适配 www 首页 DOM。

## 方案

1. 新增 `PAGE_CONFIG` 常量表，key 为 hostname（`www.jin10.com` / `xnews.jin10.com` / `rili.jin10.com`），value 含：
   - `adSelectors: string[]`（广告容器）
   - `itemSelector: string`（快讯/事件条目容器，AI 按钮注入目标）
   - `timeSelector: string`（时间元素，按钮锚点）
   - `navSelector: string`（导航容器，设置入口锚点）
   - `navItemSelector: string`（导航项）
2. `getPageConfig()`：按 `location.hostname` 查找，未命中返回 null → 对应能力静默跳过
3. 函数签名微调：`removeAds(cfg)` / `addAIButton(item, cfg)` / `addSettings(cfg)` 接收配置
4. 保持 ES5 语法与单文件结构

## 风险

- xnews / rili 页面结构未实测，选择器需要真机验证（用 puppeteer 分别加载三个域名 dump DOM）
- 站点改版可能使配置失效——配置表单一数据源便于维护
