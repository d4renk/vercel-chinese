// ==UserScript==
// @name        Vercel 汉化 (AI 增强版)
// @namespace   https://github.com/liyixin21/vercel-chinese
// @description 汉化 Vercel 界面 (支持 AI 自动翻译)
// @version     0.2.0
// @author      liyixin21
// @license     GPL-3.0
// @match       *://*.vercel.app/*
// @match       *://vercel.com/*
// @match       *://*.vercel.com/*
// @icon        https://assets.vercel.com/image/upload/v1607554385/repositories/vercel/logo.png
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @connect     api-free.deepl.com
// @connect     api.deepl.com
// @connect     api.openai.com
// @connect     api.anthropic.com
// @connect     *
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置常量 ====================
    const CONFIG = {
        AI_ENABLED_KEY: 'vc_ai_translate_enabled',
        API_KEY_KEY: 'vc_deepl_api_key',
        API_ENDPOINT_KEY: 'vc_api_endpoint',
        MODEL_NAME_KEY: 'vc_model_name',
        CACHE_KEY: 'vc_ai_cache_v1',
        CACHE_TTL_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
        CACHE_MAX: 5000,
        BATCH_SIZE: 20,
        QUEUE_DELAY: 100, // ms
        LANG: 'zh-CN',
        DEFAULT_ENDPOINT: 'https://api-free.deepl.com/v2/translate',
        DEFAULT_MODEL: 'deepl'
    };

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

    // ==================== 核心术语表（200 词，即时翻译）====================
    const CORE_TERMS = new Map([
        // 核心导航 (15)
        ['Dashboard', '仪表盘'],
        ['Projects', '项目'],
        ['Project', '项目'],
        ['Analytics', '分析'],
        ['Domains', '域名'],
        ['Domain', '域名'],
        ['Usage', '用量'],
        ['Settings', '设置'],
        ['Help', '帮助'],
        ['Log Out', '退出登录'],
        ['Activity', '活动'],
        ['Deployments', '部署'],
        ['Deployment', '部署'],
        ['Team', '团队'],
        ['Teams', '团队'],

        // 部署相关 (25)
        ['Deploy', '部署'],
        ['Deploying', '部署中'],
        ['Deployed', '已部署'],
        ['Redeploy', '重新部署'],
        ['Production', '生产环境'],
        ['Preview', '预览环境'],
        ['Development', '开发环境'],
        ['Preview Deployment', '预览部署'],
        ['Production Deployment', '生产部署'],
        ['Deployment Status', '部署状态'],
        ['Deployment Details', '部署详情'],
        ['Building', '构建中'],
        ['Build', '构建'],
        ['Build Logs', '构建日志'],
        ['Deployment failed', '部署失败'],
        ['Deployment succeeded', '部署成功'],
        ['Deployment canceled', '部署已取消'],
        ['Ready', '就绪'],
        ['Queued', '排队中'],
        ['Canceled', '已取消'],
        ['Failed', '失败'],
        ['Rollback', '回滚'],
        ['Instant Rollback', '即时回滚'],
        ['Cancel', '取消'],
        ['Retry', '重试'],

        // Git 集成 (15)
        ['Branch', '分支'],
        ['Commit', '提交'],
        ['Repository', '仓库'],
        ['Git Repository', 'Git 仓库'],
        ['Connect Git Repository', '连接Git仓库'],
        ['GitHub', 'GitHub'],
        ['GitLab', 'GitLab'],
        ['Bitbucket', 'Bitbucket'],
        ['Connected', '已连接'],
        ['Disconnect', '断开连接'],
        ['Clone', '克隆'],
        ['Main Branch', '主分支'],
        ['Pull Request', '拉取请求'],
        ['Deploy Hook', '部署钩子'],
        ['Source', '源码'],

        // 项目设置 (15)
        ['Project Settings', '项目设置'],
        ['General', '常规'],
        ['Environment Variables', '环境变量'],
        ['Integration', '集成'],
        ['Integrations', '集成服务'],
        ['Framework', '框架'],
        ['Root Directory', '根目录'],
        ['Build Command', '构建命令'],
        ['Output Directory', '输出目录'],
        ['Install Command', '安装命令'],
        ['Configure', '配置'],
        ['Configuration', '配置'],
        ['Override', '覆盖'],
        ['Detect Automatically', '自动检测'],
        ['Project Name', '项目名称'],

        // 域名 (15)
        ['Add Domain', '添加域名'],
        ['Custom Domain', '自定义域名'],
        ['Primary Domain', '主域名'],
        ['DNS', 'DNS'],
        ['DNS Settings', 'DNS设置'],
        ['SSL', 'SSL'],
        ['SSL Certificate', 'SSL证书'],
        ['HTTPS', 'HTTPS'],
        ['Certificate', '证书'],
        ['Verify', '验证'],
        ['Verification', '验证'],
        ['Redirect', '重定向'],
        ['Redirects', '重定向'],
        ['Alias', '别名'],
        ['Nameservers', '域名服务器'],

        // 环境变量 (10)
        ['Add Environment Variable', '添加环境变量'],
        ['Name', '名称'],
        ['Value', '值'],
        ['Production Only', '仅生产环境'],
        ['Preview Only', '仅预览环境'],
        ['Development Only', '仅开发环境'],
        ['All Environments', '所有环境'],
        ['Secret', '密钥'],
        ['Plain Text', '纯文本'],
        ['Environment', '环境'],

        // 团队与成员 (15)
        ['Members', '成员'],
        ['Member', '成员'],
        ['Invite Member', '邀请成员'],
        ['Owner', '所有者'],
        ['Roles', '角色'],
        ['Role', '角色'],
        ['Permissions', '权限'],
        ['Admin', '管理员'],
        ['Developer', '开发者'],
        ['Viewer', '查看者'],
        ['Remove Member', '移除成员'],
        ['Transfer Ownership', '转让所有权'],
        ['Leave Team', '离开团队'],
        ['Personal Account', '个人账户'],
        ['Team Account', '团队账户'],

        // 状态与通知 (10)
        ['Success', '成功'],
        ['Error', '错误'],
        ['Warning', '警告'],
        ['Loading', '加载中'],
        ['Notification', '通知'],
        ['Notifications', '通知'],
        ['Status', '状态'],
        ['Enable', '启用'],
        ['Disable', '禁用'],
        ['Info', '信息'],

        // 核心操作按钮 (20)
        ['Save', '保存'],
        ['Delete', '删除'],
        ['Create', '创建'],
        ['Edit', '编辑'],
        ['Update', '更新'],
        ['Add', '添加'],
        ['Remove', '移除'],
        ['Confirm', '确认'],
        ['Continue', '继续'],
        ['Submit', '提交'],
        ['Apply', '应用'],
        ['Copy', '复制'],
        ['Copied!', '已复制!'],
        ['Download', '下载'],
        ['Upload', '上传'],
        ['Search', '搜索'],
        ['Filter', '筛选'],
        ['Refresh', '刷新'],
        ['View', '查看'],
        ['Manage', '管理'],

        // 账单与套餐 (10)
        ['Billing', '账单'],
        ['Plan', '套餐'],
        ['Hobby', '业余版'],
        ['Pro', '专业版'],
        ['Enterprise', '企业版'],
        ['Free', '免费'],
        ['Upgrade Plan', '升级套餐'],
        ['Invoice', '发票'],
        ['Current Plan', '当前套餐'],
        ['Usage Metrics', '用量指标'],

        // 日志与监控 (10)
        ['Logs', '日志'],
        ['Runtime Logs', '运行时日志'],
        ['Function Logs', '函数日志'],
        ['Edge Function Logs', '边缘函数日志'],
        ['Monitoring', '监控'],
        ['Observability', '可观测性'],
        ['Metrics', '指标'],
        ['Traces', '追踪'],
        ['Diagnostics', '诊断'],
        ['Health', '健康状态'],

        // Vercel 特有概念 (15)
        ['Serverless Functions', '无服务器函数'],
        ['Edge Functions', '边缘函数'],
        ['Edge Network', '边缘网络'],
        ['CDN', 'CDN'],
        ['Cache', '缓存'],
        ['Caching', '缓存'],
        ['Edge Requests', '边缘请求'],
        ['Function Invocations', '函数调用'],
        ['Web Vitals', 'Web指标'],
        ['Speed Insights', '速度洞察'],
        ['Real User Monitoring', '真实用户监控'],
        ['Firewall', '防火墙'],
        ['Rate Limit', '速率限制'],
        ['Storage', '存储'],
        ['Security', '安全'],

        // 其他高频词 (15)
        ['Import', '导入'],
        ['Import Project', '导入项目'],
        ['New Project', '新项目'],
        ['Create New Project', '创建新项目'],
        ['Template', '模板'],
        ['Visit', '访问'],
        ['Overview', '概览'],
        ['Details', '详情'],
        ['Documentation', '文档'],
        ['Support', '支持'],
        ['Close', '关闭'],
        ['Show', '显示'],
        ['Hide', '隐藏'],
        ['Back', '返回'],
        ['Next', '下一步']
    ]);

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
                const stored = GM_getValue(this.storageKey, '{}');
                const data = JSON.parse(stored);
                const now = Date.now();

                Object.entries(data).forEach(([key, item]) => {
                    if (now - item.timestamp < this.ttl) {
                        this.cache.set(key, item);
                    }
                });

                console.log(`[Vercel汉化] 从缓存加载了 ${this.cache.size} 条翻译`);
            } catch (e) {
                console.warn('[Vercel汉化] 缓存加载失败:', e);
                this.cache = new Map();
            }
        }

        get(key) {
            const item = this.cache.get(key);
            if (!item) return null;

            // 检查是否过期
            if (Date.now() - item.timestamp > this.ttl) {
                this.cache.delete(key);
                return null;
            }

            // LRU: 移到最后
            this.cache.delete(key);
            this.cache.set(key, item);

            return item.value;
        }

        set(key, value) {
            // 删除旧的
            this.cache.delete(key);

            // 如果超过限制，删除最旧的（第一个）
            if (this.cache.size >= this.maxSize) {
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
                GM_setValue(this.storageKey, JSON.stringify(data));
            } catch (e) {
                console.warn('[Vercel汉化] 缓存保存失败:', e);
            }
        }

        clear() {
            this.cache.clear();
            GM_setValue(this.storageKey, '{}');
        }
    }

    // ==================== 翻译队列实现 ====================
    class TranslationQueue {
        constructor(processor, delay, batchSize) {
            this.processor = processor;
            this.delay = delay;
            this.batchSize = batchSize;
            this.queue = [];
            this.timer = null;
            this.processing = false;
        }

        enqueue(item) {
            // 去重
            if (!this.queue.some(q => q.text === item.text)) {
                this.queue.push(item);
            }

            // 防抖
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.flush(), this.delay);
        }

        async flush() {
            if (this.processing || this.queue.length === 0) return;

            this.processing = true;

            // 取出批量
            const batch = this.queue.splice(0, this.batchSize);

            try {
                await this.processor(batch);
            } catch (e) {
                console.error('[Vercel汉化] 批量翻译失败:', e);
            } finally {
                this.processing = false;

                // 如果还有剩余，继续处理
                if (this.queue.length > 0) {
                    this.timer = setTimeout(() => this.flush(), this.delay);
                }
            }
        }
    }

    // ==================== 全局状态 ====================
    const cache = new LRUCache(CONFIG.CACHE_MAX, CONFIG.CACHE_TTL_MS, CONFIG.CACHE_KEY);
    let translationQueue = null;

    // ==================== 翻译 API 集成 ====================
    async function translateWithDeepL(texts) {
        const apiKey = GM_getValue(CONFIG.API_KEY_KEY, '');
        const endpoint = GM_getValue(CONFIG.API_ENDPOINT_KEY, CONFIG.DEFAULT_ENDPOINT);
        const modelName = GM_getValue(CONFIG.MODEL_NAME_KEY, CONFIG.DEFAULT_MODEL);

        if (!apiKey) {
            throw new Error('未配置 API 密钥');
        }

        // 根据模型类型构建请求
        if (modelName === 'deepl') {
            // DeepL API 格式
            const params = texts.map(t => `text=${encodeURIComponent(t)}`).join('&');
            const data = `${params}&target_lang=ZH`;

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `DeepL-Auth-Key ${apiKey}`
                    },
                    data: data,
                    timeout: 10000,
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const body = JSON.parse(response.responseText);
                                resolve(body.translations.map(t => t.text));
                            } catch (e) {
                                reject(new Error('解析响应失败'));
                            }
                        } else if (response.status === 429) {
                            reject(new Error('API 配额已用完'));
                        } else if (response.status === 403) {
                            reject(new Error('API 密钥无效'));
                        } else {
                            reject(new Error(`HTTP ${response.status}`));
                        }
                    },
                    onerror: () => reject(new Error('网络请求失败')),
                    ontimeout: () => reject(new Error('请求超时'))
                });
            });
        } else {
            // OpenAI 兼容格式（GPT、Claude等）
            // 🔧 修复：批量处理所有文本
            const batchPrompt = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');
            const systemMessage = '你是一个专业的技术翻译助手。请将以下编号的英文文本逐行翻译成中文，保持编号格式，仅返回翻译结果，不要添加解释。';

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    data: JSON.stringify({
                        model: modelName,
                        messages: [
                            { role: 'system', content: systemMessage },
                            { role: 'user', content: batchPrompt }
                        ],
                        temperature: 0.3
                    }),
                    timeout: 15000,
                    onload: (response) => {
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
                                    console.warn('[Vercel汉化] 翻译结果数量不匹配');
                                    // 补齐缺失的翻译
                                    while (results.length < texts.length) {
                                        results.push(texts[results.length]);
                                    }
                                }

                                resolve(results);
                            } catch (e) {
                                reject(new Error('解析响应失败'));
                            }
                        } else {
                            reject(new Error(`HTTP ${response.status}`));
                        }
                    },
                    onerror: () => reject(new Error('网络请求失败')),
                    ontimeout: () => reject(new Error('请求超时'))
                });
            });
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

            translations.forEach((translated, idx) => {
                if (!translated) return;

                const original = uniqueTexts[idx];
                const itemsGroup = textToItems.get(original);

                // 保存到缓存
                cache.set(original, translated);

                // 🔧 修复：应用翻译到所有相同文本的节点
                itemsGroup.forEach(item => {
                    if (item.apply) {
                        item.apply(translated);
                    }
                });
            });

            // 持久化缓存
            cache.persist();

        } catch (error) {
            console.warn('[Vercel汉化] AI 翻译失败:', error.message);

            // 降级：使用原文
            textToItems.forEach(itemsGroup => {
                itemsGroup.forEach(item => {
                    if (item.apply) {
                        item.apply(item.text);
                    }
                });
            });
        }
    }

    // ==================== 核心翻译函数 ====================
    function translateText(text, context, applyCallback) {
        if (!text || !text.trim()) return;

        // 1. 检查核心术语
        const coreHit = CORE_TERMS.get(text);
        if (coreHit) {
            applyCallback(coreHit);
            return;
        }

        // 2. 检查缓存
        const cached = cache.get(text);
        if (cached) {
            applyCallback(cached);
            return;
        }

        // 3. 检查是否启用 AI 翻译
        const aiEnabled = GM_getValue(CONFIG.AI_ENABLED_KEY, false);
        if (!aiEnabled) {
            // 未启用AI，保持原文
            applyCallback(text);
            return;
        }

        // 4. 加入队列（异步翻译）
        if (translationQueue) {
            translationQueue.enqueue({
                text: text,
                context: context,
                apply: applyCallback
            });
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

        const originalText = node.nodeValue.trim();

        translateText(originalText, { type: 'textNode' }, (translated) => {
            if (translated && translated !== originalText) {
                node.nodeValue = node.nodeValue.replace(originalText, translated);
            }
        });
    }

    function translateAttribute(element, attrName) {
        if (!element || !element.hasAttribute(attrName)) return;

        const attrValue = element.getAttribute(attrName);
        if (!attrValue || !attrValue.trim()) return;

        translateText(attrValue, { type: 'attribute', attr: attrName }, (translated) => {
            if (translated && translated !== attrValue) {
                element.setAttribute(attrName, translated);
            }
        });
    }

    // ==================== 用户配置界面 ====================
    function showConfigDialog() {
        const currentKey = GM_getValue(CONFIG.API_KEY_KEY, '');
        const currentEndpoint = GM_getValue(CONFIG.API_ENDPOINT_KEY, CONFIG.DEFAULT_ENDPOINT);
        const currentModel = GM_getValue(CONFIG.MODEL_NAME_KEY, CONFIG.DEFAULT_MODEL);
        const aiEnabled = GM_getValue(CONFIG.AI_ENABLED_KEY, false);

        // 🔧 使用 DOM API 避免 XSS
        const overlay = document.createElement('div');
        overlay.id = 'vc-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999998;';

        const dialog = document.createElement('div');
        dialog.id = 'vc-config-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 999999;
            min-width: 500px;
            max-width: 600px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;

        // 标题
        const title = document.createElement('h2');
        title.textContent = 'Vercel 汉化设置';
        title.style.cssText = 'margin: 0 0 16px 0; font-size: 18px;';
        dialog.appendChild(title);

        // AI 开关
        const aiToggleDiv = document.createElement('div');
        aiToggleDiv.style.cssText = 'margin-bottom: 16px;';

        const aiToggleLabel = document.createElement('label');
        aiToggleLabel.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 500;';

        const aiCheckbox = document.createElement('input');
        aiCheckbox.type = 'checkbox';
        aiCheckbox.id = 'vc-ai-enabled';
        aiCheckbox.checked = aiEnabled;

        const aiLabelText = document.createTextNode(' 启用 AI 自动翻译');
        aiToggleLabel.appendChild(aiCheckbox);
        aiToggleLabel.appendChild(aiLabelText);

        const aiHint = document.createElement('p');
        aiHint.textContent = '使用 AI API 自动翻译未收录的文本';
        aiHint.style.cssText = 'margin: 4px 0 0 24px; font-size: 12px; color: #666;';

        aiToggleDiv.appendChild(aiToggleLabel);
        aiToggleDiv.appendChild(aiHint);
        dialog.appendChild(aiToggleDiv);

        // 模型选择
        const modelDiv = document.createElement('div');
        modelDiv.style.cssText = 'margin-bottom: 16px;';

        const modelLabel = document.createElement('label');
        modelLabel.textContent = '翻译模型:';
        modelLabel.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 500;';

        const modelSelect = document.createElement('select');
        modelSelect.id = 'vc-model-name';
        modelSelect.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;';

        const models = [
            { value: 'deepl', text: 'DeepL (推荐)' },
            { value: 'gpt-4o-mini', text: 'OpenAI GPT-4o-mini' },
            { value: 'gpt-3.5-turbo', text: 'OpenAI GPT-3.5-turbo' },
            { value: 'claude-3-haiku', text: 'Claude 3 Haiku' },
            { value: 'custom', text: '自定义模型' }
        ];

        models.forEach(m => {
            const option = document.createElement('option');
            option.value = m.value;
            option.textContent = m.text;
            if (m.value === currentModel) option.selected = true;
            modelSelect.appendChild(option);
        });

        modelDiv.appendChild(modelLabel);
        modelDiv.appendChild(modelSelect);
        dialog.appendChild(modelDiv);

        // API 接入点
        const endpointDiv = document.createElement('div');
        endpointDiv.style.cssText = 'margin-bottom: 16px;';

        const endpointLabel = document.createElement('label');
        endpointLabel.textContent = 'API 接入点:';
        endpointLabel.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 500;';

        const endpointInput = document.createElement('input');
        endpointInput.type = 'text';
        endpointInput.id = 'vc-api-endpoint';
        endpointInput.value = currentEndpoint;
        endpointInput.placeholder = 'https://api-free.deepl.com/v2/translate';
        endpointInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;';

        const endpointHint = document.createElement('p');
        endpointHint.textContent = 'DeepL Pro: https://api.deepl.com/v2/translate | OpenAI: https://api.openai.com/v1/chat/completions';
        endpointHint.style.cssText = 'margin: 4px 0 0 0; font-size: 11px; color: #666;';

        endpointDiv.appendChild(endpointLabel);
        endpointDiv.appendChild(endpointInput);
        endpointDiv.appendChild(endpointHint);
        dialog.appendChild(endpointDiv);

        // API 密钥
        const keyDiv = document.createElement('div');
        keyDiv.style.cssText = 'margin-bottom: 16px;';

        const keyLabel = document.createElement('label');
        keyLabel.textContent = 'API 密钥:';
        keyLabel.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 500;';

        const keyInput = document.createElement('input');
        keyInput.type = 'password';
        keyInput.id = 'vc-api-key';
        keyInput.value = currentKey;
        keyInput.placeholder = '请输入您的 API 密钥';
        keyInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;';

        const keyHint = document.createElement('p');
        keyHint.style.cssText = 'margin: 4px 0 0 0; font-size: 12px; color: #666;';

        const keyHintText = document.createTextNode('获取免费密钥: ');
        const keyLink = document.createElement('a');
        keyLink.href = 'https://www.deepl.com/pro-api';
        keyLink.target = '_blank';
        keyLink.textContent = 'DeepL API';
        keyLink.style.cssText = 'color: #0070f3;';
        const keyHintText2 = document.createTextNode(' (500k字符/月免费)');

        keyHint.appendChild(keyHintText);
        keyHint.appendChild(keyLink);
        keyHint.appendChild(keyHintText2);

        keyDiv.appendChild(keyLabel);
        keyDiv.appendChild(keyInput);
        keyDiv.appendChild(keyHint);
        dialog.appendChild(keyDiv);

        // 缓存统计
        const cacheDiv = document.createElement('div');
        cacheDiv.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; font-size: 12px;';

        const cacheText = document.createElement('strong');
        cacheText.textContent = `缓存统计: ${cache.cache.size} 条已翻译`;

        const clearCacheBtn = document.createElement('button');
        clearCacheBtn.id = 'vc-clear-cache';
        clearCacheBtn.textContent = '清空缓存';
        clearCacheBtn.style.cssText = 'margin-left: 12px; padding: 4px 8px; font-size: 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;';

        cacheDiv.appendChild(cacheText);
        cacheDiv.appendChild(clearCacheBtn);
        dialog.appendChild(cacheDiv);

        // 按钮组
        const btnDiv = document.createElement('div');
        btnDiv.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'vc-cancel-btn';
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;';

        const saveBtn = document.createElement('button');
        saveBtn.id = 'vc-save-btn';
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = 'padding: 8px 16px; border: none; background: #0070f3; color: white; border-radius: 4px; cursor: pointer;';

        btnDiv.appendChild(cancelBtn);
        btnDiv.appendChild(saveBtn);
        dialog.appendChild(btnDiv);

        // 添加到页面
        const container = document.createElement('div');
        container.appendChild(overlay);
        container.appendChild(dialog);
        document.body.appendChild(container);

        // 事件监听
        saveBtn.onclick = () => {
            const newKey = keyInput.value.trim();
            const newEndpoint = endpointInput.value.trim();
            const newModel = modelSelect.value;
            const newEnabled = aiCheckbox.checked;

            GM_setValue(CONFIG.API_KEY_KEY, newKey);
            GM_setValue(CONFIG.API_ENDPOINT_KEY, newEndpoint);
            GM_setValue(CONFIG.MODEL_NAME_KEY, newModel);
            GM_setValue(CONFIG.AI_ENABLED_KEY, newEnabled);

            container.remove();
            alert('设置已保存！刷新页面生效。');
        };

        cancelBtn.onclick = () => {
            container.remove();
        };

        clearCacheBtn.onclick = () => {
            if (confirm('确定要清空所有翻译缓存吗？')) {
                cache.clear();
                alert('缓存已清空！');
                container.remove();
            }
        };

        overlay.onclick = () => {
            container.remove();
        };
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

            // 处理字符变更
            if (mutation.type === 'characterData') {
                if (mutation.target && mutation.target.nodeValue && mutation.target.nodeValue.trim() &&
                    !shouldIgnoreNode(mutation.target.parentNode)) {
                    translateTextNode(mutation.target);
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

    // ==================== 初始化 ====================
    function init() {
        console.log('[Vercel汉化] 初始化中...');

        // 初始化翻译队列
        translationQueue = new TranslationQueue(processBatch, CONFIG.QUEUE_DELAY, CONFIG.BATCH_SIZE);

        // 注册菜单命令
        GM_registerMenuCommand('⚙️ 翻译设置', showConfigDialog);

        // 初始翻译
        setTimeout(() => {
            replaceText(document.body);
        }, 800);

        // 监听 DOM 变更
        const bodyObserver = new MutationObserver(mutations => {
            clearTimeout(window.vcTranslationTimer);
            window.vcTranslationTimer = setTimeout(() => {
                processMutations(mutations);
            }, 100);
        });

        bodyObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['title', 'placeholder', 'aria-label']
        });

        // 页面加载完成后再翻译一次
        window.addEventListener('load', function() {
            setTimeout(() => {
                replaceText(document.body);
            }, 1000);
        });

        console.log('[Vercel汉化] 初始化完成');
        console.log(`- 核心术语: ${CORE_TERMS.size} 条`);
        console.log(`- 缓存: ${cache.cache.size} 条`);
        console.log(`- AI翻译: ${GM_getValue(CONFIG.AI_ENABLED_KEY, false) ? '已启用' : '未启用'}`);
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
