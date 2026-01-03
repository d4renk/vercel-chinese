# Vercel 汉化

<p align="center">
  <img src="https://assets.vercel.com/image/upload/v1607554385/repositories/vercel/logo.png" width="120" alt="Vercel Logo">
</p>

<p align="center">
  <strong>自动汉化 Vercel 网站界面的浏览器脚本</strong>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> •
  <a href="#版本选择">版本选择</a> •
  <a href="#安装方法">安装方法</a> •
  <a href="#文档">文档</a>
</p>

---

## 📦 版本选择

本项目提供两个版本，请根据需求选择：

### 📌 原版（推荐新手）
**适合人群**：偶尔使用 Vercel 的用户

- ⚡ 即装即用，零配置
- 📦 880+ 词静态词典
- ❌ 无网络依赖
- ✅ 完全离线可用

**安装**: [点击安装原版](https://github.com/d4renk/vercel-chinese/raw/main/vercel-chinese.user.js)

---

### 🤖 AI 增强版（推荐专业用户）
**适合人群**：频繁使用 Vercel 的开发者

- 🤖 AI 自动翻译（DeepL/GPT/Claude）
- 💾 智能缓存（5000条，7天有效）
- 🔧 自定义 API 接入点
- 📊 实时翻译进度显示
- ⚡ 批量优化（减少80% API调用）

**安装**: [点击安装 AI 增强版](https://github.com/d4renk/vercel-chinese/raw/main/vercel-chinese-ai.js)

**文档**: [AI 增强版完整文档](./README-AI.md)

---

## 📊 版本对比

| 特性 | 原版 | AI 增强版 |
|------|:----:|:--------:|
| **翻译词汇** | 880词（固定） | 880+词 + AI无限 |
| **网络依赖** | ❌ 无 | ⚙️ 可选 |
| **配置难度** | ✅ 零配置 | 🔧 需5分钟配置 |
| **翻译质量** | 🟡 固定 | ✅ AI动态优化 |
| **维护成本** | 🔴 手动添加 | 🟢 AI自动 |
| **费用** | ✅ 完全免费 | 🟢 DeepL Free 500k字符/月 |
| **缓存功能** | ❌ 无 | ✅ 无上限智能缓存 |
| **翻译进度** | ❌ 无 | ✅ 实时进度浮窗 |
| **翻译记录** | ❌ 无 | ✅ 100条历史记录 |
| **联通测试** | ❌ 无 | ✅ 一键测试 API |

---

## 🚀 快速开始

### 步骤 1: 安装浏览器扩展

首先安装用户脚本管理器（二选一）：

- **[Tampermonkey](https://www.tampermonkey.net/)** - 推荐
- **[Violentmonkey](https://violentmonkey.github.io/)** - 开源替代

支持浏览器：Chrome、Firefox、Edge、Safari

### 步骤 2: 安装脚本

**方式 A: 原版（推荐新手）**
1. [点击安装原版脚本](https://github.com/d4renk/vercel-chinese/raw/main/vercel-chinese.user.js)
2. 在弹出的 Tampermonkey 页面点击「安装」
3. 访问 [vercel.com](https://vercel.com) 即可看到中文界面

**方式 B: AI 增强版（推荐专业用户）**
1. [点击安装 AI 增强版](https://github.com/d4renk/vercel-chinese/raw/main/vercel-chinese-ai.js)
2. 点击「安装」
3. 点击浏览器扩展图标 → **Vercel 汉化 (AI 增强版)** → **⚙️ 翻译设置**
4. 配置 API 密钥（参考 [AI 版完整文档](./README-AI.md)）
5. 刷新页面

---

## 📖 文档

- **[AI 增强版完整文档](./README-AI.md)** - 配置指南、API 接入、常见问题
- **[交付总结](./DELIVERY-SUMMARY.md)** - 技术架构、性能指标
- **[原版使用说明](#原版使用说明)** - 见下文

---

## 原版使用说明

### 功能特性

- ⚡ **即时翻译**: 880+ 词静态词典，覆盖常用界面
- 🔄 **动态监听**: 自动翻译动态加载的内容
- 📴 **离线可用**: 无需网络连接
- 🎯 **精准匹配**: 智能单词边界识别

### 覆盖范围

- ✅ 仪表盘（Dashboard）
- ✅ 项目管理（Projects）
- ✅ 部署记录（Deployments）
- ✅ 域名设置（Domains）
- ✅ 环境变量（Environment Variables）
- ✅ 团队管理（Teams）
- ✅ 账单设置（Billing）
- ✅ 分析统计（Analytics）

### 自定义翻译

如需添加更多翻译词条，可编辑脚本中的 `i18n` Map：

```javascript
const i18n = new Map([
    ['English Term', '中文翻译'],
    ['Dashboard', '仪表盘'],
    // 添加更多词条...
]);
```

### 已知限制

- 仅翻译预定义的 880 词
- 新增的 Vercel 功能可能未翻译
- 动态内容可能需要刷新页面

---

## 💡 选择建议

### 选择原版，如果你：
- ✅ 只是偶尔访问 Vercel
- ✅ 不想配置 API 密钥
- ✅ 需要完全离线可用
- ✅ 对翻译覆盖率要求不高

### 选择 AI 增强版，如果你：
- ✅ 频繁使用 Vercel 平台
- ✅ 需要翻译动态内容
- ✅ 愿意配置 API（5分钟）
- ✅ 追求最佳翻译质量
- ✅ 需要翻译进度显示

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 原版词典扩充
编辑 `vercel-chinese.user.js` 中的 `i18n` Map 或 `addVocabulary()` 函数。

### AI 版改进
参考 [DELIVERY-SUMMARY.md](./DELIVERY-SUMMARY.md) 中的技术架构。

### 提交规范
- 词条格式：`['English Term', '中文翻译']`
- 确保翻译准确、简洁
- 避免机器翻译

---

## 📝 更新日志

### v0.3.0 (2026-01-04) ✅
- ✨ 新增联通性测试功能
- ✨ 新增翻译进度实时显示
- ✨ 新增翻译记录（100条历史）
- ⚡ 移除缓存上限，缓存无限制
- ⚡ API 调用减少 95%

### v0.2.0 (2026-01-04) ✅
- ✨ 新增 AI 增强版
- 🔒 修复所有高风险安全问题
- 📚 完善使用文档
- ⚡ 批量翻译优化

### v0.1.0 (首次发布) ✅
- ✨ 880+ 词静态翻译
- 🎯 支持 Vercel 全站
- 🔄 动态内容监听

---

## 📜 许可证

[GPL-3.0](./LICENSE)

---

## 致谢

- 感谢 [GitHub 中文化项目](https://github.com/maboloshi/github-chinese) 提供的参考
- 感谢所有贡献者的支持

---

## 免责声明

本项目不隶属于 Vercel，仅为方便中文用户使用而创建。

---

<p align="center">
  Made with ❤️ for Vercel users
</p>

<p align="center">
  ⭐ 如果这个项目对你有帮助，欢迎 Star
</p>
