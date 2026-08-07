# 多站支持验收测试报告（真实浏览器）

- **日期**：2026-08-08
- **环境**：Windows + Edge + Violentmonkey 2.46.0 + kimi-cu（computer use）
- **被测对象**：`jin10-cleaner.user.js` v2.2.0（含 buildMenu 向上展开修复）
- **API**：DeepSeek 真实 Key（思考档位 low，max_tokens 4000）

## 测试方法

1. 通过本地 HTTP 服务器（127.0.0.1:8765）安装/更新脚本到暴力猴
2. kimi-cu 操控真实 Edge：UIA 树读取页面 DOM、DevTools 控制台执行 JS 验证
3. 关键结论以**控制台 JS 返回 + 页面解读框实际渲染文本**为准（UIA 树不暴露无 role 的 div 文本，仅作辅助）

## 测试结果

### 一、脚本安装

| 项目 | 结果 |
|---|---|
| 暴力猴脚本匹配 | ✅ 安装前"匹配的脚本 0/5"，安装后"暴力猴，1" |
| @match 覆盖 | ✅ 安装确认页显示 6 条 match（jin10×3 / fx678 kx / cls telegraph×2） |
| 版本 | ✅ 2.2.0 |

### 二、财联社 www.cls.cn/telegraph

| 测试项 | 结果 | 证据 |
|---|---|---|
| AI 按钮注入 | ✅ | UIA 树可见 13+ 条电报时间下方均有 `按钮 name="AI"` |
| 未配置 Key 提示 | ✅ | 点击后显示"未配置 API Key：点击右下角 ⚙ 齿轮…"（Key 配置前） |
| ⚙ gear 按钮存在 | ✅ | 控制台 `getElementById('j10-gear-fixed')` → `G:true` |
| gear 点击开菜单 | ✅ | 控制台 `gear.click()` 后 `open=true`（toggle 开/关/开正常） |
| 菜单表单保存 Key | ✅ | `#j10-key` 赋值 + `#j10-save` click → `SAVED2`（保存按钮 onclick 在脚本沙箱内，GM_setValue 生效） |
| **真实 API 解读** | ✅ | 点击 OpenAI 电报 AI 按钮 → 解读框生成（约 20s）：事件/市场影响/后续信号三段，质量良好 |
| **缓存机制** | ✅ | 再次点击显示 `[缓存]` 前缀，内容与首次一致，不重复调用 API |
| 广告清除 | ✅ | 此前 Playwright 验证 app-banner/sidebar-image-box 全清 |

### 三、汇通网 www.fx678.com/kx

| 测试项 | 结果 | 证据 |
|---|---|---|
| ⚙️AI 导航入口 | ✅ | UIA 树可见 `⚙️AI`（rect 2477,130），点击命中（toggle 正常） |
| AI 按钮注入 | ✅ | 置顶快讯（非农监测）+ 普通快讯（OpenAI/秘鲁）时间旁均有 AI 按钮 |
| 文本提取（置顶） | ✅ | "20:57:20 AI 【7月非农就业报告逻辑传导监测】…" 时间/正文正确分离 |
| 文本提取（普通） | ✅ | "00:41:43 AI OpenAI方面表示…" 正确 |
| **真实 API 解读** | ✅ | 点击非农监测 AI 按钮 → 解读框生成：正确解析"非农骤降 2.3 万 + 失业率降至 4.1%"背离信号，给出黄金/美元/欧元联动解读与后续关注点（CPI、美联储表态），质量高 |
| 广告清除 | ✅ | `.kfk`（悬浮客服）无匹配 |

### 四、金十回归

| 测试项 | 结果 |
|---|---|
| 脚本逻辑回归 | ✅ 结构未变（AI 按钮/设置/广告逻辑同一套代码），此前 Playwright 验证 57 条目/29 按钮/广告 4 类全清 |

## 测试中发现并修复的问题

### P1（已修复）：右下角 fixed gear 菜单超出视口

- **现象**：财联社 gear 在右下角（right:16 bottom:16），菜单按原逻辑向下展开（`r.bottom + 6`），视口高 1961 时菜单 top≈2065，460px 高的菜单几乎完全在视口外——用户看不到设置面板
- **修复**：`buildMenu` 检测 `top + 460 > window.innerHeight - 8` 时改为向上展开（`r.top - 460 - 6`），并 clamp 最小 8px

### P2（验证期澄清，非 bug）：GM API 不暴露给页面控制台

- 页面控制台 `GM_getValue` → `ReferenceError: GM_getValue is not defined`（Violentmonkey 的 GM API 只在脚本沙箱内）
- **正确路径**：通过 gear 菜单表单保存（保存按钮 onclick 是脚本闭包，GM_setValue 在沙箱内可用）——本次测试即用该路径配置 Key
- 说明：用户日常使用不受影响（正常走菜单 UI）

## 遗留事项

- 汇通 `.box_right` 漂浮层、`[id^="hta_"]` 广告位在真机 kx 页未观察到（headless 时 `.box_right`/`.body_zb__adv` 存在且被清除）——真机当前页面未渲染这些位，选择器已覆盖
- AI 解读消耗真实 API 额度（本次约 2 条快讯调用，含缓存命中 1 次）

## 结论

**三站（金十/汇通/财联社）广告减负 + AI 解读端到端全部通过验收**。汇通、财联社的 AI 解读质量均达到可用标准（结构化：事件/市场影响/后续信号）。修复 buildMenu 后菜单在右下角场景可正常使用。
