# 平台支持与源码分区

> 适用版本：`1.3.0` 起。本文说明 macOS 与 Windows 两个桌面平台的支持范围、行为差异，以及源码如何保持平行分区。用户操作说明见 [使用说明](./Diary-User-Guide.md)。

默认发布策略（2026-11-23 起）：仅构建和发布 macOS 更新；Windows 保留最近已发布的 1.7.0，只有用户明确要求时才更新。CI 的 Windows job 仅由手动工作流 `build_windows=true` 启用。共享源码的变动不代表 Windows 新版已经构建或验证。

## 平台矩阵

| 平台        | 架构          | 安装包                            | 支持状态                                                     |
| ----------- | ------------- | --------------------------------- | ------------------------------------------------------------ |
| macOS       | Apple 芯片    | ZIP（内含 `Diary.app`）           | 正式支持；`1.0.0` 起持续发布                                 |
| Windows     | x64           | NSIS 安装程序，按当前用户安装     | `1.3.0` 起提供；自动构建与测试通过，真机窗口验收仍在进行     |
| Intel macOS | x86_64        | 不提供                            | 未构建、未验证                                               |
| Linux       | —             | 不提供                            | 未构建、未验证                                               |

Windows 支持 Windows 10/11 x64，需要 WebView2 运行时；Windows 11 已内置，Windows 10 缺失时安装程序会联网下载。不支持 Windows ARM64。

两个平台共用同一套日记目录结构：`<根目录>/<年份>/<YYYY-MM-DD>.md` 与 `<根目录>/assets/<年份>/<日期>/`。日记和附件只保存在用户选择的文件夹中，安装包与 GitHub 仓库不包含用户数据。

## 共同能力

- Milkdown Crepe 原位编辑、800 毫秒自动保存、保存失败草稿保护与恢复。
- 标签提取、主标签/分支聚合、只读标签详情与原文跳转。
- 后退/前进导航与阅读位置恢复；相邻日记的滚动切换。
- 附件导入、图片预览、系统默认程序打开；单个附件非空且不超过 20 MiB。
- 浅色/深色主题、主题色、三栏布局、面板拖动与收起、正文缩放。
- 删除日记移入根目录的 `Trash/`；应用不自动清理附件。
- 应用不包含云同步、自动备份或自动更新。

## 平台差异

| 能力             | macOS                                        | Windows                                                                 |
| ---------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| 打开外部链接     | 调用 `open`                                  | 调用 `ShellExecuteW`                                                    |
| 打开附件         | 调用 `open`                                  | 调用 `ShellExecuteW`                                                    |
| 安全读取附件     | `O_NOFOLLOW` 打开，拒绝符号链接              | 以 `FILE_FLAG_OPEN_REPARSE_POINT` 打开，拒绝符号链接和目录联接          |
| 覆盖写入         | 同目录临时文件后 `rename` 原子替换           | 同目录临时文件后 `rename` 替换；遇到杀毒/索引器短暂占用时重试 2 次      |
| 新建文件防覆盖   | 硬链接原子发布；不支持时报告失败     | 1.3.3 源码同左；已发布 1.3.0 仍含复制回退                         |
| 快捷键           | `⌘S` 手动保存                                | `Ctrl+S` 手动保存                                                       |
| 安装方式         | 解压 ZIP，把 `Diary.app` 拖入「应用程序」    | 运行 NSIS 安装程序，安装到当前用户目录，无需管理员权限                  |
| 签名与系统提示   | ad hoc 签名，未公证；首次打开可能需手动放行  | 未做代码签名；SmartScreen 可能提示“未知发布者”                          |
| 自动更新         | 不提供                                       | 不提供                                                                   |

Windows 版本尚未做代码签名。SmartScreen 提示时选择“更多信息 → 仍要运行”仅代表你信任该安装包来源；不要忽略来源不明的文件。

## 源码分区

平台相关代码集中在 `src-tauri/src/platform/`，业务代码不直接判断操作系统：

```text
src-tauri/src/platform/
├── mod.rs      # 平台门面：open_url、open_path、open_read_no_follow
├── macos.rs    # macOS 实现：open 命令、O_NOFOLLOW
└── windows.rs  # Windows 实现：ShellExecuteW、重解析点检查
```

约定如下：

1. **门面统一入口。** `platform/mod.rs` 定义跨平台函数签名，每个受支持平台提供同名实现；业务模块只调用门面函数。
2. **业务层不写平台分支。** `diary_storage.rs`、`attachment_storage.rs`、`external_link.rs` 等文件不出现 `#[cfg(target_os = ...)]`，也不直接启动系统命令或调用 Win32。
3. **未支持平台显式报错。** 在非 macOS/Windows 平台编译时，门面返回“当前平台不支持”的错误，而不是静默降级。
4. **新增能力按平台补全。** 先改 `mod.rs` 的签名和文档，再分别实现 `macos.rs`、`windows.rs`；缺少任一平台实现时保持编译失败，避免只在一边悄悄生效。
5. **前端不判断平台。** 快捷键统一写成 `event.metaKey || event.ctrlKey`；路径和文件分隔符由 Rust 端处理，Markdown 中的附件链接固定使用 `/`。
6. **配置按平台覆盖。** 共享配置放在 `src-tauri/tauri.conf.json`；Windows 专属的打包目标、WebView2 安装方式和 NSIS 安装范围放在 `src-tauri/tauri.windows.conf.json`，由 Tauri 在 Windows 构建时自动合并。macOS 专属设置仍留在基础配置的 `bundle.macOS`。

## 构建与检查

macOS（Apple 芯片）：

```sh
npm ci
npm run tauri:dev
npm run tauri:build
```

Windows（x64，需安装 Visual Studio 2022 Build Tools 的“使用 C++ 的桌面开发”和 Rust MSVC 工具链）：

```powershell
npm ci
npm run tauri:dev
npm run tauri:build -- --bundles nsis
```

安装包输出在 `src-tauri/target/release/bundle/nsis/`，文件名形如 `Diary_<版本>_x64-setup.exe`。NSIS 由 Tauri 自动准备，无需单独安装。

自动检查在 GitHub Actions 的 `.github/workflows/check.yml` 中分三个任务：

- `frontend`：Ubuntu 上运行格式、lint、Vitest、类型检查和生产构建。
- `rust`：macOS 上运行 `cargo fmt --check`、`cargo clippy --locked --all-targets -- -D warnings`、`cargo test --locked`。
- `windows`：Windows 上运行 `cargo test --locked`，并实际构建 NSIS 安装包，作为 `diary-windows-nsis` 构件上传。

Rust 代码在本地也可以单独检查：

```sh
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

## Windows 已知限制

- 未在真实 Windows 设备上完成窗口级人工验收；自动化测试和安装包构建已覆盖编译、单元测试与打包链路。
- 未做代码签名，SmartScreen 可能拦截首次运行。
- 安装包使用 `downloadBootstrapper`：Windows 10 缺少 WebView2 时需要联网下载运行时。
- 应用依赖系统默认程序打开附件；未安装对应程序时会提示无法打开。
- 超过 Windows 传统 260 字符路径限制的日记根目录未做专门验证，建议把日记放在层级较浅的位置。
- 不提供自动更新；升级时下载新安装包覆盖安装，用户日记和附件不受影响。

## 新增平台检查清单

1. 在 `platform/` 下新增实现文件，并在 `mod.rs` 补上门面分派；保持三个函数的行为契约一致。
2. 在 `src-tauri/tauri.<平台>.conf.json` 中只写该平台差异；不要复制整份基础配置。
3. 补充平台相关的存储/权限测试，或明确说明为何只能人工验证。
4. 在 CI 增加该平台的编译、测试和打包任务，并上传可安装构件。
5. 更新本文的平台矩阵、差异表和已知限制，同时更新 README、使用说明和发布记录。
