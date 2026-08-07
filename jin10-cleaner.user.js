// ==UserScript==
// @name         金十数据净化 + AI 解读（DeepSeek）
// @namespace    jin10-cleaner
// @version      2.1.0
// @description  金十数据：①广告减负（去广告/App推广/开通弹窗）②AI 解读（DeepSeek，点击按钮才调用，思考强度可调）。不触碰任何付费内容。
// @match        https://www.jin10.com/*
// @match        https://xnews.jin10.com/*
// @match        https://rili.jin10.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.deepseek.com
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
    // 模型（官方：deepseek-v4-flash / deepseek-v4-pro）
    model: 'deepseek-v4-flash',
    // 思考强度：disabled / low / high / max（flash 支持三档，默认 low 足够）
    reasoningEffort: 'low',
    // 单条解读最大输出 token（思考模式会消耗大量 token，必须给足余量）
    maxTokens: 4000,
    // 解读缓存条数上限
    cacheLimit: 300
  };

  // 内置默认 API Key：仅首次运行时 seed 到 GM 存储（页面 JS 读不到），
  // 之后一律以 GM 存储为准——用户清空即彻底停用，不会回退到内置 key
  var DEFAULT_API_KEY = ''; // 公开仓库版不含 Key：安装后在 ⚙️AI 设置中填入自己的 DeepSeek API Key

  CONFIG.removeAds = GM_getValue('j10_removeAds', true);
  CONFIG.enableAI = GM_getValue('j10_enableAI', true);
  if (GM_getValue('j10_key_seeded', false) !== true) {
    GM_setValue('j10_key_seeded', true);
    if (!GM_getValue('j10_apiKey', '')) {
      GM_setValue('j10_apiKey', DEFAULT_API_KEY);
    }
  }
  CONFIG.apiKey = GM_getValue('j10_apiKey', '') || '';
  CONFIG.model = GM_getValue('j10_model', CONFIG.model);
  CONFIG.reasoningEffort = GM_getValue('j10_effort', CONFIG.reasoningEffort);

  // ============================================================
  // 一、广告减负（CSS 层先隐藏，避免闪动）
  // ============================================================
  var AD_CSS = [
    '.download-container, .download-bar { display: none !important; }',
    '.qr-slide, .common-nav-slide { display: none !important; }',
    '.desktop-tip { display: none !important; }',
    '.jin-plus-open-dialog, .jin-plus-open-dialog__container { display: none !important; }',
    '.poster, .poster-container, .poster-wrap, [class*="poster-layer"] { display: none !important; }'
  ].join('\n');

  function injectCss() {
    var style = document.createElement('style');
    style.id = 'jin10-cleaner-css';
    style.textContent = AD_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function removeAds() {
    if (!CONFIG.removeAds) return;
    var sels = ['.download-container, .download-bar', '.qr-slide, .common-nav-slide',
      '.desktop-tip', '.jin-plus-open-dialog'];
    for (var i = 0; i < sels.length; i++) {
      var els = document.querySelectorAll(sels[i]);
      for (var j = 0; j < els.length; j++) els[j].remove();
    }
    var header = document.querySelector('.jin-header');
    if (header) {
      header.removeAttribute('poster-src');
      header.removeAttribute('poster-link');
      header.setAttribute('poster-id', '0');
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

  // 提取单条快讯纯文本（排除时间/标签/按钮）
  function extractFlashText(item) {
    var clone = item.cloneNode(true);
    var drop = clone.querySelectorAll('.jin-flash-date-line, .flash-time, .jin-flash-date, .flash-tags, .detail-btn, .share-tools-popover, .j10-ai-btn, .j10-ai-box');
    for (var i = 0; i < drop.length; i++) drop[i].remove();
    var text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
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

  // 思考模式参数：disabled 时关闭思考；否则启用并指定档位
  function thinkingParam(effort) {
    if (effort === 'disabled') return { type: 'disabled' };
    return { type: 'enabled', reasoning_effort: effort || 'low' };
  }

  function callDeepSeek(prompt, onDone, onError) {
    var payload = {
      model: CONFIG.model,
      messages: [
        { role: 'system', content: '你是财经新闻解读助手。用户给你一条财经快讯，请用简体中文给出简明解读（250字以内）：1) 事件是什么；2) 对市场可能的影响（关联品种/资产）；3) 值得关注的后续信号。语气客观，不构成投资建议。' },
        { role: 'user', content: prompt }
      ],
      thinking: thinkingParam(CONFIG.reasoningEffort),
      max_tokens: CONFIG.maxTokens
    };
    // 非思考模式可设温度；思考模式由模型自行控制
    if (CONFIG.reasoningEffort === 'disabled') payload.temperature = 0.3;

    GM_xmlhttpRequest({
      method: 'POST',
      url: 'https://api.deepseek.com/chat/completions',
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
        showAIBox(wrap, '未配置 API Key：点击右下角 ⚙ 齿轮，在设置中填入 DeepSeek API Key。', false);
        return;
      }
      // 缓存键包含思考档位，换档后不会读到旧结果
      var cacheKey = text + '|' + (CONFIG.reasoningEffort === 'disabled' ? 'off' : CONFIG.reasoningEffort);
      var cache = cacheGet('j10_ai_cache', cacheKey);
      if (cache) { showAIBox(wrap, cache, true); return; }
      btn.disabled = true;
      btn.textContent = '…';
      callDeepSeek(text, function (result) {
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
    // 固定在时间正下方：插到 .item-time 之后紧贴（找不到时间元素则插到条目内容之前）
    var timeEl = item.querySelector('.item-time');
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
  // 三、设置入口（顶部导航"数据"后的 ⚙️AI，点击向下展开菜单）
  // ============================================================
  function addSettings() {
    // 幂等：已注入则跳过（SPA 重新渲染导航时由 MutationObserver 重试）
    if (document.getElementById('j10-gear-nav')) return;

    var navs = document.querySelectorAll('.left-navs .navs-item');
    if (!navs.length) return; // 桌面导航未渲染（窄屏/移动端布局）时静默跳过

    // 在导航末尾（"数据"后）追加入口，结构与 navs-item 一致，粗体 ⚙️AI
    // 注意：必须用 span 而非 <a href="javascript:void(0)">——实测 a 的点击会触发
    // Vue 导航组件重渲染，把入口和菜单整棵删除（表现为菜单闪现后消失）
    var gear = document.createElement('span');
    gear.id = 'j10-gear-nav';
    gear.className = 'navs-item cnzz-tg is-normal';
    gear.title = '金十净化设置';
    // 站点导航为 Vue scoped 样式（data-v-*），动态节点拿不到类样式，用 inline 兜底布局
    gear.setAttribute('data-v-179737e5', '');
    gear.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;';
    var span = document.createElement('span');
    span.className = 'glass-effect-btn';
    span.setAttribute('data-v-179737e5', '');
    span.style.cssText = 'display:flex;align-items:center;height:32px;padding:0 12px;font-weight:700;font-size:15px;color:rgba(0,0,0,0.8);';
    span.textContent = '⚙️AI';
    gear.appendChild(span);
    navs[navs.length - 1].parentNode.appendChild(gear);

    gear.onclick = function (e) {
      e.preventDefault();
      var menu = document.getElementById('j10-menu');
      if (menu) { menu.remove(); setNavActive(false); return; }
      buildMenu(gear, setNavActive);
      setNavActive(true);
    };

    function setNavActive(active) {
      if (active) gear.classList.add('is-active');
      else gear.classList.remove('is-active');
    }
  }

  // 构建设置菜单：挂到 document.body 用 fixed 定位（脱离导航容器）
  // 关键：导航祖先 .jin-nav_pc_left 有 overflow:hidden，菜单若挂在导航内会被裁切不可见；
  // 挂 body + fixed 定位同时摆脱 Vue 重渲染删除与容器裁切两个问题
  function buildMenu(anchor, setNavActive) {
    var menu = document.createElement('div');
    menu.id = 'j10-menu';
    menu.style.cssText = 'position:fixed;z-index:999999;width:290px;padding:14px;background:#fff;border:1px solid #e5e5e5;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);font-size:13px;color:#333;';
    // 锚定在入口正下方（fixed 定位基于视口坐标）；靠右时 clamp 防溢出视口
    var r = anchor.getBoundingClientRect();
    var left = r.left;
    if (left + 290 > window.innerWidth - 8) left = window.innerWidth - 290 - 8;
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.left = left + 'px';
    // 滚动时关闭菜单（防与入口错位；导航若改版为非固定定位时仍可靠）
    // 用 capture 阶段监听：金十的滚动容器可能是内部元素而非 window
    var onScroll = function () {
      if (menu.isConnected) {
        menu.remove();
        if (setNavActive) setNavActive(false);
      }
      window.removeEventListener('scroll', onScroll, true);
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    var effortOptions = ['disabled', 'low', 'high', 'max'];
    var effortHtml = '';
    for (var i = 0; i < effortOptions.length; i++) {
      effortHtml += '<option value="' + effortOptions[i] + '"' +
        (CONFIG.reasoningEffort === effortOptions[i] ? ' selected' : '') + '>' +
        (effortOptions[i] === 'disabled' ? '关闭思考（快速）' : effortOptions[i]) + '</option>';
    }
    menu.innerHTML =
      '<div style="font-weight:600;margin-bottom:10px;">金十净化设置</div>' +
      '<label style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><input type="checkbox" id="j10-opt-ads"' + (CONFIG.removeAds ? ' checked' : '') + '> 广告减负</label>' +
      '<label style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><input type="checkbox" id="j10-opt-ai"' + (CONFIG.enableAI ? ' checked' : '') + '> AI 解读（点击按钮才调用）</label>' +
      '<div style="margin-bottom:6px;">DeepSeek API Key（<a href="https://platform.deepseek.com" target="_blank" style="color:#1677ff;">platform.deepseek.com</a>）：</div>' +
      '<input id="j10-key" type="password" placeholder="sk-..." style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #d9d9d9;border-radius:4px;margin-bottom:8px;">' +
      '<div id="j10-key-mask" style="margin-bottom:8px;color:#999;font-size:12px;"></div>' +
      '<div style="margin-bottom:4px;">模型：</div>' +
      '<input id="j10-model" type="text" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #d9d9d9;border-radius:4px;margin-bottom:8px;">' +
      '<div style="margin-bottom:4px;">思考强度：</div>' +
      '<select id="j10-effort" style="width:100%;padding:6px 8px;border:1px solid #d9d9d9;border-radius:4px;margin-bottom:10px;">' + effortHtml + '</select>' +
      '<div style="display:flex;gap:8px;"><button id="j10-save" style="flex:1;padding:6px;background:#1677ff;color:#fff;border:none;border-radius:4px;cursor:pointer;">保存</button>' +
      '<button id="j10-clear-key" style="flex:1;padding:6px;background:#fff1f0;color:#cf1322;border:1px solid #ffa39e;border-radius:4px;cursor:pointer;">清空 Key</button>' +
      '<button id="j10-close" style="flex:1;padding:6px;background:#fafafa;color:#555;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;">关闭</button></div>' +
      '<div style="margin-top:10px;color:#999;font-size:12px;">说明：广告减负移除推广/弹窗；AI 解读仅针对免费公开快讯，点击按钮才消耗 API 额度。不解锁任何付费内容。</div>';
    document.body.appendChild(menu);

    // Key 不回显完整值：掩码提示已配置；输入框留空表示保持不变
    var keyMask = document.getElementById('j10-key-mask');
    if (CONFIG.apiKey) {
      keyMask.textContent = '当前已配置：sk-****' + CONFIG.apiKey.slice(-4);
    } else {
      keyMask.textContent = '未配置 Key，AI 解读不可用';
    }
    document.getElementById('j10-model').value = CONFIG.model;
    document.getElementById('j10-save').onclick = function () {
      CONFIG.removeAds = document.getElementById('j10-opt-ads').checked;
      CONFIG.enableAI = document.getElementById('j10-opt-ai').checked;
      // 输入框留空表示保持原 key 不变
      var newKey = document.getElementById('j10-key').value.trim();
      if (newKey) CONFIG.apiKey = newKey;
      CONFIG.model = document.getElementById('j10-model').value.trim() || CONFIG.model;
      CONFIG.reasoningEffort = document.getElementById('j10-effort').value;
      GM_setValue('j10_removeAds', CONFIG.removeAds);
      GM_setValue('j10_enableAI', CONFIG.enableAI);
      GM_setValue('j10_apiKey', CONFIG.apiKey);
      GM_setValue('j10_model', CONFIG.model);
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
      if (setNavActive) setNavActive(false);
      attachToAllFlashes();
    };
    document.getElementById('j10-close').onclick = function () {
      menu.remove();
      if (setNavActive) setNavActive(false);
    };
    // 清空 Key：立即生效并更新掩码提示
    document.getElementById('j10-clear-key').onclick = function () {
      CONFIG.apiKey = '';
      GM_setValue('j10_apiKey', '');
      document.getElementById('j10-key').value = '';
      document.getElementById('j10-key-mask').textContent = '未配置 Key，AI 解读不可用';
    };
  }

  // ============================================================
  // 四、主体：动态监听（快讯列表异步加载）
  function attachToAllFlashes() {
    var items = document.querySelectorAll('.jin-flash-item-container[id^="flash"], .jin-flash-item.flash');
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
        if (!document.getElementById('j10-gear-nav')) {
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
