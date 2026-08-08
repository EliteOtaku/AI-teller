# AI-teller

财经快讯增强用户脚本 + 相关工具。支持 **金十数据 / 汇通网 / 财联社** 三站 7x24 快讯流。

## 项目内容

### `jin10-cleaner.user.js` — 财经快讯净化 + AI 解读（Tampermonkey / Violentmonkey / 油猴）

**支持站点：**

| 站点 | 页面 | 广告减负 | AI 解读 | 设置入口 |
|---|---|---|---|---|
| 金十数据 | www.jin10.com（含 xnews 快讯 / rili 日历） | ✅ | ✅ | 顶部导航 ⚙️AI |
| 汇通网 | www.fx678.com/kx（7x24 快讯） | ✅ | ✅ | 顶部导航 ⚙️AI |
| 财联社 | www.cls.cn/telegraph（7x24 电报） | ✅ | ✅ | 右下角 ⚙️AI 按钮 |

**功能：**

1. **广告减负**（默认开启）：按站点分别移除 App 下载推广、二维码推广、悬浮客服、快讯流内嵌广告、开屏广告等
2. **AI 解读**（点击快讯旁的 `AI` 按钮才调用）：调用大模型为每条免费公开快讯生成解读（事件是什么 / 市场影响 / 后续信号），思考强度可调（disabled / low / high / max）。**支持 8 家 LLM 供应商下拉切换**，Key 与模型各自独立保存

**支持的 LLM 供应商：**

| 供应商 | 协议 | 端点 | 模型示例 |
|---|---|---|---|
| DeepSeek | OpenAI 兼容 | api.deepseek.com | deepseek-v4-flash / pro |
| OpenCode Go | OpenAI 兼容 | opencode.ai/zen/go/v1 | deepseek-v4-flash / kimi-k3 / glm-5.2 / mimo-v2.5 / minimax-m3 / grok-4.5 / hy3 等 |
| OpenAI | OpenAI 兼容 | api.openai.com/v1 | gpt-4o / gpt-4.1 / o3-mini |
| Anthropic Claude | Anthropic Messages | api.anthropic.com/v1 | claude-opus-4-6 / sonnet / haiku |
| Kimi (Moonshot) | OpenAI 兼容 | api.moonshot.cn/v1 | kimi-k2 / kimi-latest |
| 智谱 GLM | OpenAI 兼容 | open.bigmodel.cn/api/paas/v4 | glm-4.6 / glm-4.5 |
| MiniMax | OpenAI 兼容 | api.minimax.chat/v1 | MiniMax-Text-01 |
| 小米 MiMo | OpenAI 兼容 | api.xiaomimimo.com/v1 | MiMo-7B |

> 模型列表为预设，可在设置面板手动输入任意模型 ID。

**设置入口：** 金十/汇通为顶部导航粗体 **⚙️AI**，财联社为右下角圆形 **⚙️AI** 按钮，点击弹出设置面板（广告减负开关、AI 解读开关、LLM 供应商下拉、API Key、模型、思考强度）。

**安装：**

1. 安装 [Violentmonkey](https://violentmonkey.github.io/) 或 Tampermonkey
2. 将 `jin10-cleaner.user.js` 拖入浏览器（或复制内容 → 新建脚本 → 粘贴 → 保存）
3. 打开对应站点刷新页面，点击 **⚙️AI**，选择 LLM 供应商，在设置中填入对应的 API Key（如 DeepSeek：[platform.deepseek.com](https://platform.deepseek.com) 申请；OpenCode Go：[opencode.ai/auth](https://opencode.ai/auth) 订阅）
4. 在快讯的时间下方点击 **AI** 按钮即可生成解读（点击已展开的解读可收起）

**说明：**

- 本脚本不解锁任何付费内容（金十 VIP、汇通 VIP、财联社付费电报等）；AI 解读基于页面免费公开的快讯文本
- 解读按量计费（各供应商开放平台），缓存机制避免重复消耗；缓存按供应商/模型隔离，切换不串
- API Key 仅保存在浏览器脚本的本地存储中（GM 存储），各供应商独立保存，不会上传；请勿分享含 Key 的脚本副本

## 技术要点

- 多站架构：`PAGE_CONFIGS` 配置表按 hostname 后缀分发（金十 `jin10.com` / 汇通 `fx678.com` / 财联社 `cls.cn`），每站独立配置广告选择器、条目选择器、时间锚点、文本提取规则与设置入口方式；未匹配站点完全静默
- 多供应商架构：`PROVIDERS` 配置表 + 双协议分发器（OpenAI 兼容 `/chat/completions` + Bearer / Anthropic Messages `/messages` + `x-api-key` + `anthropic-version`）；思考参数按供应商模式构造（DeepSeek `thinking:{type,reasoning_effort}` / OpenAI `reasoning_effort` / Anthropic `thinking:{type,budget_tokens}` / 其余不发送）；Key 与模型按供应商独立存储
- 金十为 Vue SPA（scoped 样式 `data-v-*` 复用）、汇通为服务端渲染 + socket 追加、财联社为 Next.js 客户端渲染（Tailwind 原子类，选择器限定 `.w-894` 作用域防误命中）；三者均由 body 级 MutationObserver 统一兜底
- 菜单挂载于 `document.body` + `position: fixed` 定位，规避站点导航容器 `overflow: hidden` 裁切与前端框架重渲染删除；贴近视口底部时向上展开
- 思考模型必须给足 `max_tokens`（实测 200 会被思考 token 吃光预算导致空响应，设为 4000）

## License

MIT
