// ==UserScript==
// @name        通用网页翻译 (AI 增强版)
// @namespace   https://github.com/liyixin21/vercel-chinese
// @description 通用网页自动翻译工具 (支持 AI 自动翻译) - 高灵敏度翻译模式（±400px 缓冲区）
// @version     1.3.4
// @author      liyixin21
// @license     GPL-3.0
// @match       *://*/*
// @icon        data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">🌐</text></svg>
// @grant       GM_xmlhttpRequest
// @grant       GM_registerMenuCommand
// @grant       GM_setClipboard
// @connect     *
// @run-at      document-end
// ==/UserScript==

(async function() {
    'use strict';

    // ==================== 配置常量 ====================
    const CONFIG = {
        AI_ENABLED_KEY: 'vc_ai_translate_enabled',
        API_KEY_KEY: 'vc_deepl_api_key',
        API_ENDPOINT_KEY: 'vc_api_endpoint',
        MODEL_NAME_KEY: 'vc_model_name',
        CACHE_KEY_PREFIX: 'vc_ai_cache_domain_', // 按域名存储缓存的前缀
        CACHE_TTL_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
        CACHE_MAX: Number.MAX_SAFE_INTEGER,
        BATCH_SIZE_KEY: 'vc_batch_size', // 批量翻译单词数
        CONCURRENCY_KEY: 'vc_concurrency', // 并发翻译数
        DEFAULT_BATCH_SIZE: 10, // 默认每批 10 个单词
        DEFAULT_CONCURRENCY: 2, // 默认 2 个并发
        VISIBILITY_BUFFER_KEY: 'vc_visibility_buffer',
        DEFAULT_VISIBILITY_BUFFER: 400, // 默认可见区域缓冲区(px)
        QUEUE_DELAY: 100, // ms
        LANG: 'zh-CN',
        DEFAULT_ENDPOINT: 'https://api-free.deepl.com/v2/translate',
        DEFAULT_MODEL: 'deepl',
        HISTORY_KEY: 'vc_translate_history_v1',
        HISTORY_MAX: 100,
        DEBUG_ENABLED_KEY: 'vc_debug_enabled',
        WHITELIST_KEY: 'vc_translate_whitelist' // 翻译白名单
    };

    // ==================== IndexedDB 存储 ====================
    function createStorage() {
        const DB_NAME = 'vc-translation-db';
        const STORE_NAME = 'kv';
        let db = null;
        const cache = new Map();

        function openDb() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, 1);
                request.onupgradeneeded = () => {
                    const database = request.result;
                    if (!database.objectStoreNames.contains(STORE_NAME)) {
                        database.createObjectStore(STORE_NAME);
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        function loadAll() {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.openCursor();
                request.onsuccess = () => {
                    const cursor = request.result;
                    if (cursor) {
                        cache.set(cursor.key, cursor.value);
                        cursor.continue();
                    }
                };
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || request.error);
            });
        }

        async function setValue(key, value) {
            cache.set(key, value);
            if (!db) return;
            try {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put(value, key);
                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
            } catch (e) {
                console.warn('[网页翻译] IndexedDB 保存失败:', e);
            }
        }

        async function deleteValue(key) {
            cache.delete(key);
            if (!db) return;
            try {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.delete(key);
                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
            } catch (e) {
                console.warn('[网页翻译] IndexedDB 删除失败:', e);
            }
        }

        return {
            async init() {
                if (db) return;
                try {
                    db = await openDb();
                    await loadAll();
                } catch (e) {
                    console.warn('[网页翻译] IndexedDB 初始化失败:', e);
                }
            },
            get(key, defaultValue) {
                return cache.has(key) ? cache.get(key) : defaultValue;
            },
            set: setValue,
            delete: deleteValue
        };
    }

    const storage = createStorage();
    await storage.init();

    // ==================== UI 样式定义 ====================
    const STYLES = `
        :root {
            --vc-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            --vc-bg: #ffffff;
            --vc-fg: #000000;
            --vc-accents-1: #fafafa;
            --vc-accents-2: #eaeaea;
            --vc-accents-3: #999999;
            --vc-accents-4: #888888;
            --vc-accents-5: #666666;
            --vc-accents-6: #444444;
            --vc-border: #eaeaea;
            --vc-success: #0070f3;
            --vc-error: #e00;
            --vc-warning: #f5a623;
            --vc-shadow-sm: 0 2px 4px rgba(0,0,0,0.05);
            --vc-shadow-lg: 0 12px 24px rgba(0,0,0,0.1);
            --vc-radius: 6px;
            --vc-radius-lg: 12px;
        }

        .vc-reset {
            font-family: var(--vc-font);
            color: var(--vc-fg);
            line-height: 1.5;
        }

        .vc-reset * {
            box-sizing: border-box;
        }

        /* Overlay */
        #vc-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(2px);
            z-index: 999998;
            opacity: 0;
            animation: vc-fade-in 0.2s ease-out forwards;
        }

        /* Dialog */
        #vc-config-dialog {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -48%) scale(0.96);
            background: var(--vc-bg);
            border-radius: var(--vc-radius-lg);
            box-shadow: var(--vc-shadow-lg);
            z-index: 999999;
            width: 520px;
            max-width: 90vw;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            opacity: 0;
            animation: vc-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            border: 1px solid var(--vc-border);
        }

        @keyframes vc-fade-in { to { opacity: 1; } }
        @keyframes vc-slide-up { to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }

        /* Header */
        .vc-header {
            padding: 16px 24px;
            border-bottom: 1px solid var(--vc-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .vc-title {
            font-size: 16px;
            font-weight: 600;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--vc-fg);
        }

        .vc-close-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 4px;
            border-radius: var(--vc-radius);
            color: var(--vc-accents-5);
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            line-height: 1;
        }

        .vc-close-btn:hover {
            background: var(--vc-accents-2);
            color: var(--vc-fg);
        }

        /* Content */
        .vc-content {
            padding: 24px;
            overflow-y: auto;
            flex: 1;
        }

        /* Form Groups */
        .vc-form-group {
            margin-bottom: 24px;
        }

        .vc-label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: var(--vc-fg);
            margin-bottom: 8px;
        }

        .vc-input, .vc-select {
            width: 100%;
            padding: 10px 12px;
            font-size: 14px;
            border: 1px solid var(--vc-border);
            border-radius: var(--vc-radius);
            background: var(--vc-bg);
            transition: border-color 0.2s, box-shadow 0.2s;
            color: var(--vc-fg);
        }

        .vc-input:hover, .vc-select:hover {
            border-color: var(--vc-accents-3);
        }

        .vc-input:focus, .vc-select:focus {
            outline: none;
            border-color: var(--vc-fg);
            box-shadow: 0 0 0 1px var(--vc-fg);
        }

        .vc-hint {
            font-size: 13px;
            color: var(--vc-accents-5);
            margin-top: 8px;
            line-height: 1.5;
        }

        .vc-hint a {
            color: var(--vc-success);
            text-decoration: none;
        }

        .vc-hint a:hover {
            text-decoration: underline;
        }

        /* Switch */
        .vc-switch-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
        }

        .vc-switch-info {
            flex: 1;
        }

        .vc-switch-title {
            font-size: 14px;
            font-weight: 500;
            color: var(--vc-fg);
        }

        .vc-switch-desc {
            font-size: 13px;
            color: var(--vc-accents-5);
            margin-top: 4px;
        }

        .vc-switch {
            position: relative;
            display: inline-block;
            width: 40px;
            height: 24px;
            flex-shrink: 0;
        }

        .vc-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .vc-slider {
            position: absolute;
            cursor: pointer;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: var(--vc-accents-2);
            transition: .3s;
            border-radius: 24px;
        }

        .vc-slider:before {
            position: absolute; content: "";
            height: 20px; width: 20px;
            left: 2px; bottom: 2px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        input:checked + .vc-slider {
            background-color: var(--vc-fg);
        }

        input:checked + .vc-slider:before {
            transform: translateX(16px);
        }

        /* Footer */
        .vc-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--vc-border);
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            background: var(--vc-bg);
            border-bottom-left-radius: var(--vc-radius-lg);
            border-bottom-right-radius: var(--vc-radius-lg);
        }

        .vc-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 16px;
            height: 40px;
            border-radius: var(--vc-radius);
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
            border: 1px solid transparent;
        }

        .vc-btn-primary {
            background: var(--vc-fg);
            color: var(--vc-bg);
            border: 1px solid var(--vc-fg);
        }

        .vc-btn-primary:hover {
            background: #333;
            border-color: #333;
        }

        .vc-btn-secondary {
            background: var(--vc-bg);
            color: var(--vc-accents-5);
            border: 1px solid var(--vc-border);
        }

        .vc-btn-secondary:hover {
            color: var(--vc-fg);
            border-color: var(--vc-fg);
            background: var(--vc-accents-1);
        }

        .vc-btn-sm {
            height: 32px;
            padding: 0 12px;
            font-size: 13px;
        }

        .vc-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        /* Tools Section */
        .vc-tools {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 24px;
            padding: 16px;
            background: var(--vc-accents-1);
            border-radius: var(--vc-radius);
            border: 1px solid var(--vc-border);
            flex-wrap: wrap;
        }

        .vc-status-text {
            font-size: 13px;
            margin-left: auto;
            color: var(--vc-accents-5);
        }

        /* History List */
        .vc-history-panel {
            margin-top: 16px;
            border: 1px solid var(--vc-border);
            border-radius: var(--vc-radius);
            max-height: 300px;
            overflow-y: auto;
            display: none;
            background: var(--vc-bg);
        }

        .vc-history-item {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vc-border);
            transition: background 0.1s;
        }

        .vc-history-item:last-child {
            border-bottom: none;
        }

        .vc-history-item:hover {
            background: var(--vc-accents-1);
        }

        .vc-history-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            font-size: 12px;
            color: var(--vc-accents-4);
        }

        .vc-history-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            font-size: 13px;
        }

        .vc-source-text {
            color: var(--vc-accents-6);
            word-break: break-all;
        }

        .vc-target-text {
            color: var(--vc-fg);
            font-weight: 500;
            word-break: break-all;
        }

        .vc-empty-state {
            padding: 32px;
            text-align: center;
            color: var(--vc-accents-4);
            font-size: 13px;
        }

        /* Floating Progress */
        #vc-progress-floating {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: var(--vc-bg);
            padding: 12px 16px;
            border-radius: 99px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border: 1px solid var(--vc-border);
            z-index: 999997;
            display: flex;
            align-items: center;
            gap: 10px;
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.3s ease;
            pointer-events: none;
        }

        #vc-progress-floating.visible {
            transform: translateY(0);
            opacity: 1;
            pointer-events: auto;
        }

        .vc-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid var(--vc-accents-2);
            border-top-color: var(--vc-fg);
            border-radius: 50%;
            animation: vc-spin 0.6s linear infinite;
        }

        @keyframes vc-spin { to { transform: rotate(360deg); } }

        .vc-progress-text {
            font-size: 13px;
            font-weight: 500;
            color: var(--vc-fg);
        }
    `;

    function injectStyles() {
        if (document.getElementById('vc-styles')) return;
        const style = document.createElement('style');
        style.id = 'vc-styles';
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    // 需要忽略的元素选择器
    const ignoredSelectors = [
        'code', 'pre', 'script', 'style', 'textarea', 'kbd',
        '.CodeMirror', '.monaco-editor', '.cm-editor', '.codemirror-textarea',
        'input[type="password"]',  // 仅忽略密码框
        '[data-do-not-translate]', '[data-translation-ignore]'
    ];

    // 需要忽略的特定元素的类名或ID
    const ignoredClasses = [
        'CodeBlock', 'gitSha', 'deployment-url', 'geist-code', 'monospace',
        'build-log', 'runtime-log', 'function-log', 'terminal-output', 'edge-log'
    ];

    // ==================== 域名和白名单管理 ====================
    // 获取当前域名
    function getCurrentDomain() {
        return window.location.hostname;
    }

    // 获取缓存键（按域名）
    function getDomainCacheKey(domain) {
        return CONFIG.CACHE_KEY_PREFIX + domain;
    }

    // 加载白名单
    function loadWhitelist() {
        try {
            const stored = storage.get(CONFIG.WHITELIST_KEY, '[]');
            const list = JSON.parse(stored);
            return Array.isArray(list) ? list : [];
        } catch (e) {
            console.warn('[网页翻译] 白名单加载失败:', e);
            return [];
        }
    }

    // 保存白名单
    function saveWhitelist(list) {
        try {
            storage.set(CONFIG.WHITELIST_KEY, JSON.stringify(list));
            return true;
        } catch (e) {
            console.error('[网页翻译] 白名单保存失败:', e);
            return false;
        }
    }

    // 检查域名是否在白名单中
    function isInWhitelist(domain) {
        const whitelist = loadWhitelist();
        return whitelist.includes(domain);
    }

    // 添加域名到白名单
    function addToWhitelist(domain) {
        const whitelist = loadWhitelist();
        if (!whitelist.includes(domain)) {
            whitelist.push(domain);
            saveWhitelist(whitelist);
            console.log(`[网页翻译] 已添加 ${domain} 到白名单`);
            return true;
        }
        return false;
    }

    // 从白名单移除域名
    function removeFromWhitelist(domain) {
        let whitelist = loadWhitelist();
        const index = whitelist.indexOf(domain);
        if (index !== -1) {
            whitelist.splice(index, 1);
            saveWhitelist(whitelist);
            console.log(`[网页翻译] 已从白名单移除 ${domain}`);
            return true;
        }
        return false;
    }

    // 获取白名单列表
    function getWhitelistDisplay() {
        const whitelist = loadWhitelist();
        if (whitelist.length === 0) {
            return '白名单为空';
        }
        return '已翻译的网站:\n' + whitelist.map((d, i) => `${i + 1}. ${d}`).join('\n');
    }

    // ==================== LRU 缓存实现 ====================
    class LRUCache {
        constructor(maxSize, ttl, storageKey) {
            this.maxSize = maxSize;
            this.ttl = ttl;
            this.storageKey = storageKey;
            this.cache = new Map();
            this.load();
        }

        load() {
            try {
                const stored = storage.get(this.storageKey, '{}');
                const data = JSON.parse(stored);
                const now = Date.now();

                Object.entries(data).forEach(([key, item]) => {
                    if (now - item.timestamp < this.ttl) {
                        this.cache.set(key, item);
                    }
                });

                console.log(`[网页翻译] 从缓存加载了 ${this.cache.size} 条翻译`);
            } catch (e) {
                console.warn('[网页翻译] 缓存加载失败:', e);
                this.cache = new Map();
            }
        }

        get(key, skipLRU = false) {
            const item = this.cache.get(key);
            if (!item) return null;

            // 检查是否过期
            if (Date.now() - item.timestamp > this.ttl) {
                this.cache.delete(key);
                return null;
            }

            // 🔧 优化：只在必要时维护 LRU 顺序
            // skipLRU=true 时跳过 delete+set 操作，减少开销
            if (!skipLRU) {
                // LRU: 移到最后
                this.cache.delete(key);
                this.cache.set(key, item);
            }

            return item.value;
        }

        set(key, value) {
            // 删除旧的
            this.cache.delete(key);

            // 如果超过限制，删除最旧的（第一个）
            if (Number.isFinite(this.maxSize) && this.cache.size >= this.maxSize) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            this.cache.set(key, {
                value: value,
                timestamp: Date.now()
            });
        }

        persist() {
            try {
                const data = {};
                this.cache.forEach((item, key) => {
                    data[key] = item;
                });
                storage.set(this.storageKey, JSON.stringify(data));
            } catch (e) {
                console.warn('[网页翻译] 缓存保存失败:', e);
            }
        }

        clear() {
            this.cache.clear();
            storage.set(this.storageKey, '{}');
        }
    }

    // ==================== 翻译队列实现 ====================
    class TranslationQueue {
        constructor(processor, delay, batchSize, concurrency = 2) {
            this.processor = processor;
            this.delay = delay;
            this.batchSize = batchSize;
            this.concurrency = concurrency; // 并发数
            this.queue = [];
            this.timer = null;
            this.activeCount = 0; // 当前活跃的并发任务数
        }

        enqueue(item) {
            // 🔧 修复：不要去重，保留所有同文本节点的回调
            // 原因：processBatch 会对同文本分组处理，去重会导致部分节点永远不被翻译
            this.queue.push(item);

            // 防抖
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.flush(), this.delay);
        }

        async flush() {
            // 🔧 并发处理：只要还有队列且未达到并发上限，就继续处理
            while (this.queue.length > 0 && this.activeCount < this.concurrency) {
                this.activeCount++;

                // 取出批量
                const batch = this.queue.splice(0, this.batchSize);

                // 异步处理批次（不阻塞）
                this.processor(batch)
                    .catch(e => {
                        console.error('[网页翻译] 批量翻译失败:', e);
                    })
                    .finally(() => {
                        this.activeCount--;

                        // 如果还有剩余，继续处理
                        if (this.queue.length > 0) {
                            this.timer = setTimeout(() => this.flush(), this.delay);
                        }
                    });
            }
        }
    }

    // ==================== 全局状态 ====================
    const currentDomain = getCurrentDomain();
    let cache = new LRUCache(CONFIG.CACHE_MAX, CONFIG.CACHE_TTL_MS, getDomainCacheKey(currentDomain));
    let translationQueue = null;
    let translationHistory = loadHistory();
    const pendingTexts = new Set();
    const progressState = { total: 0, completed: 0 };
    let progressElement = null;

    // 🔧 修复：SPA 路由切换支持
    let mutationQueue = [];  // 累积 mutation 队列，避免节流丢失
    let mutationTimer = null;
    let routeTranslateTimer = null;
    let historyHooked = false;

    // 🔧 修复：防止 characterData 死循环的自触发保护
    const translatingNodes = new WeakSet(); // 标记正在被翻译的节点
    const translatedNodes = new WeakSet(); // 标记已完成翻译的节点（永久）
    const nodeTranslationMap = new WeakMap(); // 记录节点原文与译文，用于回退恢复

    // 🔧 修复：定期检查懒加载内容
    let periodicCheckTimer = null;
    let lastCheckTime = 0;

    // ==================== 可见性检测 ====================

    // 检查元素是否在可见区域（高灵敏度：±buffer 缓冲区）
    function isElementVisible(element) {
        if (!element || !element.getBoundingClientRect) return false;

        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;
        const buffer = Number(storage.get(CONFIG.VISIBILITY_BUFFER_KEY, CONFIG.DEFAULT_VISIBILITY_BUFFER)) || CONFIG.DEFAULT_VISIBILITY_BUFFER;

        return (
            rect.bottom >= -buffer &&
            rect.top <= windowHeight + buffer &&
            rect.right >= 0 &&
            rect.left <= windowWidth
        );
    }

    // ==================== 翻译 API 集成 ====================
    // 工具函数：延迟等待
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 工具函数：检查是否启用调试模式
    function isDebugEnabled() {
        return storage.get(CONFIG.DEBUG_ENABLED_KEY, false);
    }

    // 工具函数：脱敏处理API密钥
    function maskKey(key) {
        if (!key) return '';
        if (key.length <= 8) return '*'.repeat(key.length);
        return `${key.slice(0, 4)}...${key.slice(-2)}`;
    }

    // 工具函数：调试日志输出
    function logDebug(label, payload) {
        if (!isDebugEnabled()) return;
        const ts = new Date().toISOString();
        console.log(`[网页翻译][DEBUG] ${ts}`, label, payload);
    }

    function tryCopy(text) {
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text);
            return true;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
            return true;
        }
        return false;
    }

    function downloadText(filename, text) {
        const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function exportDictionaryJson() {
        try {
            const dict = {};
            cache.cache.forEach((item, key) => {
                const value = item && typeof item === 'object' && 'value' in item ? item.value : item;
                if (!value || value === key) return;
                dict[String(key)] = String(value);
            });
            const json = JSON.stringify(dict, null, 2);
            tryCopy(json);
            downloadText('vc-ai-cache.json', json);
            alert(`成功导出 ${Object.keys(dict).length} 条翻译到 vc-ai-cache.json\n\n已同时复制到剪贴板`);
        } catch (err) {
            console.error('[网页翻译] 词典导出失败:', err);
            alert(`导出失败: ${err.message}`);
        }
    }

    function importDictionaryJson() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';

        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const text = String(reader.result || '');
                    const parsed = JSON.parse(text);
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        throw new Error('JSON 需要是对象格式');
                    }
                    let imported = 0;
                    Object.entries(parsed).forEach(([key, value]) => {
                        if (!key) return;
                        const normalizedValue = typeof value === 'string' ? value : String(value);
                        if (!normalizedValue || normalizedValue === key) return;
                        cache.set(String(key), normalizedValue);
                        imported += 1;
                    });
                    cache.persist();
                    alert(`成功导入 ${imported} 条翻译`);
                } catch (err) {
                    console.error('[网页翻译] 词典导入失败:', err);
                    alert(`导入失败: ${err.message}`);
                }
            };
            reader.onerror = () => {
                alert('导入失败: 读取文件错误');
            };
            reader.readAsText(file);
        };

        input.click();
    }

    // 核心翻译函数（单次请求）
    async function translateRequest(texts, apiKey, endpoint, modelName) {

        // 根据模型类型构建请求
        if (modelName === 'deepl') {
            // DeepL API 格式
            const params = texts.map(t => `text=${encodeURIComponent(t)}`).join('&');
            const data = `${params}&target_lang=ZH`;
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `DeepL-Auth-Key ${apiKey}`
            };

            // 调试输出：DeepL 请求
            logDebug('DeepL 请求', {
                method: 'POST',
                url: endpoint,
                headers: {
                    'Content-Type': headers['Content-Type'],
                    'Authorization': `DeepL-Auth-Key ${maskKey(apiKey)}`
                },
                body: data
            });

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: endpoint,
                    headers: headers,
                    data: data,
                    timeout: 10000,
                    onload: (response) => {
                        // 调试输出：DeepL 响应
                        logDebug('DeepL 响应', {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.responseHeaders,
                            body: response.responseText
                        });

                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const body = JSON.parse(response.responseText);
                                resolve(body.translations.map(t => t.text));
                            } catch (e) {
                                console.error('[网页翻译] 解析 DeepL 响应失败:', e, '原始响应:', response.responseText);
                                reject(new Error('解析响应失败'));
                            }
                        } else if (response.status === 429) {
                            console.error('[网页翻译] API 配额已用完，响应体:', response.responseText);
                            reject(new Error('API 配额已用完'));
                        } else if (response.status === 403) {
                            console.error('[网页翻译] API 密钥无效，响应体:', response.responseText);
                            reject(new Error('API 密钥无效'));
                        } else {
                            console.error(`[网页翻译] HTTP ${response.status} 错误，完整响应:`, {
                                status: response.status,
                                statusText: response.statusText,
                                headers: response.responseHeaders,
                                body: response.responseText
                            });
                            reject(new Error(`HTTP ${response.status}`));
                        }
                    },
                    onerror: (err) => {
                        const errorInfo = {
                            error: err,
                            readyState: err.readyState,
                            status: err.status,
                            responseText: err.responseText,
                            responseHeaders: err.responseHeaders
                        };

                        // 调试输出：DeepL 网络错误
                        logDebug('DeepL 网络错误', errorInfo);

                        console.error('[网页翻译] DeepL 网络错误，完整信息:', errorInfo);
                        reject(new Error(`网络请求失败 - 请检查：\n1. API端点URL是否正确\n2. 网络连接是否正常\n3. 是否需要配置代理\n4. Tampermonkey是否允许跨域请求`));
                    },
                    ontimeout: () => {
                        // 调试输出：DeepL 请求超时
                        logDebug('DeepL 请求超时', { endpoint, timeout: 10000 });

                        reject(new Error('请求超时 - API响应时间过长，请检查网络或更换API端点'));
                    }
                });
            });
        } else {
            // OpenAI 兼容格式（GPT、Claude等）
            // 🔧 修复：批量处理所有文本
            const batchPrompt = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');
            const systemMessage = '你是一个专业的技术翻译助手。请将以下编号的英文文本逐行翻译成中文，保持编号格式，仅返回翻译结果，不要添加解释。';
            const payload = {
                model: modelName,
                messages: [
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: batchPrompt }
                ],
                temperature: 0.3
            };
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };

            // 调试输出：OpenAI 请求
            logDebug('OpenAI 兼容 API 请求', {
                method: 'POST',
                url: endpoint,
                headers: {
                    'Content-Type': headers['Content-Type'],
                    'Authorization': `Bearer ${maskKey(apiKey)}`
                },
                body: payload
            });

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: endpoint,
                    headers: headers,
                    data: JSON.stringify(payload),
                    timeout: 15000,
                    onload: (response) => {
                        // 调试输出：OpenAI 响应
                        logDebug('OpenAI 兼容 API 响应', {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.responseHeaders,
                            body: response.responseText
                        });

                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const body = JSON.parse(response.responseText);
                                const translated = body.choices[0].message.content;

                                // 解析批量结果
                                const lines = translated.trim().split('\n');
                                const results = lines.map(line => {
                                    // 移除编号 "1. " 或 "1. "
                                    return line.replace(/^\d+\.\s*/, '').trim();
                                });

                                // 确保结果数量匹配
                                if (results.length !== texts.length) {
                                    console.warn('[网页翻译] 翻译结果数量不匹配，期望:', texts.length, '实际:', results.length);
                                    // 补齐缺失的翻译
                                    while (results.length < texts.length) {
                                        results.push(texts[results.length]);
                                    }
                                }

                                resolve(results);
                            } catch (e) {
                                console.error('[网页翻译] 解析 OpenAI 响应失败:', e, '原始响应:', response.responseText);
                                reject(new Error('解析响应失败'));
                            }
                        } else {
                            console.error(`[网页翻译] HTTP ${response.status} 错误，完整响应:`, {
                                status: response.status,
                                statusText: response.statusText,
                                headers: response.responseHeaders,
                                body: response.responseText
                            });
                            reject(new Error(`HTTP ${response.status}`));
                        }
                    },
                    onerror: (err) => {
                        const errorInfo = {
                            error: err,
                            readyState: err.readyState,
                            status: err.status,
                            responseText: err.responseText,
                            responseHeaders: err.responseHeaders
                        };

                        // 调试输出：OpenAI 网络错误
                        logDebug('OpenAI 兼容 API 网络错误', errorInfo);

                        console.error('[网页翻译] OpenAI 兼容 API 网络错误，完整信息:', errorInfo);
                        reject(new Error(`网络请求失败 - 请检查：\n1. API端点URL是否正确\n2. 网络连接是否正常\n3. 是否需要配置代理\n4. Tampermonkey是否允许跨域请求`));
                    },
                    ontimeout: () => {
                        // 调试输出：OpenAI 请求超时
                        logDebug('OpenAI 兼容 API 请求超时', { endpoint, timeout: 15000 });

                        reject(new Error('请求超时 - API响应时间过长，请检查网络或更换API端点'));
                    }
                });
            });
        }
    }

    // 带重试的翻译函数（最多重试3次）
    async function translateWithDeepL(texts, overrideConfig = {}) {
        const apiKey = overrideConfig.apiKey ?? storage.get(CONFIG.API_KEY_KEY, '');
        const endpoint = overrideConfig.endpoint ?? storage.get(CONFIG.API_ENDPOINT_KEY, CONFIG.DEFAULT_ENDPOINT);
        const modelName = overrideConfig.modelName ?? storage.get(CONFIG.MODEL_NAME_KEY, CONFIG.DEFAULT_MODEL);

        if (!apiKey) {
            throw new Error('未配置 API 密钥');
        }

        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[网页翻译] 翻译尝试 ${attempt}/${maxRetries}`);
                const result = await translateRequest(texts, apiKey, endpoint, modelName);

                // 成功后，如果之前失败过，记录成功信息
                if (attempt > 1) {
                    console.log(`[网页翻译] 重试成功（第 ${attempt} 次尝试）`);
                }

                return result;
            } catch (error) {
                lastError = error;

                // 不可重试的错误（配额用完、密钥无效等）
                const nonRetryableErrors = ['API 配额已用完', 'API 密钥无效'];
                if (nonRetryableErrors.some(msg => error.message.includes(msg))) {
                    console.error(`[网页翻译] 不可重试的错误: ${error.message}`);
                    throw error;
                }

                // 最后一次尝试失败
                if (attempt === maxRetries) {
                    console.error(`[网页翻译] 翻译失败，已重试 ${maxRetries} 次: ${error.message}`);
                    break;
                }

                // 等待后重试（指数退避：1s, 2s, 4s）
                const delay = Math.pow(2, attempt - 1) * 1000;
                console.warn(`[网页翻译] 第 ${attempt} 次尝试失败: ${error.message}，${delay}ms 后重试...`);
                await sleep(delay);
            }
        }

        // 所有重试都失败后抛出最后的错误
        throw lastError || new Error('翻译失败');
    }

    // ==================== 翻译记录与进度 ====================
    function loadHistory() {
        try {
            const stored = storage.get(CONFIG.HISTORY_KEY, '[]');
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed.slice(0, CONFIG.HISTORY_MAX);
            }
        } catch (e) {
            console.warn('[网页翻译] 翻译记录加载失败:', e);
        }
        return [];
    }

    function addHistoryEntry(source, target) {
        if (!source || !target) return;
        translationHistory.unshift({
            time: Date.now(),
            source,
            target
        });
        if (translationHistory.length > CONFIG.HISTORY_MAX) {
            translationHistory = translationHistory.slice(0, CONFIG.HISTORY_MAX);
        }
        try {
            storage.set(CONFIG.HISTORY_KEY, JSON.stringify(translationHistory));
        } catch (e) {
            console.warn('[网页翻译] 翻译记录保存失败:', e);
        }
    }

    function renderHistoryList(container) {
        if (!container) return;
        container.textContent = '';

        if (!translationHistory.length) {
            const empty = document.createElement('div');
            empty.className = 'vc-empty-state';
            empty.textContent = '暂无翻译记录';
            container.appendChild(empty);
            return;
        }

        // Header row
        const header = document.createElement('div');
        header.style.padding = '8px 16px';
        header.style.borderBottom = '1px solid var(--vc-border)';
        header.style.background = 'var(--vc-accents-1)';
        header.style.display = 'grid';
        header.style.gridTemplateColumns = '1fr 1fr';
        header.style.gap = '16px';
        header.style.fontSize = '12px';
        header.style.color = 'var(--vc-accents-5)';
        header.style.fontWeight = '500';
        
        const hSource = document.createElement('div');
        hSource.textContent = '原文';
        const hTarget = document.createElement('div');
        hTarget.textContent = '译文';
        
        header.appendChild(hSource);
        header.appendChild(hTarget);
        container.appendChild(header);

        // List items
        translationHistory.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'vc-history-item';

            const row = document.createElement('div');
            row.className = 'vc-history-row';

            const sourceDiv = document.createElement('div');
            sourceDiv.className = 'vc-source-text';
            sourceDiv.textContent = entry.source;

            const targetDiv = document.createElement('div');
            targetDiv.className = 'vc-target-text';
            targetDiv.textContent = entry.target;

            row.appendChild(sourceDiv);
            row.appendChild(targetDiv);

            const meta = document.createElement('div');
            meta.style.marginTop = '6px';
            meta.style.display = 'flex';
            meta.style.justifyContent = 'flex-end';
            meta.style.fontSize = '11px';
            meta.style.color = 'var(--vc-accents-4)';

            const timeSpan = document.createElement('span');
            const now = Date.now();
            const diff = now - entry.time;
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            let timeStr;
            if (days > 0) timeStr = `${days}天前`;
            else if (hours > 0) timeStr = `${hours}小时前`;
            else if (minutes > 0) timeStr = `${minutes}分钟前`;
            else timeStr = '刚刚';

            timeSpan.textContent = timeStr;
            meta.appendChild(timeSpan);

            item.appendChild(row);
            item.appendChild(meta);
            container.appendChild(item);
        });
    }

    function ensureProgressElement() {
        if (progressElement) return progressElement;

        // ✅ 使用 Vercel 风格的进度悬浮窗（禁止翻译）
        progressElement = document.createElement('div');
        progressElement.id = 'vc-progress-floating';
        progressElement.setAttribute('data-do-not-translate', 'true'); // 禁止翻译

        const spinner = document.createElement('div');
        spinner.className = 'vc-spinner';

        const text = document.createElement('span');
        text.className = 'vc-progress-text';
        text.textContent = '翻译中...';
        text.id = 'vc-progress-text';

        progressElement.appendChild(spinner);
        progressElement.appendChild(text);
        document.body.appendChild(progressElement);

        // 添加 visible 类以触发动画
        setTimeout(() => {
            progressElement.classList.add('visible');
        }, 100);

        return progressElement;
    }

    function updateProgressUI() {
        // 🔧 修复：没有翻译任务时不显示进度浮窗
        if (progressState.total === 0) {
            // 隐藏已存在的浮窗
            if (progressElement && progressElement.classList.contains('visible')) {
                progressElement.classList.remove('visible');
            }
            return;
        }

        const el = ensureProgressElement();

        // 🔧 修复：确保进度窗口可见（处理 SPA 路由切换场景）
        if (!el.classList.contains('visible')) {
            el.classList.add('visible');
        }

        const textEl = el.querySelector('#vc-progress-text');
        if (textEl) {
            textEl.textContent = `翻译进度: 已完成 ${progressState.completed} / 总计 ${progressState.total}`;
        }

        // 如果全部完成,3秒后隐藏
        if (progressState.completed >= progressState.total && progressState.total > 0) {
            setTimeout(() => {
                el.classList.remove('visible');
                // 🔧 修复：重置进度状态，为下次翻译做准备
                progressState.total = 0;
                progressState.completed = 0;
            }, 3000);
        }
    }

    function markTextCompleted(text) {
        if (pendingTexts.has(text)) {
            pendingTexts.delete(text);
            progressState.completed += 1;
            updateProgressUI();
        }
    }

    // ==================== 批量处理器 ====================
    async function processBatch(items) {
        // 🔧 修复：将相同文本的所有项分组
        const textToItems = new Map();
        items.forEach(item => {
            if (!textToItems.has(item.text)) {
                textToItems.set(item.text, []);
            }
            textToItems.get(item.text).push(item);
        });

        const uniqueTexts = Array.from(textToItems.keys());

        try {
            const translations = await translateWithDeepL(uniqueTexts);

            uniqueTexts.forEach((original, idx) => {
                const translated = translations[idx];
                const itemsGroup = textToItems.get(original);

                if (translated) {
                    // 保存到缓存
                    cache.set(original, translated);

                    // 🔧 修复：应用翻译到所有相同文本的节点
                    itemsGroup.forEach(item => {
                        if (item.apply) {
                            item.apply(translated);
                        }
                    });

                    addHistoryEntry(original, translated);
                }

                markTextCompleted(original);
            });

            // 持久化缓存
            cache.persist();

        } catch (error) {
            console.warn('[网页翻译] AI 翻译失败:', error.message);

            // 降级：使用原文
            textToItems.forEach((itemsGroup, original) => {
                itemsGroup.forEach(item => {
                    if (item.apply) {
                        item.apply(item.text);
                    }
                });
                markTextCompleted(original);
            });
        }
    }

    // ==================== 核心翻译函数 ====================
    // 检测是否包含中文字符
    function containsChinese(text) {
        return /[\u4e00-\u9fa5]/.test(text);
    }

    // 检测是否主要是中文（中文字符占比超过30%）
    function isPrimarilyChinese(text) {
        const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
        if (!chineseChars) return false;
        const ratio = chineseChars.length / text.length;
        return ratio > 0.3;
    }

    function translateText(text, context, applyCallback) {
        if (!text || !text.trim()) return;

        // 0. 过滤中文内容 - 如果包含中文就不翻译
        if (containsChinese(text)) {
            applyCallback(text);
            return;
        }

        // 1. 检查缓存 - 🔧 优化：缓存命中时立即同步应用，跳过队列和可见性检查
        // 🔧 优化：skipLRU=true 减少缓存维护开销（读场景不需要更新 LRU 顺序）
        const cached = cache.get(text, true);
        if (cached) {
            // 🎯 关键优化：直接同步调用回调，不经过队列
            applyCallback(cached);
            return;
        }

        // 2. 检查是否启用 AI 翻译
        const aiEnabled = storage.get(CONFIG.AI_ENABLED_KEY, false);
        if (!aiEnabled) {
            // 未启用AI，保持原文
            applyCallback(text);
            return;
        }

        // 4. 加入队列（异步翻译） - 仅对缓存未命中的情况
        if (translationQueue) {
            const alreadyPending = pendingTexts.has(text);
            translationQueue.enqueue({
                text: text,
                context: context,
                apply: applyCallback
            });
            if (!alreadyPending) {
                pendingTexts.add(text);
                progressState.total += 1;
                updateProgressUI();
            }
        } else {
            applyCallback(text);
        }
    }

    // ==================== DOM 操作函数 ====================
    function shouldIgnoreNode(node) {
        if (!node || node.nodeType !== 1) return false;

        if (ignoredSelectors.some(selector => node.matches && node.matches(selector))) {
            return true;
        }

        if (node.className && typeof node.className === 'string') {
            if (ignoredClasses.some(cls => node.className.includes(cls))) {
                return true;
            }
        }

        let parent = node.parentNode;
        while (parent && parent !== document.body) {
            if (parent.nodeType === 1) {
                if (ignoredSelectors.some(selector => parent.matches && parent.matches(selector))) {
                    return true;
                }
                if (parent.className && typeof parent.className === 'string') {
                    if (ignoredClasses.some(cls => parent.className.includes(cls))) {
                        return true;
                    }
                }
            }
            parent = parent.parentNode;
        }

        return false;
    }

    function translateTextNode(node) {
        if (!node || !node.nodeValue || !node.nodeValue.trim()) return;
        if (node.parentNode && shouldIgnoreNode(node.parentNode)) return;

        // 🔧 修复：跳过已翻译的节点，防止重复翻译
        // 但如果节点内容变回了英文（可能被框架重置），则需要重新翻译
        if (translatedNodes.has(node)) {
            // 如果节点现在是中文，说明翻译还在，跳过
            if (node.nodeValue && isPrimarilyChinese(node.nodeValue)) {
                logDebug('translateTextNode 跳过', '节点已翻译过且保持中文');
                return;
            }
            // 如果节点现在是英文（且之前翻译过），说明被还原了，允许重新翻译
            logDebug('translateTextNode 重新激活', '节点曾被翻译但当前为英文');
        }

        const originalText = node.nodeValue.trim();
        const parentElement = node.parentNode;

        // 🔧 优化：先检查缓存，如果命中则跳过可见性检查
        // skipLRU=true 减少缓存维护开销
        const cached = cache.get(originalText, true);
        const isCached = !!cached;

        // 定义翻译执行函数
        const doTranslate = () => {
            const currentText = node.nodeValue ? node.nodeValue.trim() : '';

            // 🔧 调试日志：记录翻译尝试
            logDebug('translateTextNode 调用', {
                originalText,
                currentText,
                isSame: originalText === currentText,
                nodeExists: !!node.parentNode,
                isCached: isCached
            });

            // 🔧 安全检查：如果节点已被移除或文本已改变，跳过翻译
            if (!node.parentNode) {
                logDebug('translateTextNode 跳过', '节点已被移除');
                return;
            }

            if (currentText !== originalText) {
                logDebug('translateTextNode 跳过', `文本已改变: "${originalText}" → "${currentText}"`);
                return;
            }

            translateText(originalText, { type: 'textNode' }, (translated) => {
                if (translated && translated !== originalText) {
                    // 🔧 修复：标记节点为正在翻译，避免触发 characterData 循环
                    translatingNodes.add(node);

                    // 🔧 修复：使用全局替换，避免只替换首次匹配
                    const fullText = node.nodeValue;
                    if (fullText && fullText.trim() === originalText) {
                        // 🔧 调试日志：记录翻译应用
                        logDebug('应用翻译', {
                            原文: originalText,
                            译文: translated,
                            当前值: fullText
                        });

                        // 完全匹配，使用正则全局替换
                        const escapedOriginal = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        node.nodeValue = fullText.replace(new RegExp(escapedOriginal, 'g'), translated);

                        // 记录原文与译文，便于后续回退恢复
                        nodeTranslationMap.set(node, { original: originalText, translated: translated });

                        // 🔧 修复：永久标记为已翻译，防止定期检查重复翻译
                        translatedNodes.add(node);
                    } else if (fullText && fullText.trim() === translated) {
                        // 🔧 优化修复：节点已经是翻译后的文本，静默跳过（可能被缓存命中逻辑已处理）
                        logDebug('翻译已应用', `节点已是译文: "${translated}"`);
                        translatedNodes.add(node);
                    } else {
                        logDebug('翻译应用失败', `节点值已改变: "${fullText}"`);
                    }

                    // 🔧 使用 setTimeout 延迟移除标记，确保 mutation 已处理
                    setTimeout(() => translatingNodes.delete(node), 50);
                }
            });
        };

        // 🎯 关键优化：缓存命中时跳过可见性检查，立即翻译
        if (isCached) {
            doTranslate();
        } else if (parentElement && isElementVisible(parentElement)) {
            // 🔧 修改：只对可见元素调用 AI 翻译
            // 缓存未命中且元素可见，才进行翻译（会调用 AI）
            doTranslate();
        }
        // 🔧 修改：移除不可见元素的延迟翻译逻辑
        // 不可见元素如果缓存未命中，直接跳过，不加入观察队列，不调用 AI
    }

    function translateAttribute(element, attrName) {
        if (!element || !element.hasAttribute(attrName)) return;

        const attrValue = element.getAttribute(attrName);
        if (!attrValue || !attrValue.trim()) return;

        // 🔧 优化：先检查缓存，如果命中则跳过可见性检查
        // skipLRU=true 减少缓存维护开销
        const cached = cache.get(attrValue, true);
        const isCached = !!cached;

        // 定义翻译执行函数
        const doTranslate = () => {
            translateText(attrValue, { type: 'attribute', attr: attrName }, (translated) => {
                if (translated && translated !== attrValue) {
                    element.setAttribute(attrName, translated);
                }
            });
        };

        // 🎯 关键优化：缓存命中时跳过可见性检查，立即翻译
        if (isCached) {
            doTranslate();
        } else if (isElementVisible(element)) {
            // 🔧 修改：只对可见元素调用 AI 翻译
            // 缓存未命中且元素可见，才进行翻译（会调用 AI）
            doTranslate();
        }
        // 🔧 修改：移除不可见元素的延迟翻译逻辑
        // 不可见元素如果缓存未命中，直接跳过，不加入观察队列，不调用 AI
    }

    // ==================== 用户配置界面 ====================
    function showConfigDialog() {
        const currentKey = storage.get(CONFIG.API_KEY_KEY, '');
        const currentEndpoint = storage.get(CONFIG.API_ENDPOINT_KEY, CONFIG.DEFAULT_ENDPOINT);
        const currentModel = storage.get(CONFIG.MODEL_NAME_KEY, CONFIG.DEFAULT_MODEL);
        const aiEnabled = storage.get(CONFIG.AI_ENABLED_KEY, false);
        const debugEnabled = storage.get(CONFIG.DEBUG_ENABLED_KEY, false);

        // ✅ 使用 DOM API 避免 XSS (Vercel风格重构)
        const overlay = document.createElement('div');
        overlay.id = 'vc-overlay';
        overlay.className = 'vc-reset';

        const dialog = document.createElement('div');
        dialog.id = 'vc-config-dialog';
        dialog.className = 'vc-reset';

        // === 头部 ===
        const header = document.createElement('div');
        header.className = 'vc-header';

        const title = document.createElement('h2');
        title.className = 'vc-title';
        // Vercel Logo SVG
        title.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="color:var(--vc-fg)">
                <text y="0.9em" font-size="90">🌐</text>
            </svg>
            网页翻译设置
        `;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'vc-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', '关闭');

        header.appendChild(title);
        header.appendChild(closeBtn);

        // === 内容区域 ===
        const content = document.createElement('div');
        content.className = 'vc-content';

        // 1. AI 开关
        const aiGroup = document.createElement('div');
        aiGroup.className = 'vc-form-group';

        const aiSwitchRow = document.createElement('div');
        aiSwitchRow.className = 'vc-switch-row';

        const aiInfo = document.createElement('div');
        aiInfo.className = 'vc-switch-info';

        const aiTitle = document.createElement('div');
        aiTitle.className = 'vc-switch-title';
        aiTitle.textContent = '启用 AI 翻译';

        const aiDesc = document.createElement('div');
        aiDesc.className = 'vc-switch-desc';
        aiDesc.textContent = '自动翻译未收录的文本';

        aiInfo.appendChild(aiTitle);
        aiInfo.appendChild(aiDesc);

        const aiSwitch = document.createElement('label');
        aiSwitch.className = 'vc-switch';

        const aiCheckbox = document.createElement('input');
        aiCheckbox.type = 'checkbox';
        aiCheckbox.id = 'vc-ai-enabled';
        aiCheckbox.checked = aiEnabled;

        const aiSlider = document.createElement('span');
        aiSlider.className = 'vc-slider';

        aiSwitch.appendChild(aiCheckbox);
        aiSwitch.appendChild(aiSlider);

        aiSwitchRow.appendChild(aiInfo);
        aiSwitchRow.appendChild(aiSwitch);
        aiGroup.appendChild(aiSwitchRow);

        // 1.1 调试模式开关
        const debugSwitchRow = document.createElement('div');
        debugSwitchRow.className = 'vc-switch-row';

        const debugInfo = document.createElement('div');
        debugInfo.className = 'vc-switch-info';

        const debugTitle = document.createElement('div');
        debugTitle.className = 'vc-switch-title';
        debugTitle.textContent = '调试模式';

        const debugDesc = document.createElement('div');
        debugDesc.className = 'vc-switch-desc';
        debugDesc.textContent = '在控制台输出请求与响应详情';

        debugInfo.appendChild(debugTitle);
        debugInfo.appendChild(debugDesc);

        const debugSwitch = document.createElement('label');
        debugSwitch.className = 'vc-switch';

        const debugCheckbox = document.createElement('input');
        debugCheckbox.type = 'checkbox';
        debugCheckbox.id = 'vc-debug-enabled';
        debugCheckbox.checked = debugEnabled;

        const debugSlider = document.createElement('span');
        debugSlider.className = 'vc-slider';

        debugSwitch.appendChild(debugCheckbox);
        debugSwitch.appendChild(debugSlider);

        debugSwitchRow.appendChild(debugInfo);
        debugSwitchRow.appendChild(debugSwitch);
        aiGroup.appendChild(debugSwitchRow);

        // 2. 模型选择
        const modelGroup = document.createElement('div');
        modelGroup.className = 'vc-form-group';

        const modelLabel = document.createElement('label');
        modelLabel.className = 'vc-label';
        modelLabel.textContent = '翻译模型';

        const modelWrapper = document.createElement('div');
        modelWrapper.className = 'vc-input-wrapper';

        const modelSelect = document.createElement('select');
        modelSelect.id = 'vc-model-name';
        modelSelect.className = 'vc-select';

        const models = [
            { value: 'deepl', text: 'DeepL (推荐)' },
            { value: 'gemini-2.5-flash-lite', text: 'Gemini 2.5 Flash Lite (推荐)' },
            { value: 'gpt-4o-mini', text: 'OpenAI GPT-4o-mini' },
            { value: 'gpt-3.5-turbo', text: 'OpenAI GPT-3.5-turbo' },
            { value: 'claude-3-haiku-20240307', text: 'Claude 3 Haiku' },
            { value: 'gemini-2.5-flash-exp', text: 'Gemini 2.5 Flash' },
            { value: 'gemini-1.5-flash', text: 'Gemini 1.5 Flash' },
            { value: 'custom', text: '自定义模型' }
        ];

        // 检查当前模型是否为预设模型
        const isPresetModel = models.some(m => m.value === currentModel);
        let actualCustomModel = currentModel;

        models.forEach(m => {
            const option = document.createElement('option');
            option.value = m.value;
            option.textContent = m.text;
            if (m.value === currentModel) {
                option.selected = true;
            } else if (m.value === 'custom' && !isPresetModel) {
                option.selected = true;
            }
            modelSelect.appendChild(option);
        });

        modelWrapper.appendChild(modelSelect);

        // 自定义模型名称输入框
        const customModelInput = document.createElement('input');
        customModelInput.type = 'text';
        customModelInput.id = 'vc-custom-model';
        customModelInput.className = 'vc-input';
        customModelInput.placeholder = '例如: gemini-2.5-flash-lite, gpt-4o-mini, claude-3-5-sonnet-20241022';
        customModelInput.value = !isPresetModel ? currentModel : '';
        customModelInput.style.marginTop = '8px';
        customModelInput.style.display = (!isPresetModel || modelSelect.value === 'custom') ? 'block' : 'none';

        modelWrapper.appendChild(customModelInput);

        // 监听模型选择变化
        modelSelect.addEventListener('change', () => {
            if (modelSelect.value === 'custom') {
                customModelInput.style.display = 'block';
                customModelInput.focus();
            } else {
                customModelInput.style.display = 'none';
            }
        });

        modelGroup.appendChild(modelLabel);
        modelGroup.appendChild(modelWrapper);

        // 3. API 接入点
        const endpointGroup = document.createElement('div');
        endpointGroup.className = 'vc-form-group';

        const endpointLabel = document.createElement('label');
        endpointLabel.className = 'vc-label';
        endpointLabel.textContent = 'API 接入点';

        const endpointInput = document.createElement('input');
        endpointInput.type = 'text';
        endpointInput.id = 'vc-api-endpoint';
        endpointInput.className = 'vc-input';
        endpointInput.value = currentEndpoint;
        endpointInput.placeholder = 'https://api-free.deepl.com/v2/translate';

        const endpointHint = document.createElement('div');
        endpointHint.className = 'vc-hint';
        endpointHint.textContent = 'DeepL Free/Pro | OpenAI | Claude | 自定义中转';

        endpointGroup.appendChild(endpointLabel);
        endpointGroup.appendChild(endpointInput);
        endpointGroup.appendChild(endpointHint);

        // 4. API 密钥
        const keyGroup = document.createElement('div');
        keyGroup.className = 'vc-form-group';

        const keyLabel = document.createElement('label');
        keyLabel.className = 'vc-label';
        keyLabel.textContent = 'API 密钥';

        const keyInputWrapper = document.createElement('div');
        keyInputWrapper.style.display = 'flex';
        keyInputWrapper.style.gap = '8px';

        const keyInput = document.createElement('input');
        keyInput.type = 'password';
        keyInput.id = 'vc-api-key';
        keyInput.className = 'vc-input';
        keyInput.value = currentKey;
        keyInput.placeholder = '请输入您的 API 密钥';
        keyInput.style.flex = '1';

        const copyKeyBtn = document.createElement('button');
        copyKeyBtn.className = 'vc-btn vc-btn-secondary';
        copyKeyBtn.textContent = '复制';
        copyKeyBtn.style.minWidth = '80px';
        copyKeyBtn.onclick = () => {
            const keyValue = keyInput.value;
            if (!keyValue) {
                alert('⚠️ 没有密钥可复制');
                return;
            }

            // 使用 GM_setClipboard 复制到剪贴板
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(keyValue);
                copyKeyBtn.textContent = '✓ 已复制';
                setTimeout(() => {
                    copyKeyBtn.textContent = '复制';
                }, 2000);
            } else {
                // 降级方案：使用原生 API
                navigator.clipboard.writeText(keyValue).then(() => {
                    copyKeyBtn.textContent = '✓ 已复制';
                    setTimeout(() => {
                        copyKeyBtn.textContent = '复制';
                    }, 2000);
                }).catch(() => {
                    alert('❌ 复制失败，请手动复制');
                });
            }
        };

        keyInputWrapper.appendChild(keyInput);
        keyInputWrapper.appendChild(copyKeyBtn);

        const keyHint = document.createElement('div');
        keyHint.className = 'vc-hint';

        const keyHintText = document.createTextNode('获取免费密钥: ');
        const keyLink = document.createElement('a');
        keyLink.href = 'https://www.deepl.com/pro-api';
        keyLink.target = '_blank';
        keyLink.rel = 'noopener noreferrer';
        keyLink.textContent = 'DeepL API';

        keyHint.appendChild(keyHintText);
        keyHint.appendChild(keyLink);

        keyGroup.appendChild(keyLabel);
        keyGroup.appendChild(keyInputWrapper);
        keyGroup.appendChild(keyHint);

        // 5. 速度设置
        const speedGroup = document.createElement('div');
        speedGroup.className = 'vc-form-group';

        const speedLabel = document.createElement('label');
        speedLabel.className = 'vc-label';
        speedLabel.textContent = '翻译速度设置';

        // 批量大小设置
        const batchSizeWrapper = document.createElement('div');
        batchSizeWrapper.style.marginBottom = '12px';

        const batchSizeLabel = document.createElement('label');
        batchSizeLabel.textContent = '每批翻译单词数：';
        batchSizeLabel.style.fontSize = '13px';
        batchSizeLabel.style.color = 'var(--vc-accents-5)';
        batchSizeLabel.style.display = 'block';
        batchSizeLabel.style.marginBottom = '4px';

        const batchSizeInput = document.createElement('input');
        batchSizeInput.type = 'number';
        batchSizeInput.id = 'vc-batch-size';
        batchSizeInput.className = 'vc-input';
        batchSizeInput.value = storage.get(CONFIG.BATCH_SIZE_KEY, CONFIG.DEFAULT_BATCH_SIZE);
        batchSizeInput.min = '5';
        batchSizeInput.max = '100';
        batchSizeInput.placeholder = '默认 10';

        batchSizeWrapper.appendChild(batchSizeLabel);
        batchSizeWrapper.appendChild(batchSizeInput);

        // 并发数设置
        const concurrencyWrapper = document.createElement('div');

        const concurrencyLabel = document.createElement('label');
        concurrencyLabel.textContent = '并发翻译数：';
        concurrencyLabel.style.fontSize = '13px';
        concurrencyLabel.style.color = 'var(--vc-accents-5)';
        concurrencyLabel.style.display = 'block';
        concurrencyLabel.style.marginBottom = '4px';

        const concurrencyInput = document.createElement('input');
        concurrencyInput.type = 'number';
        concurrencyInput.id = 'vc-concurrency';
        concurrencyInput.className = 'vc-input';
        concurrencyInput.value = storage.get(CONFIG.CONCURRENCY_KEY, CONFIG.DEFAULT_CONCURRENCY);
        concurrencyInput.min = '1';
        concurrencyInput.max = '9999';
        concurrencyInput.placeholder = '默认 2';

        concurrencyWrapper.appendChild(concurrencyLabel);
        concurrencyWrapper.appendChild(concurrencyInput);

        const bufferWrapper = document.createElement('div');
        bufferWrapper.style.marginTop = '12px';

        const bufferLabel = document.createElement('label');
        bufferLabel.textContent = '可见区域缓冲(px)：';
        bufferLabel.style.fontSize = '13px';
        bufferLabel.style.color = 'var(--vc-accents-5)';
        bufferLabel.style.display = 'block';
        bufferLabel.style.marginBottom = '4px';

        const bufferInput = document.createElement('input');
        bufferInput.type = 'number';
        bufferInput.id = 'vc-visibility-buffer';
        bufferInput.className = 'vc-input';
        bufferInput.value = storage.get(CONFIG.VISIBILITY_BUFFER_KEY, CONFIG.DEFAULT_VISIBILITY_BUFFER);
        bufferInput.min = '0';
        bufferInput.max = '2000';
        bufferInput.placeholder = String(CONFIG.DEFAULT_VISIBILITY_BUFFER);

        bufferWrapper.appendChild(bufferLabel);
        bufferWrapper.appendChild(bufferInput);

        const speedHint = document.createElement('div');
        speedHint.className = 'vc-hint';
        speedHint.textContent = '提示：增加数值可提高翻译速度，但可能增加 API 消耗';

        speedGroup.appendChild(speedLabel);
        speedGroup.appendChild(batchSizeWrapper);
        speedGroup.appendChild(concurrencyWrapper);
        speedGroup.appendChild(bufferWrapper);
        speedGroup.appendChild(speedHint);

        // 6. 工具栏
        const toolsGroup = document.createElement('div');
        toolsGroup.className = 'vc-tools';

        const cacheStats = document.createElement('span');
        cacheStats.style.fontSize = '13px';
        cacheStats.style.color = 'var(--vc-accents-5)';
        cacheStats.textContent = `缓存: ${cache.cache.size} 条`;

        const clearCacheBtn = document.createElement('button');
        clearCacheBtn.className = 'vc-btn vc-btn-secondary vc-btn-sm';
        clearCacheBtn.textContent = '清空缓存';
        clearCacheBtn.onclick = () => {
             if (confirm('确定要清空所有翻译缓存吗？')) {
                cache.clear();
                alert('✅ 缓存已清空！');
                closeDialog();
            }
        };

        const testBtn = document.createElement('button');
        testBtn.className = 'vc-btn vc-btn-secondary vc-btn-sm';
        testBtn.textContent = '测试连接';
        
        const testResult = document.createElement('span');
        testResult.className = 'vc-status-text';
        
        testBtn.onclick = async () => {
            const apiKey = keyInput.value.trim();
            const endpoint = endpointInput.value.trim();
            let modelName = modelSelect.value;

            // 如果选择了自定义模型，使用自定义输入框的值
            if (modelName === 'custom') {
                modelName = customModelInput.value.trim();
            }

            if (!apiKey) {
                alert('⚠️ 请先输入 API 密钥');
                keyInput.focus();
                return;
            }

            if (!endpoint) {
                alert('⚠️ 请先输入 API 接入点');
                endpointInput.focus();
                return;
            }

            testResult.textContent = '测试中...';
            testResult.style.color = 'var(--vc-warning)';
            testBtn.disabled = true;

            try {
                await translateWithDeepL(['Hello'], { apiKey, endpoint, modelName });
                testResult.textContent = '✅ 连接成功';
                testResult.style.color = 'var(--vc-success)';
            } catch (err) {
                testResult.textContent = '❌ 连接失败';
                testResult.style.color = 'var(--vc-error)';

                // 显示详细的错误诊断
                showErrorDiagnosis(err, endpoint, modelName);
            } finally {
                testBtn.disabled = false;
            }
        };

        const troubleshootBtn = document.createElement('button');
        troubleshootBtn.className = 'vc-btn vc-btn-secondary vc-btn-sm';
        troubleshootBtn.textContent = '故障排查';
        troubleshootBtn.onclick = () => showTroubleshootGuide();

        const historyBtn = document.createElement('button');
        historyBtn.className = 'vc-btn vc-btn-secondary vc-btn-sm';
        historyBtn.textContent = '历史记录';

        toolsGroup.appendChild(cacheStats);
        toolsGroup.appendChild(clearCacheBtn);
        toolsGroup.appendChild(testBtn);
        toolsGroup.appendChild(troubleshootBtn);
        toolsGroup.appendChild(historyBtn);
        toolsGroup.appendChild(testResult);

        // 6. 历史记录面板
        const historyContainer = document.createElement('div');
        historyContainer.className = 'vc-history-panel';

        historyBtn.onclick = () => {
            if (historyContainer.style.display === 'none' || !historyContainer.style.display) {
                renderHistoryList(historyContainer);
                historyContainer.style.display = 'block';
            } else {
                historyContainer.style.display = 'none';
            }
        };

        content.appendChild(aiGroup);
        content.appendChild(modelGroup);
        content.appendChild(endpointGroup);
        content.appendChild(keyGroup);
        content.appendChild(speedGroup);
        content.appendChild(toolsGroup);
        content.appendChild(historyContainer);

        // === 底部按钮 ===
        const footer = document.createElement('div');
        footer.className = 'vc-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'vc-btn vc-btn-secondary';
        cancelBtn.textContent = '取消';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'vc-btn vc-btn-primary';
        saveBtn.textContent = '保存设置';

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);

        dialog.appendChild(header);
        dialog.appendChild(content);
        dialog.appendChild(footer);

        document.body.appendChild(overlay);
        document.body.appendChild(dialog);

        // === 事件监听 ===
        const closeDialog = () => {
            overlay.remove();
            dialog.remove();
        };

        closeBtn.onclick = closeDialog;
        overlay.onclick = (e) => {
             if (e.target === overlay) closeDialog();
        };
        cancelBtn.onclick = closeDialog;

        saveBtn.onclick = () => {
            const newKey = keyInput.value.trim();
            const newEndpoint = endpointInput.value.trim();
            let newModel = modelSelect.value;
            const newEnabled = aiCheckbox.checked;
            const newDebugEnabled = debugCheckbox.checked;
            const newBatchSize = parseInt(batchSizeInput.value) || CONFIG.DEFAULT_BATCH_SIZE;
            const newConcurrency = parseInt(concurrencyInput.value) || CONFIG.DEFAULT_CONCURRENCY;
            const newVisibilityBuffer = parseInt(bufferInput.value) || CONFIG.DEFAULT_VISIBILITY_BUFFER;

            // 如果选择了自定义模型，使用自定义输入框的值
            if (newModel === 'custom') {
                const customModel = customModelInput.value.trim();
                if (!customModel) {
                    alert('⚠️ 请输入自定义模型名称');
                    customModelInput.focus();
                    return;
                }
                newModel = customModel;
            }

            // 验证速度设置范围
            if (newBatchSize < 5 || newBatchSize > 100) {
                alert('⚠️ 批量大小必须在 5-100 之间');
                batchSizeInput.focus();
                return;
            }

            if (newConcurrency < 1 || newConcurrency > 9999) {
                alert('⚠️ 并发数必须在 1-9999 之间');
                concurrencyInput.focus();
                return;
            }

            if (newVisibilityBuffer < 0 || newVisibilityBuffer > 2000) {
                alert('⚠️ 可见区域缓冲必须在 0-2000 之间');
                bufferInput.focus();
                return;
            }

            storage.set(CONFIG.API_KEY_KEY, newKey);
            storage.set(CONFIG.API_ENDPOINT_KEY, newEndpoint);
            storage.set(CONFIG.MODEL_NAME_KEY, newModel);
            storage.set(CONFIG.AI_ENABLED_KEY, newEnabled);
            storage.set(CONFIG.DEBUG_ENABLED_KEY, newDebugEnabled);
            storage.set(CONFIG.BATCH_SIZE_KEY, newBatchSize);
            storage.set(CONFIG.CONCURRENCY_KEY, newConcurrency);
            storage.set(CONFIG.VISIBILITY_BUFFER_KEY, newVisibilityBuffer);

            closeDialog();
            alert('✅ 设置已保存！刷新页面生效。');
        };
    }

    // ==================== 错误诊断和故障排查 ====================
    function showErrorDiagnosis(error, endpoint, modelName) {
        const errorMsg = error.message || '未知错误';
        let diagnosis = `❌ 连接失败\n\n错误信息：${errorMsg}\n\n`;

        // 提取域名用于诊断
        let domain = '';
        try {
            const url = new URL(endpoint);
            domain = url.hostname;
        } catch (e) {
            domain = endpoint;
        }

        // 根据错误类型提供诊断
        if (errorMsg.includes('网络请求失败') || errorMsg.includes('Tampermonkey')) {
            diagnosis += `🔍 检测到 Tampermonkey CORS 限制问题！

⚠️ 核心原因：
您使用的 API 域名 "${domain}" 未在脚本的 @connect 白名单中。

✅ 立即解决方法（2选1）：

【方法1 - 手动添加域名（推荐）】
1. 点击浏览器右上角 Tampermonkey 图标
2. 点击"管理面板"
3. 找到"通用网页翻译 (AI 增强版)"，点击编辑
4. 在脚本开头找到 @connect 部分
5. 添加一行：// @connect ${domain}
6. 保存脚本（Ctrl+S）
7. 刷新页面重试

【方法2 - 临时允许所有域名】
1. 打开 Tampermonkey 管理面板
2. 点击"设置"标签
3. 找到"安全"部分
4. 将 "@connect 策略" 改为 "允许所有域名"
⚠️ 注意：此方法降低安全性，仅建议测试使用

📌 当前配置：
   API端点: ${endpoint}
   域名: ${domain}

💡 添加后效果：
脚本头部会包含：
// @connect ${domain}`;
        } else if (errorMsg.includes('请求超时')) {
            diagnosis += `🔍 可能原因：
1. 网络延迟过高
2. API服务器响应缓慢
3. 防火墙拦截导致超时

💡 解决方法：
1. 检查网络连接质量
2. 更换速度更快的API端点
3. 联系API服务商确认服务状态`;
        } else if (errorMsg.includes('API 配额已用完')) {
            diagnosis += `🔍 原因：API调用次数已达上限

💡 解决方法：
1. 等待配额重置（通常为每月1日）
2. 升级到付费计划
3. 更换其他API密钥或服务商`;
        } else if (errorMsg.includes('API 密钥无效')) {
            diagnosis += `🔍 原因：API密钥格式错误或已失效

💡 解决方法：
1. 重新检查API密钥是否完整复制
2. 确认API密钥未过期
3. 在API服务商后台重新生成密钥`;
        } else if (errorMsg.includes('HTTP')) {
            diagnosis += `🔍 原因：服务器返回错误状态码

💡 解决方法：
1. 检查API端点是否正确
2. 确认所选模型名称是否正确
   当前: ${modelName}
3. 查看浏览器控制台获取详细错误信息`;
        }

        diagnosis += `\n\n📝 详细日志请查看浏览器控制台（F12）`;

        alert(diagnosis);
    }

    function showTroubleshootGuide() {
        const guide = `🔧 通用网页翻译插件 - 故障排查指南

━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ 最常见问题：自定义 API 域名 CORS 错误

如果您使用自定义 API 端点（如中转服务），需要手动添加域名：

【解决步骤】
1. 打开 Tampermonkey 管理面板
2. 找到"通用网页翻译 (AI 增强版)"，点击编辑
3. 在脚本开头找到这些行：
   // @connect api-free.deepl.com
   // @connect api.deepl.com
   // @connect api.openai.com
   // @connect api.anthropic.com
   // @connect *

4. 在 // @connect * 这行之前添加您的域名：
   // @connect your-domain.com

5. 保存脚本（Ctrl+S 或 Cmd+S）
6. 刷新页面重试

【示例】
如果您的 API 地址是：https://api.example.com/v1/chat/completions
则添加：// @connect api.example.com

━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ 检查基础配置
   ✓ API密钥是否正确填写
   ✓ API端点URL是否完整（需包含 https://）
   ✓ 翻译模型是否选择正确

2️⃣ Tampermonkey 设置检查
   ✓ 确认脚本已启用
   ✓ 检查 @connect 是否包含您的 API 域名
   ✓ 尝试在设置中允许所有域名（测试用）

3️⃣ 网络连接测试
   ✓ 尝试在浏览器中直接访问API端点
   ✓ 检查是否有VPN/代理干扰
   ✓ 关闭广告拦截器重试

4️⃣ API服务商特定问题

   【DeepL】
   • 免费版端点：https://api-free.deepl.com/v2/translate
   • 付费版端点：https://api.deepl.com/v2/translate
   • 获取密钥：https://www.deepl.com/pro-api

   【Gemini (Google AI) - 推荐小模型】
   • 端点：https://generativelanguage.googleapis.com/v1beta/chat/completions
   • 模型示例：gemini-2.5-flash-lite, gemini-2.5-flash-exp, gemini-1.5-flash
   • 获取密钥：https://aistudio.google.com/apikey
   • 特点：速度快、成本低、效果好

   【OpenAI】
   • 端点：https://api.openai.com/v1/chat/completions
   • 模型示例：gpt-4o-mini, gpt-3.5-turbo
   • 获取密钥：https://platform.openai.com/api-keys

   【Claude (Anthropic)】
   • 端点：https://api.anthropic.com/v1/messages
   • 模型示例：claude-3-haiku-20240307
   • 获取密钥：https://console.anthropic.com/

   【自定义中转/第三方API】
   • 必须手动添加域名到 @connect 列表
   • 确认中转服务支持 OpenAI 兼容格式
   • 选择正确的模型名称
   • 小模型推荐：gemini-2.5-flash-lite, gpt-4o-mini

5️⃣ 常见错误代码
   • 403：API密钥无效
   • 429：配额已用完或请求过快
   • 500：API服务器错误
   • 网络请求失败：通常是 @connect 限制
   • CORS错误：100% 是 @connect 问题

6️⃣ 仍然无法解决？
   • 打开浏览器控制台（F12）查看详细错误
   • 使用"测试连接"功能获取诊断信息
   • 访问项目 GitHub 提交 Issue
   • 确保 Tampermonkey 版本是最新的

━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        alert(guide);
    }

    // ==================== DOM 翻译逻辑 ====================
    function replaceText(rootNode) {
        if (!rootNode || shouldIgnoreNode(rootNode)) return;

        // 处理所有文本节点
        const textWalker = document.createTreeWalker(
            rootNode,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                    if (node.parentNode && shouldIgnoreNode(node.parentNode)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
        );

        let textNode;
        while (textNode = textWalker.nextNode()) {
            translateTextNode(textNode);
        }

        // 处理元素属性
        const elementWalker = document.createTreeWalker(
            rootNode,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: function(node) {
                    if (shouldIgnoreNode(node)) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
        );

        let element;
        while (element = elementWalker.nextNode()) {
            if (element.hasAttribute('title')) {
                translateAttribute(element, 'title');
            }
            if (element.hasAttribute('placeholder')) {
                translateAttribute(element, 'placeholder');
            }
            if (element.hasAttribute('aria-label')) {
                translateAttribute(element, 'aria-label');
            }
            if ((element.tagName === 'INPUT' || element.tagName === 'BUTTON') &&
                element.hasAttribute('value') &&
                element.getAttribute('type') !== 'password') {
                translateAttribute(element, 'value');
            }
        }
    }

    // 处理 DOM 变化
    function processMutations(mutations) {
        mutations.forEach(mutation => {
            // 处理新增节点
            mutation.addedNodes.forEach(addedNode => {
                if (addedNode.nodeType === 1) { // 元素节点
                    replaceText(addedNode);
                } else if (addedNode.nodeType === 3) { // 文本节点
                    if (addedNode.nodeValue && addedNode.nodeValue.trim()) {
                        translateTextNode(addedNode);
                    }
                }
            });

            // 🔧 修复：保留 characterData 监听但增加保护条件
            // 原因：实时更新的内容（计数器、状态等）需要重新翻译
            // 保护：跳过已翻译为中文的内容，避免死循环
            if (mutation.type === 'characterData') {
                const target = mutation.target;
                if (target && target.nodeValue && target.nodeValue.trim() &&
                    !shouldIgnoreNode(target.parentNode)) {

                    // 🔧 修复：跳过正在被翻译的节点，防止死循环
                    if (translatingNodes.has(target)) {
                        logDebug('characterData 跳过', '节点正在被翻译');
                        return;
                    }

                    const oldValue = typeof mutation.oldValue === 'string' ? mutation.oldValue : '';
                    const newValue = target.nodeValue;
                    const oldTrimmed = oldValue.trim();
                    const newTrimmed = newValue.trim();

                    // 🔧 修复：检测中文→英文回退（框架重渲染导致），直接从缓存或节点记录恢复
                    if (oldTrimmed && isPrimarilyChinese(oldTrimmed) && newTrimmed && !isPrimarilyChinese(newTrimmed)) {
                        logDebug('characterData 检测到回退', `"${oldTrimmed}" → "${newTrimmed}"`);
                        const nodeRecord = nodeTranslationMap.get(target);
                        if (nodeRecord && nodeRecord.original === newTrimmed) {
                            logDebug('characterData 节点记录恢复', `"${newTrimmed}" → "${nodeRecord.translated}"`);
                            const escapedText = newTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            target.nodeValue = newValue.replace(new RegExp(escapedText, 'g'), nodeRecord.translated);
                            return;
                        }
                        // skipLRU=true 减少缓存维护开销
                        const cached = cache.get(newTrimmed, true);
                        if (cached && cached !== newTrimmed) {
                            logDebug('characterData 从缓存恢复', `"${newTrimmed}" → "${cached}"`);
                            // 🔧 使用全局替换
                            const escapedText = newTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            target.nodeValue = newValue.replace(new RegExp(escapedText, 'g'), cached);
                            return;
                        }
                    }

                    const text = newTrimmed;

                    // 🔧 关键保护：如果包含中文，跳过翻译（避免中文/英文反复横跳）
                    if (containsChinese(text)) {
                        logDebug('characterData 跳过', `文本包含中文: "${text}"`);
                        return;
                    }

                    // 🔧 修复：仅检查缓存，不再以术语表英文作为"已处理"条件
                    // 如果缓存命中，直接应用缓存的翻译（避免英文状态被保留）
                    // skipLRU=true 减少缓存维护开销
                    const cached = cache.get(text, true);
                    if (cached) {
                        logDebug('characterData 命中缓存', `缓存翻译: "${text}" → "${cached}"`);

                        // 如果缓存值与原文相同，说明这个词没有对应的中文翻译，保持原文即可
                        if (cached === text) {
                            logDebug('characterData 保持原文', `无中文翻译: "${text}"`);
                            return;
                        }

                        // 🔧 修复：使用全局替换，避免只替换首次匹配
                        const fullText = target.nodeValue;
                        if (fullText && fullText.trim() === text) {
                            const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            target.nodeValue = fullText.replace(new RegExp(escapedText, 'g'), cached);
                        } else {
                            logDebug('characterData 跳过替换', `节点文本不完全匹配: "${fullText}"`);
                        }
                        return;
                    }

                    // 新的英文内容，需要翻译
                    logDebug('characterData 触发翻译', `新内容: "${text}"`);
                    translateTextNode(target);
                }
            }

            // 处理属性变化
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                if (target && !shouldIgnoreNode(target)) {
                    if (['title', 'placeholder', 'aria-label'].includes(mutation.attributeName)) {
                        translateAttribute(target, mutation.attributeName);
                    }
                }
            }
        });
    }

    // ==================== SPA 路由切换支持 ====================
    // 🔧 修复：监听路由变化，在 SPA 切换时触发翻译
    function scheduleFullPageTranslate(reason) {
        clearTimeout(routeTranslateTimer);
        routeTranslateTimer = setTimeout(() => {
            logDebug('路由翻译触发', reason || 'unknown');
            replaceText(document.body);
            // 🔧 路由切换后启动定期检查，处理懒加载内容
            startPeriodicCheck();
        }, 300);
    }

    // 🔧 新增：定期检查未翻译的节点（处理懒加载）
    function startPeriodicCheck() {
        // 清除之前的定时器
        if (periodicCheckTimer) {
            clearInterval(periodicCheckTimer);
        }

        let checkCount = 0;
        const maxChecks = 10; // 最多检查10次（约30秒）

        periodicCheckTimer = setInterval(() => {
            checkCount++;
            const now = Date.now();

            // 避免频繁检查（至少间隔3秒）
            if (now - lastCheckTime < 3000) {
                return;
            }
            lastCheckTime = now;

            logDebug('定期检查懒加载内容', `第 ${checkCount} 次`);
            replaceText(document.body);

            // 达到最大检查次数后停止
            if (checkCount >= maxChecks) {
                clearInterval(periodicCheckTimer);
                periodicCheckTimer = null;
                logDebug('定期检查结束', `共检查 ${checkCount} 次`);
            }
        }, 3000); // 每3秒检查一次
    }

    function hookHistoryEvents() {
        if (historyHooked) return;
        historyHooked = true;

        const emit = () => window.dispatchEvent(new Event('vc:locationchange'));
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
            const result = originalPushState.apply(this, args);
            emit();
            return result;
        };

        history.replaceState = function(...args) {
            const result = originalReplaceState.apply(this, args);
            emit();
            return result;
        };

        window.addEventListener('popstate', emit);
        window.addEventListener('hashchange', emit);

        console.log('[网页翻译] SPA 路由监听已启用');
    }

    // ==================== 初始化 ====================
    function init() {
        console.log('[网页翻译] 初始化中...');

        // 注入样式
        injectStyles();

        // 注册菜单命令（总是注册，方便用户管理白名单）
        GM_registerMenuCommand('⚙️ 翻译设置', showConfigDialog);
        GM_registerMenuCommand('📥 导出词典 JSON', exportDictionaryJson);
        GM_registerMenuCommand('📤 导入词典 JSON', importDictionaryJson);

        // 白名单管理菜单
        GM_registerMenuCommand('✅ 将此网站加入翻译名单', () => {
            const domain = getCurrentDomain();
            if (isInWhitelist(domain)) {
                alert(`${domain} 已在翻译名单中`);
            } else {
                addToWhitelist(domain);
                alert(`已添加 ${domain} 到翻译名单\n\n页面将自动刷新以开始翻译`);
                location.reload();
            }
        });

        GM_registerMenuCommand('❌ 将此网站移出翻译名单', () => {
            const domain = getCurrentDomain();
            if (!isInWhitelist(domain)) {
                alert(`${domain} 不在翻译名单中`);
            } else {
                if (confirm(`确定要将 ${domain} 移出翻译名单吗？`)) {
                    removeFromWhitelist(domain);
                    alert(`已将 ${domain} 移出翻译名单\n\n页面将自动刷新`);
                    location.reload();
                }
            }
        });

        GM_registerMenuCommand('📋 查看翻译名单', () => {
            alert(getWhitelistDisplay());
        });

        // 检查当前域名是否在白名单中
        const domain = getCurrentDomain();
        if (!isInWhitelist(domain)) {
            console.log(`[网页翻译] ${domain} 不在翻译名单中，跳过翻译`);
            console.log('[网页翻译] 提示：点击 Tampermonkey 图标 → 本脚本菜单 → "✅ 将此网站加入翻译名单" 来启用翻译');
            return; // 不在白名单中，直接返回
        }

        console.log(`[网页翻译] ${domain} 在翻译名单中，开始初始化翻译功能`);

        // 初始化翻译队列
        const batchSize = storage.get(CONFIG.BATCH_SIZE_KEY, CONFIG.DEFAULT_BATCH_SIZE);
        const concurrency = storage.get(CONFIG.CONCURRENCY_KEY, CONFIG.DEFAULT_CONCURRENCY);
        translationQueue = new TranslationQueue(processBatch, CONFIG.QUEUE_DELAY, batchSize, concurrency);
        updateProgressUI();
        // 🔧 修复：监听 SPA 路由变化
        hookHistoryEvents();
        window.addEventListener('vc:locationchange', () => scheduleFullPageTranslate('locationchange'));

        // 初始翻译
        setTimeout(() => {
            replaceText(document.body);
            // 🔧 初始加载后也启动定期检查，处理懒加载内容
            startPeriodicCheck();
        }, 800);

        // 监听 DOM 变更
        const bodyObserver = new MutationObserver(mutations => {
            // 🔧 修复：累积 mutation 队列，避免节流丢失批次
            mutationQueue.push(...mutations);
            clearTimeout(mutationTimer);
            mutationTimer = setTimeout(() => {
                const queued = mutationQueue.splice(0, mutationQueue.length);
                processMutations(queued);
            }, 100);
        });

        bodyObserver.observe(document.body, {
            childList: true,        // 监听子节点增删
            subtree: true,          // 监听所有后代节点
            characterData: true,    // 🔧 恢复监听文本变化（已添加保护避免死循环）
            characterDataOldValue: true, // 🔧 修复：获取 oldValue 以识别中文→英文回退
            attributes: true,       // 监听属性变化
            attributeFilter: ['title', 'placeholder', 'aria-label']
        });

        // 页面加载完成后再翻译一次
        window.addEventListener('load', function() {
            setTimeout(() => {
                replaceText(document.body);
            }, 1000);
        });

        console.log('[网页翻译] 初始化完成');
        console.log(`- 当前域名: ${domain}`);
        console.log(`- 缓存键: ${getDomainCacheKey(domain)}`);
        console.log(`- 缓存: ${cache.cache.size} 条`);
        console.log(`- AI翻译: ${storage.get(CONFIG.AI_ENABLED_KEY, false) ? '已启用' : '未启用'}`);
        console.log(`- 可见区域翻译: 已启用`);
        console.log(`- 调试模式: ${storage.get(CONFIG.DEBUG_ENABLED_KEY, false) ? '已开启' : '未开启'}`);
        console.log(`- 可见区域缓冲: ±${storage.get(CONFIG.VISIBILITY_BUFFER_KEY, CONFIG.DEFAULT_VISIBILITY_BUFFER)}px`);
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
