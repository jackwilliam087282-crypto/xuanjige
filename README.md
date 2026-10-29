# 玄机阁 · XuanJiGe

传统文化学习、排盘与自我复盘的本地桌面软件。基于 Electron、原生 HTML/JavaScript 与本地 Python 算法，欢迎 Fork、修改和提交 Pull Request。

> 周易六十四卦，读懂人生时机。理性参考，向内观心。
> 本项目用于传统文化学习与娱乐参考，不承诺预测未来，不应替代医疗、法律、投资等专业意见。命运始终掌握在自己手里。

## 下载与介绍

- [下载 Windows 安装包、便携版与介绍视频](https://github.com/jackwilliam087282-crypto/xuanjige/releases)
- [观看介绍视频（已删除原片前16秒）](https://github.com/jackwilliam087282-crypto/xuanjige/releases/download/v1.10.0-p2/intro-1080p.mp4)
- 开发者请克隆本仓库，不必从安装包或 `app.asar` 反向提取代码。

## 功能

- 生辰输入、四柱八字与相关排盘、运势参考、复盘记录。
- 六爻问事、八字合盘、九宫问事，以及本地太乙、六壬和奇门引擎。
- 每日读卦、传统文化科普与实用小工具。
- P2 互动扩展：塔罗、起名、互动玩法及科普动画。

每日读卦是按日期轮读的文化学习内容，**不是根据个人生辰预测未来**。具体算法口径、边界与争议欢迎通过 Issue 讨论，并用回归测试记录。

## 开发环境

- Windows 10/11 x64；Node.js 20.19+（推荐 Node.js 22 LTS）、npm、Git。
- 本仓库保留了原交付版的 Windows x64 CPython 3.11 嵌入式运行环境和必需依赖，所以仓库较大；它们不是用户数据，也不是项目自有许可证覆盖的组件。
- macOS/Linux 可进行部分纯 JavaScript 开发和测试，但当前 Python 桥接固定调用 `python.exe`，桌面完整运行和打包以 Windows 为准，不宣称跨平台支持。

```bash
git clone https://github.com/jackwilliam087282-crypto/xuanjige.git
cd xuanjige
npm ci
npm run check
npm test
npm start
```

`npm ci` 首次需要联网下载开发依赖与 Electron。本地启动后，核心排盘通过随附运行环境执行。不要设置来历不明的镜像或关闭证书校验来解决网络问题。

## 修改与打包

直接修改 HTML/JS 文件，重新启动应用查看变化；当前没有热更新开发服务器。

```bash
npm run test:smoke
npm run pack:dir
npm run pack
```

- `pack:dir`：生成 `dist/win-unpacked/`，适合本地验证。
- `pack`：生成 Windows x64 NSIS 安装包；如需签名，请自行配置证书，**不要提交证书或签名密码**。
- 此仓库添加了开发入口和基础回归测试；原始交付 ZIP 缺失其脚本所引用的 `tests/` 与 `tools/`，不能把本次基础测试当成原版完整测试套件。

## 目录导航

| 路径 | 用途 |
|---|---|
| `main.js` / `preload.js` | Electron 主进程和隔离的 IPC 桥接 |
| `index.html` | 主界面及部分界面逻辑 |
| `bazi-core.js` / `core/` | JavaScript 排盘与补充算法 |
| `ext/` | 互动扩展与工具界面 |
| `algorithm-bridge.js` / `engine/runner.py` | 本地 Python 调用、输入校验和结果协议 |
| `engine/kin*/` | 保留原授权的第三方算法源码 |
| `vendor/` | 随附 JavaScript 库及许可证 |
| `assets/` | 界面图片、音效和内嵌科普视频 |
| `tests/` / `scripts/` | 本次开源整理添加的测试与项目完整性检查 |

## 一起开发

欢迎修复问题、补充算法口径、改进无障碍、优化界面和增加测试。先阅读 [贡献指南](CONTRIBUTING.md)、[开发说明](docs/DEVELOPMENT.md) 与 [安全说明](SECURITY.md)。

建议优先方向：升级并验证 Electron/构建依赖、将单文件界面逐步模块化、完善日期边界与算法回归、补全跨平台运行环境。

## 授权与来源

项目自有代码按 [MIT](LICENSE) 发布；第三方代码、运行环境和依赖仍适用其原许可证，详见 [第三方声明](THIRD_PARTY_NOTICES.md)。保留相关版权、授权与本地修改记录。

首个开源版本基于 `1.10.0-p2` 交付包。原 ZIP 内部目录沿用了 P1 名称，以 `package.json` 中的 P2 版本和发布说明为准。
