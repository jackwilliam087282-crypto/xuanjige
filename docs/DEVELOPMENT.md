# 开发与维护

## 基线

基于1.10.0-p2交付快照，保留已有业务功能。开源整理增加MIT/第三方声明、启动命令、基础测试、CI与开发说明；没有重写排盘算法。

原始 `package-lock.json` 仍标记1.9.2，且缺少package.json内的jsdom依赖；本次更新锁文件以保证 `npm ci` 一致。原包中不存在其scripts指向的tests/tools，旧的无效命令不再对外承诺。

## 开发流程

先运行 `npm ci`，再 `npm run check`、`npm test`、`npm start`。原生界面直接加载本地index.html，没有Vite/Webpack热刷新。核心代码可直接用Node测试；涉及DOM/Canvas的改动应在实际Electron中验证。

`algorithm-bridge.js`固定调用engine/python/python.exe，使用JSON stdin/stdout通信；修改接口须同时检查主进程、preload、renderer和runner。保留并测试输入校验、超时和并发限制。

## 测试边界

本次新增测试覆盖基础文件/本地资源完整性、JS语法、核心排盘返回、每日卦稳定性、无效输入和桥接日期校验；不等于覆盖全部传统算法正确性。`test:smoke`在隐藏的Electron窗口加载真实页面并记录加载错误，不替代人工交互验收。

修改算法时请用固定时间、虚构出生信息和清晰预期，记录节气、时区、真太阳时等采用口径。不要把随机出生日期或当前日期当成唯一测试依据。

## 打包

Windows x64上运行 `npm run pack:dir` 或 `npm run pack`，产物在dist。engine通过extraResources复制到resources/engine，不能只分发app.asar。离线包应同时保留Python运行时、算法源码和许可证。

首发Release内安装包/便携版从此次开源整理目录重新构建，随附SHA256；原P2交付文件在维护者本地保留。打包规则会排除测试、开发脚本和docs目录，开发者以源码仓库为准。未签名软件可能出现系统警告，不应要求用户关闭系统安全防护。

## 可贡献方向

升级Electron及依赖、完善跨平台Python配置、拆分index.html、补齐自动化交互测试、改善无障碍、为算法结果补充解释来源和边界。
