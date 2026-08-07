# jin10-cleaner Specification（变更：cross-page-support）

## MODIFIED Requirements

### Requirement: 广告减负（跨页面）

脚本 SHALL 在 `@match` 声明的全部域名（www.jin10.com、xnews.jin10.com、rili.jin10.com）上移除对应页面的推广与广告元素。各页面广告容器选择器按域名配置表分发，未适配的域名可静默跳过广告减负（不得报错）。

#### Scenario: 打开 xnews 快讯页

- **WHEN** 用户加载 https://xnews.jin10.com/
- **THEN** 该页面存在的推广元素被移除，快讯列表完整可用

### Requirement: AI 解读（跨页面）

脚本 SHALL 在全部支持域名上，于每条快讯/事件的时间元素正下方注入 `AI` 按钮。各页面条目容器与时间元素选择器按域名配置表分发。

#### Scenario: xnews 页面点击 AI 按钮

- **WHEN** 用户在 xnews 页面点击某条快讯的 `AI` 按钮
- **THEN** 生成解读并在按钮下方展开（与 www 首页行为一致）

## ADDED Requirements

### Requirement: 选择器按域名分发

脚本 SHALL 将页面相关选择器（广告容器、条目容器、时间元素、导航容器）组织为按域名（hostname）分发的配置表，单一数据源，禁止在逻辑中散落 if/switch 判断。

#### Scenario: 新增域名支持

- **WHEN** 后续新增支持某域名
- **THEN** 只需在配置表中添加一条选择器记录，无需改动功能逻辑
