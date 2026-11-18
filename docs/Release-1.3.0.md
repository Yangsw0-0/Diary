# Diary 1.3.0 更新记录

日期：2026-11-18。平台：Apple 芯片 macOS、Windows 10/11 x64。

## 新平台

- 新增与 macOS 平行的 Windows x64 版本。日记目录、编辑与自动保存、标签聚合、导航、附件导入与备份行为与 macOS 保持一致，两个平台读取同一套 Markdown 目录结构。
- Windows 使用 NSIS 安装程序，按当前用户安装，不需要管理员权限；升级时直接运行新安装包覆盖旧版本。
- Windows 11 自带 WebView2；Windows 10 缺少时由安装程序联网下载运行时。

## 源码分区

- 系统相关的打开链接、打开附件和安全读取集中到 `src-tauri/src/platform/` 门面，`macos.rs` 与 `windows.rs` 分别实现；业务模块不再写平台分支。
- Windows 使用 `ShellExecuteW` 打开链接、附件和目录；安全读取以 `FILE_FLAG_OPEN_REPARSE_POINT` 打开，并拒绝符号链接和目录联接。
- 覆盖写入遇到杀毒或索引器短暂占用时重试；新建文件优先使用硬链接，文件系统不支持时回退到独占复制。
- Windows 打包差异单独放在 `src-tauri/tauri.windows.conf.json`（NSIS、当前用户安装、WebView2 bootstrapper），macOS 配置不受影响。
- CI 新增 Windows 任务，运行 Rust 格式检查、clippy、单元测试并构建 NSIS 安装包。

平台矩阵、行为差异和新增平台步骤见 [平台支持与源码分区](./Platform-Support.md)。

## 验证

- 前端格式、静态检查、类型检查和生产构建通过，85 项测试通过。
- Rust 19 项测试通过；macOS 与 Windows 目标的 clippy 均无警告。
- macOS `.app` 版本为 `1.3.0`，arm64，ad hoc 签名校验通过；ZIP 完整性检查通过。
- Windows 任务在 `windows-latest` 上通过 Rust 格式检查、clippy 和单元测试，并成功构建 NSIS 安装包。Windows 真机窗口验收（安装、启动、中文输入、附件打开、升级覆盖）尚待完成。

## 安装

macOS（Apple 芯片）：[下载 Diary_1.3.0_aarch64.zip](https://github.com/Yangsw0-0/Diary/releases/download/v1.3.0/Diary_1.3.0_aarch64.zip)。SHA-256：`68d7e9cef78da9a9fcabd06059a25ca2373dc5a82cef8dda4cb9c78b141ab40a`。退出旧版后解压，将新的 `Diary.app` 放到旧版安装位置并确认替换。

Windows（10/11 x64）：[下载 Diary_1.3.0_x64-setup.exe](https://github.com/Yangsw0-0/Diary/releases/download/v1.3.0/Diary_1.3.0_x64-setup.exe)。SHA-256：`95817404aae2514c96a9fadd2829d30a7b37565b8a1ca8e0a677381a41982e93`。运行安装程序即可；SmartScreen 提示时选择“更多信息 → 仍要运行”。

两个平台的日记文件夹及其附件都不在安装包内，覆盖安装不会清除。

## 已知限制

- Windows 安装包未做代码签名，SmartScreen 可能提示未知发布者。
- Windows 版本尚未在真实设备上完成窗口级人工验收；自动化测试与安装包构建已通过。
- 两个平台都不提供自动更新；升级时下载新安装包覆盖安装。
