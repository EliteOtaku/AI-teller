# jin10-cleaner Specification

## Purpose

浏览器增强用户脚本：在金十数据（www.jin10.com）、汇通网 7x24 快讯（www.fx678.com/kx）、财联社电报（www.cls.cn/telegraph）上移除推广/广告元素（广告减负），并为每条免费公开快讯提供可选的 DeepSeek AI 解读（AI 解读）。所有能力默认开启但各自独立可关。未匹配的站点完全静默（不注入任何元素、不报错）。

## Requirements

### ADDED Requirement: 多站配置分发

脚本 SHALL 通过 `PAGE_CONFIGS` 配置表按 hostname 后缀匹配站点（`jin10.com` / `fx678.com` / `cls.cn`），每站独立配置：广告选择器与 CSS、快讯条目选择器、时间元素选择器、文本提取排除/限定选择器、设置入口方式（导航挂载或 fixed 按钮回退）。`getPageConfig()` 未命中站点时 SHALL 直接 return，不注入任何能力。

- **设置与存储全局共享**：API Key / 开关 / 模型 / 思考档位共用 `j10_*` GM 存储；AI 解读缓存（`j10_ai_cache`）跨站共用（按文本内容天然去重）
- **边界**：不得触碰付费内容（金十 VIP / 汇通 VIP / 财联社电报付费标记）

#### Scenario: 未适配站点完全静默

- **WHEN** 用户打开未在 `@match` 与配置表中的站点
- **THEN** 页面无任何脚本注入痕迹，控制台无报错

#### Scenario: 汇通网 kx 页三能力可用

- **WHEN** 用户加载 https://www.fx678.com/kx
- **THEN** 广告（`.box_right` 漂浮层、`.body_zb__adv` 快讯流广告、`.kfk` 悬浮客服、`[id^="hta_"]` 广告位）被清除；每条 `li.body_zb_li[id^="newsid"]` / `li.inter_content_li[id^="topnewsid"]` 快讯时间下方出现 AI 按钮且点击可用；顶部导航 `#nav` 末尾出现 ⚙️AI 入口

#### Scenario: 财联社 telegraph 页三能力可用

- **WHEN** 用户加载 https://www.cls.cn/telegraph
- **THEN** 广告（`img[src*="app-banner"]` 推广横幅、`.sidebar-image-box` 悬浮二维码 ×4）被清除；每条电报条目（`.w-894` 内 `div.p-t-20.p-b-20.b-b-w-1`）时间后出现 AI 按钮且点击可用；右下角出现 fixed ⚙️AI 圆形按钮（无导航可挂载）

### ADDED Requirement: 广告减负

脚本 SHALL 移除页面中的推广与广告元素，包括：App 下载推广条（`.download-container`）、二维码推广（`.qr-slide`）、桌面推广弹窗（`.desktop-tip`）、开通 Plus 弹窗（`.jin-plus-open-dialog`）、开屏广告（`jin-header` 的 `poster-*` 属性）。

- **边界**：不得移除或修改正常功能元素（快讯列表、导航、视频弹窗等合法对话框）

#### Scenario: 打开金十首页后推广元素被清除

- **WHEN** 用户加载 https://www.jin10.com/
- **THEN** 上述 4 类推广/弹窗元素在 DOM 中不存在，快讯列表完整可用

### ADDED Requirement: AI 解读（点击触发）

脚本 SHALL 在每条免费公开快讯的时间元素（`.item-time`）正下方注入一个小号 `AI` 按钮（约 21×16px，粗体 10px）。点击按钮 SHALL 调用 DeepSeek API（`https://api.deepseek.com/chat/completions`，模型 `deepseek-v4-flash`）为该快讯生成解读（事件是什么 / 市场影响 / 后续信号），结果在按钮下方展开；再次点击同一按钮 SHALL 收起解读（toggle，展开时按钮高亮为蓝底）。

- **仅点击才调用**：加载页面不得发起任何 API 请求
- **缓存**：解读结果按「快讯文本 + 思考档位」缓存于 localStorage，重复查看不消耗额度
- **思考强度**：支持 disabled / low / high / max 四档（`thinking: {type, reasoning_effort}`），默认 low
- **max_tokens**：4000（思考 token 会吃光小预算导致空响应，见 project.md Tech Notes）
- **防重复**：请求进行中（按钮显示 `…`）忽略点击

#### Scenario: 点击 AI 按钮生成解读

- **WHEN** 用户点击某条快讯时间下方的 `AI` 按钮
- **THEN** 按钮变为 `…`，请求完成（约 2-5 秒）后解读文本显示在按钮下方，按钮高亮

#### Scenario: 再次点击收起解读

- **WHEN** 解读已展开时用户再次点击同一 `AI` 按钮
- **THEN** 解读收起，按钮恢复默认灰底样式

#### Scenario: 未配置 API Key

- **WHEN** 用户点击 `AI` 按钮且设置中无 API Key
- **THEN** 按钮下方提示"未配置 API Key：点击右上角 ⚙️AI 齿轮"，不发起请求

### ADDED Requirement: 设置入口（顶部导航）

脚本 SHALL 在页面顶部导航（`.left-navs`）"数据"链接右侧注入粗体 `⚙️AI` 入口（`<span>`，15px，font-weight 700，与导航项同行等高 52px）。点击 SHALL 在其正下方展开设置面板（`document.body` + `position: fixed`，避开导航容器 `overflow: hidden` 裁切），内容包含：广告减负开关、AI 解读开关、DeepSeek API Key（密码框，掩码回显 `sk-****xxxx`，留空保持原值，可一键清空）、模型输入框、思考强度下拉。

- **滚动时**：菜单自动关闭（capture 阶段 scroll 监听）
- **入口被站点重渲染删除时**：MutationObserver 自动重建入口并清理孤儿菜单

#### Scenario: 打开设置面板修改配置

- **WHEN** 用户点击导航中的 `⚙️AI`
- **THEN** 设置面板在入口正下方展开，修改项保存后立即生效并持久化（GM_setValue）

#### Scenario: 配置持久化与清除

- **WHEN** 用户在设置中点击「清空 Key」
- **THEN** API Key 被清除（GM 存储置空），AI 按钮进入未配置提示态，且不会回退到任何内置 Key

## Requirements Traceability

- 广告减负：金十 4 类元素全部清除；汇通 kx 广告选择器命中即清除；财联社 5 处（横幅 1 + 二维码 4）全部清除（Playwright + Edge headless 实测）
- AI 解读：金十 29/29 快讯按钮注入；汇通 180/204（数据快讯等无正文条目标记跳过）；财联社 20/20 电报按钮注入；真实 API 调用成功（`finish_reason: stop`，单条约 430 token）
- 设置入口：金十/汇通导航注入可用；财联社 fixed 按钮回退可用；菜单可见性、toggle 循环实测通过
