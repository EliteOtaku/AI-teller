# AI-teller

金十数据（jin10.com）增强用户脚本项目。当前成品为 `jin10-cleaner.user.js`（Tampermonkey / Violentmonkey 兼容），提供广告净化与 AI 快讯解读能力。

## Overview

- **目标**：在不触碰任何付费内容的前提下，改善金十数据网站的使用体验（去广告）并提升信息获取效率（AI 解读免费公开快讯）
- **形态**：浏览器用户脚本（单文件，无构建步骤，零依赖）
- **技术栈**：原生 JavaScript（ES5 兼容写法）、GM_* API（GM_xmlhttpRequest / GM_getValue / GM_setValue）、DeepSeek 开放平台 API（OpenAI 兼容协议）
- **当前版本**：2.1.0（2026-08-05）
- **仓库**：https://github.com/EliteOtaku/AI-teller

## Capabilities

| 能力 | 状态 | 说明 |
|---|---|---|
| [jin10-cleaner](specs/jin10-cleaner/spec.md) | 已实现（基线） | 广告减负、AI 解读、设置入口 |

## Tech Notes（踩坑记录，后续开发必读）

1. **站点为 Vue SPA + scoped CSS**：动态注入节点需附加 `data-v-179737e5` 属性才能命中站点 scoped 样式；不可依赖类样式兜底
2. **导航容器 `.jin-nav_pc_left` 有 `overflow: hidden`**：菜单不能挂在导航内（会被裁切不可见），必须挂 `document.body` + `position: fixed` 定位
3. **`<a href="javascript:void(0)">` 会触发 Vue 导航重渲染**：动态入口必须用 `<span>`，否则点击后节点被整棵删除
4. **思考模型 token 预算**：`max_tokens` 必须给足（实测 200 被 reasoning 吃光返回空，脚本用 4000）
5. **滚动容器不是 window**：监听 scroll 需用 capture 阶段（`{capture: true}`）才能捕获内部滚动容器
6. **公开仓库禁止内置 API Key**：`DEFAULT_API_KEY` 置空，用户自行配置

## Conventions

- 脚本保持单文件、ES5 兼容（浏览器用户脚本生态兼容性）
- 所有动态文本用 `textContent`，`innerHTML` 仅拼接固定字符串
- 不解锁任何付费内容（VIP 快讯、会员解读等），此边界不可突破
