# Diary 项目记忆

> 最近核对：2026-11-18。此文件记录当前实现与验收状态；历史计划仍见[项目规划](./Diary-Project-Plan.md)，逐项进度见[进度文档](./Diary-Project-Progress.md)。

## 当前版本与平台

- 当前公开版本为 `1.3.0`。macOS Apple 芯片版为包含 `Diary.app` 的 ZIP；Windows 10/11 x64 版为 NSIS 安装程序。两个安装包已发布在 [GitHub v1.3.0](https://github.com/Yangsw0-0/Diary/releases/tag/v1.3.0)。
- M1–M6 已完成。M7 Windows 适配的自动检查与打包已通过；**M7-07 Windows 真机安装和窗口交互验收仍待完成**。不得把 CI 成功表述为真实 Windows 设备已验收。
- 本地前端 `npm run check` 通过；macOS 上 `cargo fmt --check` 与 `cargo test --locked` 通过，Rust 单元测试为 19 项。最近的 GitHub Actions 运行中 `frontend`、`rust`、`windows` 三项均成功。安装包的 SHA-256 见[1.3.0 发布记录](./Release-1.3.0.md)。

## 架构与数据边界

- 前端使用 React 19、TypeScript 和 Milkdown Crepe，桌面与文件层使用 Tauri 2、Rust。日记正文以用户选择目录中的 Markdown 文件为唯一真实来源；附件位于同一根目录的 `assets/`。Git 与发布附件不得包含真实日记、附件、缓存或 `notes/`。
- macOS 与 Windows 共用业务逻辑和日记目录结构。系统打开链接/文件、安全读取附件由 `src-tauri/src/platform/` 门面分派到 `macos.rs`、`windows.rs`。Windows 打包差异在 `src-tauri/tauri.windows.conf.json`；自动检查在 `.github/workflows/check.yml`。
- 两个平台均无自动更新和云同步。升级安装程序不代替日记根目录备份。旧单文件日记批量导入仍是额外工作，不属于 M7。

## 本次审查发现的待处理项

1. **新建文件的硬链接回退不具备崩溃原子性。** `src-tauri/src/diary_storage.rs` 的 `link_or_copy_new` 在硬链接失败时调用 `copy_new_file`，直接对最终路径执行 `create_new` 和复制。正常 I/O 错误会清理目标文件；但若进程或系统在复制中途终止，最终路径可能留下部分内容。此路径用于新日记、附件导入和回收副本，在不支持硬链接的文件系统上尤其需要验证。后续应采用同目录的原子、不覆盖既有文件的发布操作，或明确降低这条路径的数据持久性承诺，并为中断/失败行为补测试。
2. **Windows 重解析点防护缺少专项验证。** `src-tauri/src/platform/windows.rs` 使用 `FILE_FLAG_OPEN_REPARSE_POINT` 打开附件，再检查 `file_type().is_symlink()`；目录和文件路径也用 `symlink_metadata` 检查。当前 Windows CI 主要证明编译、通用单元测试和打包成功，尚无 Windows 符号链接、目录联接或其他重解析点的专项用例。发布文档中的“拒绝目录联接”需要在 Windows 真机或 CI 中以用例证实；如需拒绝所有重解析点，应检查 [`FILE_ATTRIBUTE_REPARSE_POINT`](https://learn.microsoft.com/windows/win32/fileio/reparse-point-operations) 等 Windows 属性。
3. **窗口级验收未完成。** 首次选目录、中文输入、自动保存与失败恢复、标签/导航、附件打开、改日期、删除日记和小窗口布局仍需在真实 Windows 10/11 x64 设备上逐项检查；长路径和缺少 WebView2 的 Windows 10 也尚未实测。

以上待处理项是审查发现的风险或验证缺口，不表示 CI 或现有安装包已失败。修改实现前先用测试复现具体行为；版本状态变化后更新本文件与[平台支持文档](./Platform-Support.md)。
