# Tasks: 跨页面支持

## Task: 调研 xnews / rili 页面结构

- **Status:** Todo
- **Priority:** High
- **Description:** 用 puppeteer（Edge，1080P/4K）分别加载 xnews.jin10.com 与 rili.jin10.com，dump：广告元素选择器、条目容器、时间元素、导航容器
- **Acceptance Criteria:** 输出两个页面的选择器清单，与 www 对比差异表

## Task: 抽取 PAGE_CONFIG 配置表

- **Status:** Todo
- **Priority:** High
- **Description:** 按 design.md 方案建立按域名分发的配置表，重构 removeAds / addAIButton / addSettings 接收配置
- **Acceptance Criteria:** www 首页行为零回归（广告清除、AI 按钮、设置入口均正常）

## Task: 适配 xnews 页面

- **Status:** Todo
- **Priority:** Medium
- **Description:** 依据调研结果填充 xnews 配置，真机验证广告减负 + AI 按钮 + 设置入口
- **Acceptance Criteria:** xnews 页三类能力全部可用

## Task: 适配 rili 页面

- **Status:** Todo
- **Priority:** Medium
- **Description:** 依据调研结果填充 rili 配置，真机验证
- **Acceptance Criteria:** rili 页三类能力全部可用（日历条目语义与快讯不同，AI 解读 prompt 可按页面类型微调）

## Task: 回归 + 发布

- **Status:** Todo
- **Priority:** Medium
- **Description:** 三个域名全量回归；更新 spec 基线；bump 版本号；推送到 GitHub（公开版保持无 Key）
- **Acceptance Criteria:** 三个域名验证通过，specs 基线同步，推送成功
