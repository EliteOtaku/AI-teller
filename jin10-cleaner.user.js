// ==UserScript==
// @name         财经快讯净化 + AI 解读（多 LLM）
// @namespace    jin10-cleaner
// @version      3.7.1
// @description  金十数据 / 汇通网 / 财联社：①广告减负（去广告/App推广/悬浮窗）②AI 解读（DeepSeek/OpenCode Go/OpenAI/Claude/Kimi/GLM/MiniMax/MiMo 多供应商切换，点击按钮才调用）。不触碰任何付费内容。
// @match        https://www.jin10.com/*
// @match        https://xnews.jin10.com/*
// @match        https://rili.jin10.com/*
// @match        https://www.fx678.com/kx*
// @match        https://www.cls.cn/telegraph*
// @match        https://cls.cn/telegraph*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.deepseek.com
// @connect      opencode.ai
// @connect      api.openai.com
// @connect      api.anthropic.com
// @connect      api.moonshot.cn
// @connect      open.bigmodel.cn
// @connect      api.minimax.chat
// @connect      api.xiaomimimo.com
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // 配置区
  // ============================================================
  var CONFIG = {
    // 广告减负：默认开启
    removeAds: true,
    // AI 解读：默认开启（点击每条快讯旁的按钮才调用）
    enableAI: true,
    // 当前 LLM 供应商（对应 PROVIDERS 的 key）
    provider: 'deepseek',
    // 模型（默认 deepseek-v4-flash）
    model: 'deepseek-v4-flash',
    // 思考强度：disabled / low / high / max（仅支持思考参数的 provider 生效）
    reasoningEffort: 'low',
    // 单条解读最大输出 token（思考模式会消耗大量 token，必须给足余量）
    maxTokens: 4000,
    // 解读缓存条数上限
    cacheLimit: 300
  };

  // ============================================================
  // LLM 供应商配置表
  // protocol: 'openai'（/chat/completions + Bearer）或 'anthropic'（/v1/messages + x-api-key）
  // thinking: 'deepseek'（thinking:{type,reasoning_effort}）/ 'openai'（reasoning_effort）/
  //           'anthropic'（thinking:{type,budget_tokens}）/ 'none'（不发送思考参数）
  // ============================================================
  var PROVIDERS = {
    deepseek: {
      name: 'DeepSeek', protocol: 'openai', baseURL: 'https://api.deepseek.com',
      keyPlaceholder: 'sk-...', keyHint: 'platform.deepseek.com', thinking: 'deepseek',
      models: ['deepseek-v4-flash', 'deepseek-v4-pro']
    },
    opencodego: {
      name: 'OpenCode Go', protocol: 'openai', baseURL: 'https://opencode.ai/zen/go/v1',
      keyPlaceholder: 'oc-...', keyHint: 'opencode.ai/auth', thinking: 'none',
      models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'kimi-k3', 'kimi-k2.7-code',
        'kimi-k2.6', 'glm-5.2', 'glm-5.1', 'mimo-v2.5', 'mimo-v2.5-pro',
        'minimax-m3', 'minimax-m2.7', 'grok-4.5', 'hy3']
    },
    openai: {
      name: 'OpenAI', protocol: 'openai', baseURL: 'https://api.openai.com/v1',
      keyPlaceholder: 'sk-...', keyHint: 'platform.openai.com', thinking: 'openai',
      models: ['gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini']
    },
    anthropic: {
      name: 'Anthropic Claude', protocol: 'anthropic', baseURL: 'https://api.anthropic.com/v1',
      keyPlaceholder: 'sk-ant-...', keyHint: 'console.anthropic.com', thinking: 'anthropic',
      models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5']
    },
    kimi: {
      name: 'Kimi (Moonshot)', protocol: 'openai', baseURL: 'https://api.moonshot.cn/v1',
      keyPlaceholder: 'sk-...', keyHint: 'platform.moonshot.cn', thinking: 'none',
      models: ['kimi-k2-0711-preview', 'kimi-k2-turbo-preview', 'kimi-latest']
    },
    glm: {
      name: '智谱 GLM', protocol: 'openai', baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      keyPlaceholder: 'id.secret', keyHint: 'open.bigmodel.cn', thinking: 'none',
      models: ['glm-4.6', 'glm-4.5', 'glm-4.5-air']
    },
    minimax: {
      name: 'MiniMax', protocol: 'openai', baseURL: 'https://api.minimax.chat/v1',
      keyPlaceholder: 'eyJ...', keyHint: 'platform.minimaxi.com', thinking: 'none',
      models: ['MiniMax-Text-01', 'MiniMax-M2']
    },
    mimo: {
      name: '小米 MiMo', protocol: 'openai', baseURL: 'https://api.xiaomimimo.com/v1',
      keyPlaceholder: 'sk-...', keyHint: 'platform.xiaomimimo.com', thinking: 'none',
      models: ['MiMo-7B']
    }
  };

  // 内置默认 API Key：仅首次运行时 seed 到 GM 存储（页面 JS 读不到），
  // 之后一律以 GM 存储为准——用户清空即彻底停用，不会回退到内置 key
  var DEFAULT_API_KEY = ''; // 公开仓库版不含 Key：安装后在 ⚙️AI 设置中填入自己的 API Key

  CONFIG.removeAds = GM_getValue('j10_removeAds', true);
  CONFIG.enableAI = GM_getValue('j10_enableAI', true);
  if (GM_getValue('j10_key_seeded', false) !== true) {
    GM_setValue('j10_key_seeded', true);
    if (!GM_getValue('j10_apiKey', '')) {
      GM_setValue('j10_apiKey', DEFAULT_API_KEY);
    }
  }
  // 旧版存储迁移：j10_apiKey / j10_model → 按 provider 独立存储（j10_key_<id> / j10_model_<id>）
  var legacyKey = GM_getValue('j10_apiKey', '');
  if (legacyKey && !GM_getValue('j10_key_deepseek', '')) {
    GM_setValue('j10_key_deepseek', legacyKey);
    GM_setValue('j10_apiKey', '');
  }
  var legacyModel = GM_getValue('j10_model', '');
  if (legacyModel && !GM_getValue('j10_model_deepseek', '')) {
    GM_setValue('j10_model_deepseek', legacyModel);
    GM_setValue('j10_model', '');
  }
  CONFIG.provider = GM_getValue('j10_provider', CONFIG.provider);
  if (!PROVIDERS[CONFIG.provider]) CONFIG.provider = 'deepseek';
  CONFIG.apiKey = GM_getValue('j10_key_' + CONFIG.provider, '') || '';
  CONFIG.model = GM_getValue('j10_model_' + CONFIG.provider, '') ||
    (PROVIDERS[CONFIG.provider].models[0] || CONFIG.model);
  CONFIG.reasoningEffort = GM_getValue('j10_effort', CONFIG.reasoningEffort);

  // ============================================================
  // 多站配置表（key 为 hostname 后缀，子域名共享配置）
  // ============================================================
  var PAGE_CONFIGS = {
    // ---------- 金十数据（www / xnews / rili） ----------
    'jin10.com': {
      // 广告：CSS 层先隐藏，避免闪动
      adCss: [
        '.download-container, .download-bar { display: none !important; }',
        '.qr-slide, .common-nav-slide { display: none !important; }',
        '.desktop-tip { display: none !important; }',
        '.jin-plus-open-dialog, .jin-plus-open-dialog__container { display: none !important; }',
        '.poster, .poster-container, .poster-wrap, [class*="poster-layer"] { display: none !important; }'
      ],
      adSelectors: ['.download-container, .download-bar', '.qr-slide, .common-nav-slide',
        '.desktop-tip', '.jin-plus-open-dialog'],
      // 开屏广告（poster）通过移除 header 属性处理
      hasPosterHeader: true,
      // 快讯条目 / 时间 / 文本提取排除项
      itemSelector: '.jin-flash-item-container[id^="flash"], .jin-flash-item.flash',
      timeSelector: '.item-time',
      flashDropSelectors: '.jin-flash-date-line, .flash-time, .jin-flash-date, .flash-tags, .detail-btn, .share-tools-popover',
      // 设置入口：挂顶部导航（Vue scoped 样式需要复用 data-v-* 属性）
      navSelector: '.left-navs .navs-item',
      gearClass: 'navs-item cnzz-tg is-normal',
      gearAttrs: { 'data-v-179737e5': '' },
      gearInnerClass: 'glass-effect-btn'
    },

    // ---------- 汇通网 7x24 快讯（服务端渲染 + socket 追加） ----------
    'fx678.com': {
      adCss: [
        '.kfk { display: none !important; }',
        '.box_right { display: none !important; }',
        '[id^="hta_"] { display: none !important; }',
        '.body_zb__adv { display: none !important; }'
      ],
      adSelectors: ['.kfk', '.box_right', '[id^="hta_"]', '.body_zb__adv'],
      // 普通快讯 + 置顶快讯
      itemSelector: 'li.body_zb_li[id^="newsid"], li.inter_content_li[id^="topnewsid"]',
      timeSelector: '.zb_time a, .fb_time',
      // 排除时间/国旗/数据指标/市场影响/评论按钮等非正文元素；正文限定在标题链接 span 内
      flashDropSelectors: '.zb_time, .fb_time, .zb_flag, .zb_star, .zb_more, .comment-btn, .history_btn, .kx-quote, .more_end2, .link_img, .fa-caret-right, .fb_content',
      textIncludeSelector: 'a[id^="aid"] span, .top_tit a',
      // 设置入口：挂顶部导航 ul#nav 末尾
      navSelector: '#nav li'
    },

    // ---------- 财联社 7x24 电报（Next.js 客户端渲染，原子类） ----------
    'cls.cn': {
      adCss: [
        '.sidebar-image-box { display: none !important; }',
        'img[src*="app-banner"] { display: none !important; }'
      ],
      adSelectors: ['.sidebar-image-box', 'img[src*="app-banner"]'],
      // 条目：列表容器 .w-894 内以下边框分隔的块（无语义类名，限定作用域防误命中）
      itemSelector: '.w-894 div.p-t-20.p-b-20.b-b-w-1.b-b-s-s.b-c-e6e7ea',
      // 时间：红色粗体内联样式 span
      timeSelector: 'span[style*="rgb(222, 4, 34)"]',
      // 排除时间 span / 话题标签 / 评论 / 分享（含 canvas 海报）/ 底部行
      flashDropSelectors: 'span[style*="rgb(222, 4, 34)"], a[href^="/subject/"], a[href^="/detail/"], .share-box, canvas, .c-b.f-s-12',
      textIncludeSelector: 'div[style*="white-space: pre-wrap"]',
      // 导航不适合挂载 → 回退 fixed ⚙ 按钮（不配置 navSelector）
      useFixedGear: true
    }
  };

  // 按 hostname 后缀匹配站点配置；未匹配返回 null（全部能力静默跳过）
  function getPageConfig() {
    var host = location.hostname;
    for (var key in PAGE_CONFIGS) {
      if (host === key || host.slice(-key.length - 1) === '.' + key) return PAGE_CONFIGS[key];
    }
    return null;
  }

  var SITE = getPageConfig();
  if (!SITE) return; // 未适配站点：完全静默，不注入任何东西

  // ============================================================
  // 一、广告减负
  // ============================================================
  function injectCss() {
    var style = document.createElement('style');
    style.id = 'jin10-cleaner-css';
    style.textContent = SITE.adCss.join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function removeAds() {
    if (!CONFIG.removeAds) return;
    var sels = SITE.adSelectors;
    for (var i = 0; i < sels.length; i++) {
      var els = document.querySelectorAll(sels[i]);
      for (var j = 0; j < els.length; j++) els[j].remove();
    }
    if (SITE.hasPosterHeader) {
      var header = document.querySelector('.jin-header');
      if (header) {
        header.removeAttribute('poster-src');
        header.removeAttribute('poster-link');
        header.setAttribute('poster-id', '0');
      }
    }
  }

  // ============================================================
  // 工具：缓存 / 文本提取
  // ============================================================
  function cacheGet(store, key) {
    try {
      var all = JSON.parse(localStorage.getItem(store) || '{}');
      return all[key] || null;
    } catch (e) { return null; }
  }
  function cacheSet(store, key, val) {
    try {
      var all = JSON.parse(localStorage.getItem(store) || '{}');
      all[key] = val;
      var keys = Object.keys(all);
      if (keys.length > CONFIG.cacheLimit) {
        for (var i = 0; i < keys.length - CONFIG.cacheLimit; i++) delete all[keys[i]];
      }
      localStorage.setItem(store, JSON.stringify(all));
    } catch (e) { /* ignore */ }
  }

  // 提取单条快讯纯文本（排除时间/标签/按钮等非正文元素）
  function extractFlashText(item) {
    var clone = item.cloneNode(true);
    var drop = clone.querySelectorAll(SITE.flashDropSelectors);
    for (var i = 0; i < drop.length; i++) drop[i].remove();
    var text = '';
    if (SITE.textIncludeSelector) {
      // 站点正文结构不统一时，限定取正文元素内第一个非空文本
      var inc = clone.querySelectorAll(SITE.textIncludeSelector);
      for (var j = 0; j < inc.length; j++) {
        var t = (inc[j].textContent || '').replace(/\s+/g, ' ').trim();
        if (t) { text = t; break; }
      }
    } else {
      text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }
    return text.length > 500 ? text.slice(0, 500) + '…' : text;
  }

  // ============================================================
  // 二、AI 解读（DeepSeek，点击按钮才调用）
  // ============================================================
  var AI_BTN = 'j10-ai-btn';
  var AI_BOX = 'j10-ai-box';
  // 按钮两态：默认灰 / 展开高亮（showAIBox 展开时自动切换）
  var BTN_STYLE_NORMAL = 'font-size:10px;font-weight:600;letter-spacing:0.5px;padding:0 5px;height:16px;line-height:14px;border:1px solid #c5c5c5;border-radius:3px;background:#f5f5f5;color:#888;cursor:pointer;margin:2px 0 0;';
  var BTN_STYLE_OPEN = 'font-size:10px;font-weight:600;letter-spacing:0.5px;padding:0 5px;height:16px;line-height:14px;border:1px solid #1677ff;border-radius:3px;background:#1677ff;color:#fff;cursor:pointer;margin:2px 0 0;';

  // 系统提示词（各协议共用）
  var SYSTEM_PROMPT = '你是财经新闻解读助手。用户给你一条财经快讯，请用简体中文给出简明解读（250字以内）：1) 事件是什么；2) 对市场可能的影响（关联品种/资产）；3) 值得关注的后续信号。语气客观，不构成投资建议。';

  // 思考参数按 provider 模式构造：
  // 'deepseek' → thinking:{type,reasoning_effort}；'openai' → reasoning_effort；
  // 'anthropic' → thinking:{type:'enabled',budget_tokens}；'none' → 不发送
  function buildThinking(prov) {
    var effort = CONFIG.reasoningEffort;
    if (effort === 'disabled') return null;
    if (prov.thinking === 'deepseek') {
      return { type: 'enabled', reasoning_effort: effort };
    }
    if (prov.thinking === 'openai') {
      return { reasoning_effort: effort };
    }
    if (prov.thinking === 'anthropic') {
      return { type: 'enabled', budget_tokens: 2048 };
    }
    return null;
  }

  // OpenAI 兼容协议：POST {baseURL}/chat/completions，Authorization: Bearer
  function callOpenAI(prov, prompt, onDone, onError) {
    var payload = {
      model: CONFIG.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      max_tokens: CONFIG.maxTokens
    };
    var thinking = buildThinking(prov);
    if (thinking) {
      if (prov.thinking === 'openai') payload.reasoning_effort = thinking.reasoning_effort;
      else payload.thinking = thinking;
    } else {
      payload.temperature = 0.3;
    }

    GM_xmlhttpRequest({
      method: 'POST',
      url: prov.baseURL + '/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CONFIG.apiKey
      },
      data: JSON.stringify(payload),
      timeout: 90000,
      onload: function (res) {
        try {
          var json = JSON.parse(res.responseText);
          if (json.error) {
            onError((json.error.message || 'API 错误') + '（code: ' + (json.error.code || '?') + '）');
            return;
          }
          if (json.choices && json.choices[0] && json.choices[0].message) {
            onDone((json.choices[0].message.content || '').trim());
          } else {
            onError('API 返回异常');
          }
        } catch (e) { onError('解析响应失败'); }
      },
      onerror: function () { onError('网络请求失败'); },
      ontimeout: function () { onError('请求超时（90s）'); }
    });
  }

  // Anthropic Messages 协议：POST {baseURL}/messages，x-api-key + anthropic-version
  function callAnthropic(prov, prompt, onDone, onError) {
    var messages = [{ role: 'user', content: prompt }];
    var payload = {
      model: CONFIG.model,
      max_tokens: CONFIG.maxTokens,
      system: SYSTEM_PROMPT,
      messages: messages
    };
    var thinking = buildThinking(prov);
    if (thinking) payload.thinking = thinking;

    GM_xmlhttpRequest({
      method: 'POST',
      url: prov.baseURL + '/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.apiKey,
        'anthropic-version': '2023-06-01'
      },
      data: JSON.stringify(payload),
      timeout: 90000,
      onload: function (res) {
        try {
          var json = JSON.parse(res.responseText);
          if (json.error) {
            onError((json.error.message || 'API 错误') + '（code: ' + (json.error.type || '?') + '）');
            return;
          }
          // content 为数组（thinking/text 等 block），取最后一个 text block
          if (json.content && json.content.length) {
            var text = '';
            for (var i = 0; i < json.content.length; i++) {
              if (json.content[i].type === 'text' && json.content[i].text) text = json.content[i].text;
            }
            if (text) { onDone(text.trim()); return; }
          }
          onError('API 返回异常');
        } catch (e) { onError('解析响应失败'); }
      },
      onerror: function () { onError('网络请求失败'); },
      ontimeout: function () { onError('请求超时（90s）'); }
    });
  }

  // 按当前 provider 协议分发
  function callLLM(prompt, onDone, onError) {
    var prov = PROVIDERS[CONFIG.provider] || PROVIDERS.deepseek;
    if (prov.protocol === 'anthropic') callAnthropic(prov, prompt, onDone, onError);
    else callOpenAI(prov, prompt, onDone, onError);
  }

  function addAIButton(item) {
    if (!CONFIG.enableAI) return;
    if (item.querySelector('.' + AI_BTN)) return;
    var text = extractFlashText(item);
    if (text.length < 10) return;

    var wrap = document.createElement('div');
    wrap.className = AI_BTN;
    wrap.style.cssText = 'margin:0;padding:0;display:block;line-height:0;';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'AI';
    btn.title = 'AI 解读本条快讯（再点一次收起）';
    btn.style.cssText = BTN_STYLE_NORMAL;
    btn.onclick = function () {
      // 请求中忽略点击，防重复请求
      if (btn.disabled) return;
      // toggle 关闭：结果框已展开 → 移除并恢复默认样式
      var existing = wrap.querySelector('.' + AI_BOX);
      if (existing) {
        existing.remove();
        btn.style.cssText = BTN_STYLE_NORMAL;
        return;
      }
      if (!CONFIG.apiKey) {
        var provName = (PROVIDERS[CONFIG.provider] || {}).name || CONFIG.provider;
        showAIBox(wrap, '未配置 API Key：点击右下角 ⚙ 齿轮，在设置中为「' + provName + '」填入 API Key。', false);
        return;
      }
      // 缓存键包含 provider + 模型 + 思考档位，切换后不会读到旧结果
      var cacheKey = CONFIG.provider + '|' + CONFIG.model + '|' +
        (CONFIG.reasoningEffort === 'disabled' ? 'off' : CONFIG.reasoningEffort) + '|' + text;
      var cache = cacheGet('j10_ai_cache', cacheKey);
      if (cache) { showAIBox(wrap, cache, true); return; }
      btn.disabled = true;
      btn.textContent = '…';
      callLLM(text, function (result) {
        btn.disabled = false;
        btn.textContent = 'AI';
        cacheSet('j10_ai_cache', cacheKey, result);
        showAIBox(wrap, result, false);
      }, function (err) {
        btn.disabled = false;
        btn.textContent = 'AI';
        showAIBox(wrap, '解读失败：' + err + '（检查 API Key 是否有效、是否欠费）', false);
      });
    };
    wrap.appendChild(btn);
    // 固定在时间正下方：插到时间元素之后紧贴（找不到时间元素则插到条目内容之前）
    var timeEl = item.querySelector(SITE.timeSelector);
    if (timeEl && timeEl.nextSibling) {
      timeEl.parentNode.insertBefore(wrap, timeEl.nextSibling);
    } else if (timeEl) {
      timeEl.parentNode.appendChild(wrap);
    } else {
      item.insertBefore(wrap, item.firstChild.nextSibling || null);
    }
  }

  function showAIBox(wrap, content, fromCache) {
    var old = wrap.querySelector('.' + AI_BOX);
    if (old) old.remove();
    var box = document.createElement('div');
    box.className = AI_BOX;
    box.style.cssText = 'margin-top:6px;padding:10px 12px;border-left:3px solid #1677ff;background:#f0f6ff;border-radius:4px;font-size:13px;line-height:1.7;color:#333;white-space:pre-wrap;';
    box.textContent = (fromCache ? '[缓存] ' : '') + content;
    wrap.appendChild(box);
    // 展开态：按钮高亮，提示再点可收起
    var btn = wrap.querySelector('button');
    if (btn) btn.style.cssText = BTN_STYLE_OPEN;
  }

  // ============================================================
  // 三、设置入口（导航项 ⚙️AI；无导航配置时回退 fixed 右下角按钮）
  // ============================================================
  function toggleMenu(gear) {
    var menu = document.getElementById('j10-menu');
    if (menu) { menu.remove(); return false; }
    buildMenu(gear);
    return true;
  }

  function addSettings() {
    // 幂等：已注入则跳过（SPA 重新渲染导航时由 MutationObserver 重试）
    if (document.getElementById('j10-gear-nav')) return;
    if (document.getElementById('j10-gear-fixed')) return;

    if (SITE.useFixedGear) { addFixedGear(); return; }

    var navs = document.querySelectorAll(SITE.navSelector);
    if (!navs.length) return; // 导航未渲染（窄屏/移动端布局）时静默跳过，等待重试

    // 在导航末尾追加入口，结构与 navs-item 一致，粗体 ⚙️AI
    // 注意：必须用 span 而非 <a href="javascript:void(0)">——金十实测 a 的点击会触发
    // Vue 导航组件重渲染，把入口和菜单整棵删除（表现为菜单闪现后消失）
    var gear = document.createElement('span');
    gear.id = 'j10-gear-nav';
    gear.title = '财经快讯净化设置';
    if (SITE.gearClass) gear.className = SITE.gearClass;
    var attrs = SITE.gearAttrs || {};
    for (var a in attrs) gear.setAttribute(a, attrs[a]);
    // 站点导航多为 scoped 样式，动态节点拿不到类样式，用 inline 兜底布局
    gear.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;';
    var span = document.createElement('span');
    if (SITE.gearInnerClass) span.className = SITE.gearInnerClass;
    for (var a2 in attrs) span.setAttribute(a2, attrs[a2]);
    span.style.cssText = 'display:flex;align-items:center;height:32px;padding:0 12px;font-weight:700;font-size:15px;color:rgba(0,0,0,0.8);';
    span.textContent = '⚙️AI';
    gear.appendChild(span);
    navs[navs.length - 1].parentNode.appendChild(gear);

    gear.onclick = function (e) {
      e.preventDefault();
      var opened = toggleMenu(gear);
      if (opened) gear.classList.add('is-active');
      else gear.classList.remove('is-active');
    };
  }

  // 无导航容器的站点：固定右下角圆形按钮
  function addFixedGear() {
    var gear = document.createElement('div');
    gear.id = 'j10-gear-fixed';
    gear.textContent = '⚙️AI';
    gear.title = '财经快讯净化设置';
    gear.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999999;width:46px;height:46px;line-height:46px;text-align:center;border-radius:50%;background:#1677ff;color:#fff;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.25);';
    gear.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu(gear);
    };
    document.body.appendChild(gear);
  }

  // 构建设置菜单：挂到 document.body 用 fixed 定位（脱离导航容器）
  // 关键：金十导航祖先 .jin-nav_pc_left 有 overflow:hidden，菜单若挂在导航内会被裁切不可见；
  // 挂 body + fixed 定位同时摆脱 Vue 重渲染删除与容器裁切两个问题
  function buildMenu(anchor) {
    var menu = document.createElement('div');
    menu.id = 'j10-menu';
    menu.style.cssText = 'position:fixed;z-index:999999;width:290px;padding:14px;background:#fff;border:1px solid #e5e5e5;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);font-size:13px;color:#333;';
    // 锚定在入口正下方（fixed 定位基于视口坐标）；靠右时 clamp 防溢出视口；
    // 入口贴近视口底部（如右下角 fixed 按钮）时改为向上展开，避免菜单被视口裁切
    var r = anchor.getBoundingClientRect();
    var left = r.left;
    if (left + 290 > window.innerWidth - 8) left = window.innerWidth - 290 - 8;
    var top = r.bottom + 6;
    if (top + 460 > window.innerHeight - 8) {
      top = Math.max(8, r.top - 460 - 6);
    }
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    // 滚动时关闭菜单（防与入口错位；导航若改版为非固定定位时仍可靠）
    // 用 capture 阶段监听：站点的滚动容器可能是内部元素而非 window
    // 焦点保护：用户正在菜单内交互（输入/选择/粘贴）时，滚动不关闭菜单——
    // 否则财联社等实时滚动页面在聚焦输入框/粘贴时菜单会被误关
    var menuHasFocus = false;
    menu.addEventListener('focusin', function () { menuHasFocus = true; });
    menu.addEventListener('focusout', function (e) {
      // 新焦点仍在菜单内（点击菜单内另一元素）时保持 true
      if (e.relatedTarget && menu.contains(e.relatedTarget)) return;
      menuHasFocus = false;
    });
    var closeMenu = function () {
      if (menu.isConnected) {
        menu.remove();
        var g = document.getElementById('j10-gear-nav');
        if (g) g.classList.remove('is-active');
      }
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onDocMouseDown, true);
    };
    var onScroll = function () {
      // 延迟一帧再判断：聚焦输入框触发的浏览器自动滚动（scrollIntoView）
      // 发生在 focus 事件派发之前，立即检查会误判 menuHasFocus=false 而误关菜单；
      // 下一帧时 focusin 已派发，菜单内交互中则跳过关闭
      setTimeout(function () {
        if (menuHasFocus) return;
        closeMenu();
      }, 0);
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    // 点击菜单外部时关闭（弥补焦点保护下滚动关闭的盲区）
    var onDocMouseDown = function (e) {
      if (menu.isConnected && !menu.contains(e.target)) closeMenu();
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    var effortOptions = ['disabled', 'low', 'high', 'max'];
    var effortHtml = '';
    for (var i = 0; i < effortOptions.length; i++) {
      effortHtml += '<option value="' + effortOptions[i] + '"' +
        (CONFIG.reasoningEffort === effortOptions[i] ? ' selected' : '') + '>' +
        (effortOptions[i] === 'disabled' ? '关闭思考（快速）' : effortOptions[i]) + '</option>';
    }
    // LLM 供应商下拉
    var providerHtml = '';
    for (var pid in PROVIDERS) {
      providerHtml += '<option value="' + pid + '"' +
        (CONFIG.provider === pid ? ' selected' : '') + '>' + PROVIDERS[pid].name + '</option>';
    }
    // 模型 datalist（按当前 provider 的预设模型列表）
    var curProv = PROVIDERS[CONFIG.provider] || PROVIDERS.deepseek;
    var modelOptionsHtml = '';
    for (var mi = 0; mi < curProv.models.length; mi++) {
      modelOptionsHtml += '<option value="' + curProv.models[mi] + '">';
    }
    menu.innerHTML =
      '<div style="font-weight:600;margin-bottom:10px;">财经快讯净化设置</div>' +
      '<label style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><input type="checkbox" id="j10-opt-ads"' + (CONFIG.removeAds ? ' checked' : '') + '> 广告减负</label>' +
      '<label style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><input type="checkbox" id="j10-opt-ai"' + (CONFIG.enableAI ? ' checked' : '') + '> AI 解读（点击按钮才调用）</label>' +
      '<div style="margin-bottom:4px;">LLM 供应商：</div>' +
      '<select id="j10-provider" style="width:100%;padding:6px 8px;border:1px solid #d9d9d9;border-radius:4px;margin-bottom:8px;">' + providerHtml + '</select>' +
      '<div id="j10-key-label" style="margin-bottom:6px;">API Key（<a id="j10-key-hint-link" href="https://platform.deepseek.com" target="_blank" style="color:#1677ff;">platform.deepseek.com</a>）：</div>' +
      '<input id="j10-key" type="password" placeholder="sk-..." style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #d9d9d9;border-radius:4px;margin-bottom:8px;">' +
      '<div id="j10-key-mask" style="margin-bottom:8px;color:#999;font-size:12px;"></div>' +
      '<div style="margin-bottom:4px;">模型：</div>' +
      '<input id="j10-model" type="text" list="j10-model-list" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #d9d9d9;border-radius:4px;margin-bottom:8px;">' +
      '<datalist id="j10-model-list">' + modelOptionsHtml + '</datalist>' +
      '<div style="margin-bottom:4px;">思考强度：</div>' +
      '<select id="j10-effort" style="width:100%;padding:6px 8px;border:1px solid #d9d9d9;border-radius:4px;margin-bottom:10px;">' + effortHtml + '</select>' +
      '<div style="display:flex;gap:8px;"><button id="j10-save" style="flex:1;padding:6px;background:#1677ff;color:#fff;border:none;border-radius:4px;cursor:pointer;">保存</button>' +
      '<button id="j10-clear-key" style="flex:1;padding:6px;background:#fff1f0;color:#cf1322;border:1px solid #ffa39e;border-radius:4px;cursor:pointer;">清空 Key</button>' +
      '<button id="j10-close" style="flex:1;padding:6px;background:#fafafa;color:#555;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;">关闭</button></div>' +
      '<div style="margin-top:10px;color:#999;font-size:12px;">说明：广告减负移除推广/弹窗；AI 解读仅针对免费公开快讯，点击按钮才消耗 API 额度。支持 DeepSeek / OpenCode Go / OpenAI / Claude / Kimi / GLM / MiniMax / MiMo，可切换供应商并各自独立保存 API Key。不解锁任何付费内容。</div>';
    document.body.appendChild(menu);

    // 根据当前 provider 更新 Key 标签/占位符/掩码
    function refreshProviderUI() {
      var pid = document.getElementById('j10-provider').value;
      var prov = PROVIDERS[pid] || PROVIDERS.deepseek;
      var key = GM_getValue('j10_key_' + pid, '') || '';
      var model = GM_getValue('j10_model_' + pid, '') || (prov.models[0] || '');
      document.getElementById('j10-key-label').innerHTML = 'API Key（<a id="j10-key-hint-link" href="https://' + prov.keyHint + '" target="_blank" style="color:#1677ff;">' + prov.keyHint + '</a>）：';
      document.getElementById('j10-key').placeholder = prov.keyPlaceholder;
      var keyMask = document.getElementById('j10-key-mask');
      if (key) {
        keyMask.textContent = '当前已配置：' + key.slice(0, 5) + '****' + key.slice(-4);
      } else {
        keyMask.textContent = '未配置 Key，AI 解读不可用';
      }
      // 模型 datalist 更新为当前 provider 的预设
      var opts = '';
      for (var i2 = 0; i2 < prov.models.length; i2++) {
        opts += '<option value="' + prov.models[i2] + '">';
      }
      document.getElementById('j10-model-list').innerHTML = opts;
      document.getElementById('j10-model').value = model;
    }
    refreshProviderUI();
    document.getElementById('j10-provider').onchange = refreshProviderUI;

    // Key 不回显完整值：掩码提示已配置；输入框留空表示保持不变
    var keyMask = document.getElementById('j10-key-mask');
    if (CONFIG.apiKey) {
      keyMask.textContent = '当前已配置：' + CONFIG.apiKey.slice(0, 5) + '****' + CONFIG.apiKey.slice(-4);
    } else {
      keyMask.textContent = '未配置 Key，AI 解读不可用';
    }
    document.getElementById('j10-model').value = CONFIG.model;
    document.getElementById('j10-save').onclick = function () {
      CONFIG.removeAds = document.getElementById('j10-opt-ads').checked;
      CONFIG.enableAI = document.getElementById('j10-opt-ai').checked;
      // provider 切换：加载/保存对应 provider 的 key 与模型
      CONFIG.provider = document.getElementById('j10-provider').value;
      if (!PROVIDERS[CONFIG.provider]) CONFIG.provider = 'deepseek';
      var prov = PROVIDERS[CONFIG.provider] || PROVIDERS.deepseek;
      // 输入框留空表示保持原 key 不变
      var newKey = document.getElementById('j10-key').value.trim();
      if (newKey) CONFIG.apiKey = newKey;
      else CONFIG.apiKey = GM_getValue('j10_key_' + CONFIG.provider, '') || '';
      CONFIG.model = document.getElementById('j10-model').value.trim() ||
        (prov.models[0] || CONFIG.model);
      CONFIG.reasoningEffort = document.getElementById('j10-effort').value;
      GM_setValue('j10_removeAds', CONFIG.removeAds);
      GM_setValue('j10_enableAI', CONFIG.enableAI);
      GM_setValue('j10_provider', CONFIG.provider);
      GM_setValue('j10_key_' + CONFIG.provider, CONFIG.apiKey);
      GM_setValue('j10_model_' + CONFIG.provider, CONFIG.model);
      GM_setValue('j10_effort', CONFIG.reasoningEffort);
      if (!CONFIG.removeAds) {
        var css = document.getElementById('jin10-cleaner-css');
        if (css) css.remove();
      } else {
        injectCss();
      }
      // 关闭 AI 解读时移除所有已注入的按钮，防止旧按钮仍可调用
      if (!CONFIG.enableAI) {
        var oldBtns = document.querySelectorAll('.j10-ai-btn');
        for (var b = 0; b < oldBtns.length; b++) oldBtns[b].remove();
      }
      menu.remove();
      attachToAllFlashes();
    };
    document.getElementById('j10-close').onclick = function () {
      menu.remove();
    };
    // 清空 Key：仅清当前 provider 的 key，立即生效并更新掩码提示
    document.getElementById('j10-clear-key').onclick = function () {
      CONFIG.apiKey = '';
      GM_setValue('j10_key_' + CONFIG.provider, '');
      document.getElementById('j10-key').value = '';
      document.getElementById('j10-key-mask').textContent = '未配置 Key，AI 解读不可用';
    };
  }

  // ============================================================
  // 四、主体：动态监听（快讯列表异步加载 / socket 追加 / React 渲染）
  function attachToAllFlashes() {
    var items = document.querySelectorAll(SITE.itemSelector);
    for (var i = 0; i < items.length; i++) {
      addAIButton(items[i]);
    }
  }

  function init() {
    injectCss();
    removeAds();
    addSettings();
    attachToAllFlashes();

    var pending = false;
    var mo = new MutationObserver(function () {
      // 节流：合并高频 DOM 变化（滚动加载快讯时开销大）
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        removeAds();
        addSettings();
        attachToAllFlashes();
        // 入口被 SPA 重渲染删除时，清理孤儿菜单
        if (!document.getElementById('j10-gear-nav') && !document.getElementById('j10-gear-fixed')) {
          var orphan = document.getElementById('j10-menu');
          if (orphan) orphan.remove();
        }
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
