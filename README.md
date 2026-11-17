# Diary

一个本地 Markdown 日记应用。首版面向 macOS，使用 Tauri 2、React、TypeScript 和 Rust；Windows 支持列入后续阶段。

M4 标签提取与只读聚合已建立：[项目规划](./docs/Diary-Project-Plan.md) · [进度与任务](./docs/Diary-Project-Progress.md)。

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

M2 已实现 `choose_diary_root`、`get_workspace_status`、`list_diaries`、`read_diary` 和 `save_diary`。M3 已接入 Milkdown Crepe：编辑器允许规范化 Markdown（例如列表符号），按日期新建和打开，保存时使用 revision 冲突检测。M4 已接入标签提取与聚合：顶层二级标题作为标签，保存后更新当天索引，标签详情只读并在展示前核对原文件 revision。用户选择的根目录记录在应用配置目录的 `settings.json`，日记正文仍只存在于用户选定的文件夹。存储测试使用临时目录，不使用真实日记。

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
