# Tasks: 多 LLM 供应商支持

## Task: PROVIDERS 配置表 + 双协议分发器

- **Status:** Done
- **Priority:** High
- **Description:** 新增 8 家供应商配置表；callLLM 按 protocol 分发 callOpenAI / callAnthropic；思考参数按 thinking 模式构造
- **Acceptance Criteria:** deepseek 行为与旧版一致；anthropic 请求走 /messages + x-api-key + anthropic-version；响应解析正确

## Task: 存储迁移 + 设置面板联动

- **Status:** Done
- **Priority:** High
- **Description:** key/model 按 provider 独立存储；旧 j10_apiKey/j10_model 迁移；面板新增 provider 下拉、模型 datalist、联动掩码
- **Acceptance Criteria:** 切换 provider 后 key 掩码/模型列表/占位符联动正确；保存按 provider 落盘

## Task: 缓存隔离 + @connect

- **Status:** Done
- **Priority:** High
- **Description:** 缓存键加 provider|model 前缀；@connect 增加各厂商域名
- **Acceptance Criteria:** 切换供应商后不读旧缓存；GM_xmlhttpRequest 跨域放行

## Task: 验证

- **Status:** Done
- **Priority:** High
- **Description:** Playwright + Edge 注入 GM stub 验证：8 家下拉、切换联动、deepseek 请求 payload、anthropic 请求 payload/响应解析
- **Acceptance Criteria:** 请求 URL/headers/body 与协议规范一致；解读框正常显示

## Task: 文档 + 版本

- **Status:** Done
- **Priority:** Medium
- **Description:** 更新 spec 基线、README、bump 版本号
- **Acceptance Criteria:** 文档同步、版本号更新

## Task: 修复菜单被滚动误关（v3.7.1）

- **Status:** Done
- **Priority:** High
- **Description:** 聚焦 key 输入框时浏览器自动滚动（scrollIntoView）先于 focus 事件触发，menuHasFocus 仍为 false，scroll capture 监听误关菜单。修复：滚动关闭延迟一帧（setTimeout 0）再检查焦点；focusout 用 relatedTarget 判断菜单内焦点切换；新增点击菜单外关闭兜底
- **Acceptance Criteria:** 真机（Edge+暴力猴）验证：切 OpenCode Go → 聚焦 key → 滚动，菜单保持（M=true）；失焦后滚动仍可关闭菜单
