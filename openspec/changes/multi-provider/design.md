# Design: 多 LLM 供应商支持

## 现状

`callDeepSeek` 硬编码 DeepSeek 端点、Bearer 鉴权、`thinking:{type,reasoning_effort}` 思考参数、OpenAI 格式响应解析。设置面板只有单一 Key/模型输入。

## 方案

### 1. PROVIDERS 配置表

```js
var PROVIDERS = {
  deepseek:  { name, protocol:'openai',    baseURL:'https://api.deepseek.com',
               models:[...], thinking:'deepseek',  keyHint, keyPlaceholder },
  opencodego:{ name, protocol:'openai',    baseURL:'https://opencode.ai/zen/go/v1',
               models:[...], thinking:'none',      keyHint:'opencode.ai/auth' },
  openai:    { name, protocol:'openai',    baseURL:'https://api.openai.com/v1',
               models:[...], thinking:'openai' },
  anthropic: { name, protocol:'anthropic', baseURL:'https://api.anthropic.com/v1',
               models:[...], thinking:'anthropic' },
  kimi/glm/minimax/mimo: protocol:'openai', thinking:'none'
};
```

### 2. 双协议请求

- **openai**：`POST {baseURL}/chat/completions`，`Authorization: Bearer <key>`，body `{model, messages, max_tokens}`；thinking 按模式附加；响应 `choices[0].message.content`
- **anthropic**：`POST {baseURL}/messages`，`x-api-key` + `anthropic-version: 2023-06-01`，body `{model, max_tokens, system, messages}`；thinking `{type:'enabled', budget_tokens:2048}`；响应取 `content` 数组最后一个 `type==='text'` block（跳过 thinking block）

### 3. 思考参数矩阵

| thinking 模式 | 请求附加 |
|---|---|
| `deepseek` | `thinking:{type:'enabled', reasoning_effort: effort}`（disabled 时 `{type:'disabled'}`） |
| `openai` | `reasoning_effort: effort`（disabled 时不发送 + temperature） |
| `anthropic` | `thinking:{type:'enabled', budget_tokens:2048}` |
| `none` | 不发送思考参数（temperature 0.3） |

### 4. 存储与迁移

- `j10_key_<providerId>`、`j10_model_<providerId>`、`j10_provider`（当前供应商）
- 旧 `j10_apiKey` / `j10_model` 首次运行时迁移为 deepseek 的 key/model，然后清空旧键
- 模型默认取该 provider `models[0]`

### 5. 设置面板

- "LLM 供应商" `<select id="j10-provider">`（8 家）
- 切换时联动：key 标签链接/hint、placeholder、掩码、模型 datalist、模型默认值
- 模型 `<input list="j10-model-list">` + `<datalist>` 按 provider 刷新，可手动输入
- 保存：按当前 provider 写 `j10_key_<id>` / `j10_model_<id>` / `j10_provider`
- 清空 Key：仅清当前 provider

### 6. 缓存键

`j10_ai_cache` 键改为 `provider|model|effort|text`，切换供应商/模型不串缓存。

## 风险

- 厂商 baseURL/模型名可能变更：预设列表集中维护，模型可手动输入兜底
- Anthropic thinking 模式要求 max_tokens 足够（已 4000）；预算 2048 固定
- 某些 OpenAI 兼容厂商对未知参数敏感：thinking:'none' 的供应商不发送思考参数
