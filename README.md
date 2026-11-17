# Diary

一个本地 Markdown 日记应用。首个正式版面向 macOS，使用 Tauri 2、React、TypeScript 和 Rust。Windows 适配目前不在计划内。

M1–M6 已实现，macOS 正式版版本为 `1.0.0`。旧文件导入属于后续额外工作。

[项目规划](./docs/Diary-Project-Plan.md) · [进度与任务](./docs/Diary-Project-Progress.md)

日记根文件夹由用户首次启动时自行选择。日记正文与附件属于用户数据，不应提交到本代码仓库。

## 仓库目录

| 目录         | 用途                                      |
| ------------ | ----------------------------------------- |
| `docs/`      | 产品规划、架构说明和项目进度。            |
| `src/`       | React、TypeScript 前端与业务代码。        |
| `src-tauri/` | Tauri、Rust 桌面端和文件系统代码。        |
| `tests/`     | 测试代码与人工编写的示例数据。            |
| `scripts/`   | 开发、检查与打包辅助脚本。                |
| `notes/`     | 本地无关笔记；被 Git 忽略，不随项目推送。 |

仓库根目录保留 README、`.gitignore`、`package.json`、Vite 和 TypeScript 配置。应用首次启动会要求选择已有日记文件夹；取消后仍停留在引导页。选定后可新建或打开日记，在原位渲染的编辑器中写作；停顿约 800 毫秒后自动保存，也可按 `⌘S` 保存。保存失败时草稿留在当前页面，可重新加载、确认覆盖保存或放弃草稿；更换文件夹前会再次尝试保存。

## 使用和备份

首次启动请选择一个**已有的**文件夹。应用不会替你创建根目录。每天的 Markdown 保存在 `<所选文件夹>/<年份>/<YYYY-MM-DD>.md`；附件保存在同一根目录的 `assets/<年份>/<日期>/`。使用「附件」按钮选择文件，或将文件拖入编辑器、粘贴图片。单个文件须非空且不超过 20 MiB；PNG、JPEG、GIF、WebP、AVIF 可在编辑器及标签页预览，其余文件以链接形式打开。复制成功后才会插入相对链接；删除日记里的链接不会删除附件文件。

备份时请复制**整个日记根目录**，包括所有年份文件夹和 `assets/`。恢复或迁移时保持这套目录结构，再在应用中重新选择新位置。GitHub 仓库不包含你的日记和附件。侧栏可拖动右边缘调整宽度、收起，并在收起后从窗口左边缘悬停唤出；宽度与收起状态保存在应用设置中。

## macOS 安装

本机安装包在 [releases/v1.0.0/Diary_1.0.0_aarch64.dmg](./releases/v1.0.0/Diary_1.0.0_aarch64.dmg)，适用于 Apple 芯片 Mac。打开 DMG 后将 Diary 拖到「应用程序」文件夹，首次运行再选择一个已有的日记文件夹。当前安装包使用临时（ad hoc）签名，未做 Apple 公证；macOS 若阻止打开，请在系统设置的「隐私与安全性」中确认你信任此应用后手动放行。不要忽略来源不明安装包的安全提示。

本版本只支持 macOS。附件上限为单个 20 MiB；删除正文中的附件链接不会清理附件文件，清理时请在备份后手动核对。项目不提供云同步或自动备份，建议定期复制整个日记根目录。

## 本地开发

准备 Node.js 24 或更新版本、npm、Rust stable 和 macOS Xcode Command Line Tools。若用 Homebrew 安装 `rustup`，先让当前终端能找到 Rust 工具链：

```sh
export PATH="$(brew --prefix rustup)/bin:$HOME/.cargo/bin:$PATH"
rustup default stable
```

然后在仓库根目录运行：

```sh
npm ci
npm run tauri:dev   # 启动桌面窗口和 Vite 开发服务器
npm run check       # 格式、lint、Vitest、类型检查、前端生产构建
npm run tauri:build # 打包桌面应用
```

只预览前端界面时可运行 `npm run dev`，打开 `http://localhost:1420`。此时没有 Tauri 文件系统能力，工作区状态会提示连接失败。Rust 端单独检查可运行 `cargo check --locked --manifest-path src-tauri/Cargo.toml`。

M2 已实现 `choose_diary_root`、`get_workspace_status`、`list_diaries`、`read_diary` 和 `save_diary`。M3 已接入 Milkdown Crepe：编辑器允许规范化 Markdown（例如列表符号），按日期新建和打开，保存时使用 revision 冲突检测。M4 已接入标签提取与聚合：顶层二级标题作为标签，保存后更新当天索引，标签详情只读并在展示前核对原文件 revision。M5 已支持点击标签日期跳回原日记小节，以及后退、前进和阅读位置恢复；导航历史仅保存在本次运行的内存中。用户选择的根目录记录在应用配置目录的 `settings.json`，日记正文仍只存在于用户选定的文件夹。存储测试使用临时目录，不使用真实日记。

本机如需将 Rust 工具链和缓存完全限制在项目内，可将 `CARGO_HOME`、`RUSTUP_HOME`、`CARGO_TARGET_DIR` 和 `TMPDIR` 分别指向 `Diary/.cache/cargo`、`Diary/.cache/rustup`、`Diary/.cache/tauri-target` 和 `Diary/.cache/tmp`。这些路径已被 Git 忽略。本机开发使用此方式，没有修改系统 Rust 环境。

## Python 虚拟环境与写入范围

项目如需 Python 辅助脚本，使用仓库内的 `.venv/`，不要安装到系统 Python。当前虚拟环境由本机已有的 Python 3.9.6 创建，尚未安装项目专用 Python 依赖。需要重建时运行 `bash scripts/setup-python-env.sh`，脚本将虚拟环境、pip 缓存和临时目录都放在 Diary 内。日常使用：

```sh
source .venv/bin/activate
python --version
python -m pip --version
deactivate
```

本项目后续只在当前 Diary 目录及其子目录写文件；其他本地文件仅可读。确需改动项目目录以外的路径时，先向用户说明并请求许可。具体约束见 [AGENTS.md](./AGENTS.md)。`.venv/` 与本地缓存均被 Git 忽略。
