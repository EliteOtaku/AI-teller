# AI-teller

金十数据（jin10.com）增强用户脚本 + 相关工具。

## 项目内容

### `jin10-cleaner.user.js` — 金十数据净化 + AI 解读（Tampermonkey / Violentmonkey / 油猴）

**功能：**

1. **广告减负**（默认开启）：移除 App 下载推广条、二维码推广、桌面推广弹窗、开通 Plus 弹窗、开屏广告（poster）
2. **AI 解读**（点击快讯旁的 `AI` 按钮才调用）：调用 DeepSeek 大模型为每条免费公开快讯生成解读（事件是什么 / 市场影响 / 后续信号），思考强度可调（disabled / low / high / max）

**设置入口：** 页面顶部导航"数据"按钮右侧的粗体 **⚙️AI**，点击弹出设置面板（广告减负开关、AI 解读开关、API Key、模型、思考强度）。

**安装：**

1. 安装 [Violentmonkey](https://violentmonkey.github.io/) 或 Tampermonkey
2. 将 `jin10-cleaner.user.js` 拖入浏览器（或复制内容 → 新建脚本 → 粘贴 → 保存）
3. 打开 https://www.jin10.com/ 刷新页面
4. 点击顶部导航 **⚙️AI**，在设置中填入自己的 DeepSeek API Key（[platform.deepseek.com](https://platform.deepseek.com) 申请）
5. 在快讯的时间下方点击 **AI** 按钮即可生成解读（点击已展开的解读可收起）

**说明：**

- 本脚本不解锁任何付费内容（VIP 快讯、会员解读等）；AI 解读基于页面免费公开的快讯文本
- 解读按量计费（DeepSeek 开放平台，约 1 厘/条），缓存机制避免重复消耗
- API Key 仅保存在浏览器脚本的本地存储中（GM 存储），不会上传；请勿分享含 Key 的脚本副本

## 技术要点

- 菜单挂载于 `document.body` + `position: fixed` 定位，规避站点导航容器 `overflow: hidden` 裁切与 Vue 重渲染删除
- 动态节点附加 `data-v-*` 属性复用站点 Vue scoped 样式
- 思考模型必须给足 `max_tokens`（实测 200 会被思考 token 吃光预算导致空响应，设为 4000）

## License

MIT
