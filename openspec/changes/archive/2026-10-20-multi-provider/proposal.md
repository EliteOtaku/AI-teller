# Proposal: 多 LLM 供应商支持

## Why

脚本目前仅支持 DeepSeek API（硬编码 `callDeepSeek`）。用户希望接入 OpenAI 与 Anthropic 两家接口，并通过下拉菜单快速切换供应商，兼容 Kimi / GLM / MiniMax / MiMo / OpenCode Go 等常见 LLM 服务。

OpenAI 兼容格式（`/chat/completions` + Bearer）是事实标准，国内厂商（Kimi/GLM/MiniMax/MiMo/DeepSeek 及各类中转）全部提供；Anthropic Messages 格式（`/v1/messages` + x-api-key）单独覆盖 Claude 官方。两种协议即可覆盖绝大多数厂商。

## What Changes

- 新增 `PROVIDERS` 配置表（8 家预设）：DeepSeek / OpenCode Go / OpenAI / Anthropic Claude / Kimi / 智谱 GLM / MiniMax / 小米 MiMo，每家含 `protocol`（openai/anthropic）、`baseURL`、`models` 预设列表、`thinking` 模式、key 提示
- 新增 `callLLM()` 双协议分发器：`callOpenAI`（Bearer + `/chat/completions`）、`callAnthropic`（x-api-key + `anthropic-version` + `/messages`，响应取 content 数组最后一个 text block）
- 思考参数按 provider 模式构造：DeepSeek 的 `thinking:{type,reasoning_effort}` / OpenAI 的 `reasoning_effort` / Anthropic 的 `thinking:{type,budget_tokens}` / 其余不发送
- 设置面板新增"LLM 供应商"下拉，API Key 与模型按 provider 独立存储（`j10_key_<id>` / `j10_model_<id>`），旧存储自动迁移；模型输入支持 datalist 预设 + 手动输入
- 缓存键加入 `provider|model` 前缀，防串缓存
- `@connect` 增加各厂商域名

## Non-goals

- 不做模型列表动态拉取（`/v1/models`），使用预设列表 + 手动输入兜底
- 不支持用户自定义 baseURL（8 家预设已覆盖主流；后续需要可加"自定义"项）

## Success Criteria

- 设置面板可切换 8 家供应商，各自独立保存 Key/模型
- DeepSeek 请求行为与旧版一致（含 thinking 参数）
- OpenAI 兼容协议请求/响应正确；Anthropic 协议请求/响应正确
- 切换供应商后解读使用对应 provider 的 Key 与模型，缓存不串
