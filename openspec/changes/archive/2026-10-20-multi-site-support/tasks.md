# Tasks: 多站支持

## Task: 重构脚本为 PAGE_CONFIG 架构

- **Status:** Done
- **Priority:** High
- **Description:** 建立 PAGE_CONFIGS 配置表 + getPageConfig()；重构 removeAds / addAIButton / addSettings 接收配置；导航缺失时回退 fixed ⚙ 按钮；@match 增加两站
- **Acceptance Criteria:** 金十 www 行为零回归（广告清除、AI 按钮、设置入口均正常）

## Task: 适配汇通网 kx 页

- **Status:** Done
- **Priority:** High
- **Description:** 填充 fx678.com 配置（条目并集选择器、广告 #hta_*/.body_zb__adv/.kfk/.box_right、导航 #nav）
- **Acceptance Criteria:** kx 页广告清除、AI 按钮出现可点击、设置入口可用

## Task: 适配财联社 telegraph 页

- **Status:** Done
- **Priority:** High
- **Description:** 填充 cls.cn 配置（原子类条目选择器、内联样式时间定位、app-banner/sidebar-image-box 广告、fixed 按钮回退）
- **Acceptance Criteria:** telegraph 页广告清除、AI 按钮出现可点击、设置入口可用

## Task: Playwright + Edge 真机验证

- **Status:** Done
- **Priority:** High
- **Description:** 用 Playwright(msedge) 分别加载三站，注入脚本逻辑验证：条目选择器命中数、广告选择器命中数、AI 按钮注入后 DOM 存在
- **Acceptance Criteria:** 三站选择器命中与预期一致，无报错

## Task: 回归 + 文档 + 版本

- **Status:** Done
- **Priority:** Medium
- **Description:** 更新 spec 基线、README（多站说明）、bump 版本号
- **Acceptance Criteria:** 文档同步、版本号更新
