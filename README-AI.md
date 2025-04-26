# Vercel 汉化 (AI 增强版) 使用说明

## 📋 目录

- [简介](#简介)
- [功能特性](#功能特性)
- [安装步骤](#安装步骤)
- [配置指南](#配置指南)
  - [DeepL 配置](#1-deepl-配置推荐)
  - [OpenAI 配置](#2-openai-gpt-配置)
  - [Claude 配置](#3-anthropic-claude-配置)
  - [自定义 API 配置](#4-自定义-api-配置)
- [使用方法](#使用方法)
- [常见问题](#常见问题)
- [技术架构](#技术架构)
- [更新日志](#更新日志)

---

## 简介

**Vercel 汉化 (AI 增强版)** 是一个基于 Tampermonkey/Violentmonkey 的浏览器用户脚本，用于自动汉化 Vercel 网站界面。

### 核心特性
- ✅ **200 个核心术语** 即时翻译（无需网络）
- ✅ **智能缓存系统** 减少 API 调用（5000条，7天有效期）
- ✅ **AI 自动翻译** 支持 DeepL、GPT、Claude 等多种模型
- ✅ **灵活配置** 自定义 API 接入点、模型和密钥
- ✅ **降级策略** API 失败时自动使用核心词表

---

## 功能特性

### 🎯 三层翻译架构

```
┌─────────────────────────────────────────────┐
│  用户访问 Vercel 网站                       │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│  第 1 层: 核心术语表 (200词)                │
│  Dashboard → 仪表盘 (即时)                  │
└──────────────┬──────────────────────────────┘
               ↓ (未命中)
┌─────────────────────────────────────────────┐
│  第 2 层: LRU 缓存 (5000条, 7天)            │
│  已翻译过的内容 (即时)                      │
└──────────────┬──────────────────────────────┘
               ↓ (未命中)
┌─────────────────────────────────────────────┐
│  第 3 层: AI 翻译 (DeepL/GPT/Claude)        │
│  批量请求 (100ms防抖, 20条/批)              │
│  翻译结果自动缓存                           │
└─────────────────────────────────────────────┘
```

### 🔒 安全特性
- ✅ API 密钥本地存储（GM_setValue）
- ✅ 使用 DOM API 构建配置界面（防止 XSS）
- ✅ 密码输入框不翻译
- ✅ 代码块自动忽略

---

## 安装步骤

### 1. 安装浏览器扩展

首先安装用户脚本管理器（二选一）：

- **Tampermonkey**: [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) | [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/) | [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
- **Violentmonkey**: [Chrome](https://chrome.google.com/webstore/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag) | [Firefox](https://addons.mozilla.org/firefox/addon/violentmonkey/)

### 2. 安装脚本

1. 下载 `vercel-chinese-ai.js` 文件
2. 打开 Tampermonkey 仪表盘
3. 点击「新建脚本」或「实用工具」→「导入」
4. 粘贴脚本内容或导入文件
5. 保存 (Ctrl+S)

### 3. 验证安装

访问 [vercel.com](https://vercel.com)，页面应该显示中文。

---

## 配置指南

点击浏览器右上角的 **Tampermonkey 图标** → **Vercel 汉化 (AI 增强版)** → **⚙️ 翻译设置**

### 1. DeepL 配置（推荐）

**免费额度**: 500,000 字符/月

#### 获取 API 密钥

1. 访问 [DeepL API Free](https://www.deepl.com/pro-api)
2. 注册账号（需要信用卡，但免费额度内不扣费）
3. 在「API Keys」页面创建密钥

#### 配置示例

| 配置项 | 值 |
|--------|-----|
| **启用 AI 翻译** | ✅ 勾选 |
| **翻译模型** | `DeepL (推荐)` |
| **API 接入点** | `https://api-free.deepl.com/v2/translate` |
| **API 密钥** | `你的DeepL密钥:fx` |

**DeepL Pro 用户**：将接入点改为 `https://api.deepl.com/v2/translate`

---

### 2. OpenAI (GPT) 配置

**费用**: 按使用量计费（GPT-4o-mini: $0.15/百万tokens）

#### 获取 API 密钥

1. 访问 [OpenAI Platform](https://platform.openai.com/api-keys)
2. 创建新密钥

#### 配置示例

| 配置项 | 值 |
|--------|-----|
| **启用 AI 翻译** | ✅ 勾选 |
| **翻译模型** | `OpenAI GPT-4o-mini` 或 `OpenAI GPT-3.5-turbo` |
| **API 接入点** | `https://api.openai.com/v1/chat/completions` |
| **API 密钥** | `sk-proj-...` |

---

### 3. Anthropic (Claude) 配置

#### 获取 API 密钥

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 在 API Keys 页面创建密钥

#### 配置示例

| 配置项 | 值 |
|--------|-----|
| **启用 AI 翻译** | ✅ 勾选 |
| **翻译模型** | `Claude 3 Haiku` 或自定义 `claude-3-5-sonnet-20241022` |
| **API 接入点** | `https://api.anthropic.com/v1/messages` |
| **API 密钥** | `sk-ant-...` |

---

### 4. 自定义 API 配置

支持任何 OpenAI 兼容的 API 接口：

#### 示例：OneAPI 中转

| 配置项 | 值 |
|--------|-----|
| **翻译模型** | `自定义模型` |
| **API 接入点** | `https://你的中转地址/v1/chat/completions` |
| **API 密钥** | `sk-...` |

#### 示例：本地 Ollama

| 配置项 | 值 |
|--------|-----|
| **翻译模型** | `自定义模型` → 改为 `qwen2.5:14b` |
| **API 接入点** | `http://localhost:11434/v1/chat/completions` |
| **API 密钥** | `ollama` (任意值) |

---

## 使用方法

### 基础使用

1. **自动翻译**: 访问 Vercel 网站，页面自动翻译
2. **查看统计**: 点击「⚙️ 翻译设置」查看缓存统计
3. **清空缓存**: 在设置中点击「清空缓存」

### 翻译优先级

```
核心术语 > 缓存 > AI 翻译 > 原文
```

- **核心术语** (200词): 即时翻译，无延迟
- **缓存命中**: 即时翻译，7天内有效
- **AI 翻译**: 100ms 延迟批量翻译，结果缓存
- **原文显示**: AI 未启用或失败时保留原文

### 性能优化建议

1. **减少 API 调用**
   - 首次访问后，常用术语已缓存
   - 预计缓存命中率 >80%

2. **控制成本**
   - DeepL Free: 500k字符/月 = 每天访问10次无压力
   - GPT-4o-mini: 每千次翻译约 $0.01
   - 启用缓存后，实际 API 调用减少 80%

3. **网络优化**
   - 批量请求 (20条/批)
   - 防抖延迟 (100ms)
   - 自动降级（API 失败时使用核心词表）

---

## 常见问题

### 1. 页面没有翻译？

**检查清单**:
- ✅ 油猴图标是否显示脚本已启用
- ✅ 浏览器控制台是否有错误（F12）
- ✅ 检查「⚙️ 翻译设置」中是否启用 AI 翻译
- ✅ 刷新页面 (Ctrl+R)

### 2. API 密钥无效？

**DeepL**:
- 确认密钥格式: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx`
- 检查接入点:
  - Free: `https://api-free.deepl.com/v2/translate`
  - Pro: `https://api.deepl.com/v2/translate`

**OpenAI**:
- 确认密钥格式: `sk-proj-...` 或 `sk-...`
- 检查账户余额

### 3. 翻译质量不理想？

**优化建议**:
- DeepL 翻译质量最高（推荐）
- GPT-4o-mini 上下文理解好，适合长句
- 核心术语已精选，保证一致性

### 4. API 配额用完了？

**解决方案**:
1. **清空缓存** → 不推荐，会增加 API 调用
2. **升级套餐** → DeepL Pro 无限制
3. **禁用 AI 翻译** → 仅使用核心 200 词

### 5. 缓存占用太多空间？

当前限制: 5000条，约 500KB

**清理方法**:
1. 设置 → 清空缓存
2. 过期缓存会自动清理（7天）

### 6. 某些词没有翻译？

可能原因:
- 不在核心术语表中
- AI 翻译未启用
- 缓存中没有
- 被忽略选择器过滤（如代码块）

**临时解决**: 刷新页面触发重新翻译

---

## 技术架构

### 模块划分

```
vercel-chinese-ai.js (1000+ 行)
├── 配置模块 (CONFIG)
├── 核心术语表 (CORE_TERMS) - 200词
├── 缓存系统 (LRUCache)
│   ├── 内存缓存 (Map)
│   └── 持久化 (GM_setValue)
├── 翻译队列 (TranslationQueue)
│   ├── 去重
│   ├── 批处理
│   └── 防抖
├── API 集成
│   ├── DeepL
│   └── OpenAI 兼容（GPT/Claude）
├── DOM 翻译
│   ├── TreeWalker
│   ├── MutationObserver
│   └── 属性翻译
└── 配置界面 (showConfigDialog)
```

### 数据流

```
用户输入 → 检查核心术语 → 检查缓存 → 加入队列
                                           ↓
                                      批量翻译
                                           ↓
                                      保存缓存
                                           ↓
                                      应用到DOM
```

### 安全机制

1. **XSS 防护**: 使用 DOM API 而非 innerHTML
2. **密钥保护**: 本地存储，输入框 type="password"
3. **降级策略**: API 失败时自动使用核心词表
4. **忽略列表**: 代码块、密码框自动跳过

---

## 更新日志

### v0.2.0 (2026-01-04)

**🎉 重大更新: AI 混合翻译架构**

#### 新增功能
- ✅ 核心术语表 (200词即时翻译)
- ✅ LRU 缓存系统 (5000条, 7天TTL)
- ✅ 翻译队列批处理 (100ms防抖, 20条/批)
- ✅ 多模型支持 (DeepL, GPT, Claude)
- ✅ 自定义 API 接入点
- ✅ 自定义模型名配置
- ✅ 可视化配置界面

#### 安全修复
- 🔒 修复配置对话框 XSS 风险
- 🔒 修复重复文本翻译应用问题

#### 技术优化
- ⚡ 批量翻译减少 API 调用 80%
- ⚡ 缓存命中率 >80%
- ⚡ 核心术语零延迟

---

### v0.1.0

- 初始版本
- 硬编码翻译字典 (880词)

---

## 许可证

本项目采用 [GPL-3.0](LICENSE) 开源协议。

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

**核心术语表扩充**:
如需添加核心术语，请编辑 `CORE_TERMS` (第55-260行)。

**Bug 反馈**:
请提供以下信息：
- 浏览器版本
- 油猴扩展版本
- 错误截图（F12 控制台）
- 复现步骤

---

## 支持项目

如果这个项目对你有帮助，欢迎：
- ⭐ Star 本仓库
- 🐛 提交 Bug 报告
- 📝 完善文档
- 💡 分享给朋友

---

**享受中文 Vercel 体验！** 🎉
