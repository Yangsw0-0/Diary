# Diary

一个本地 Markdown 日记应用。首版面向 macOS，使用 Tauri 2、React、TypeScript 和 Rust；Windows 支持列入后续阶段。

M1 工程骨架已建立，日记文件读写等核心功能尚未实现：[项目规划](./docs/Diary-Project-Plan.md) · [进度与任务](./docs/Diary-Project-Progress.md)。

日记根文件夹由用户首次启动时自行选择。日记正文与附件属于用户数据，不应提交到本代码仓库。

## 仓库目录

| 目录         | 用途                                      |
| ------------ | ----------------------------------------- |
| `docs/`      | 产品规划、架构说明和项目进度。            |
| `src/`       | 后续 React、TypeScript 前端与业务代码。   |
| `src-tauri/` | 后续 Tauri、Rust 桌面端和文件系统代码。   |
| `tests/`     | 测试代码与人工编写的示例数据。            |
| `scripts/`   | 开发、检查与打包辅助脚本。                |
| `notes/`     | 本地无关笔记；被 Git 忽略，不随项目推送。 |

仓库根目录保留 README、`.gitignore`、`package.json`、Vite 和 TypeScript 配置。`src/` 已包含可切换「日记」「标签」的界面骨架，`src-tauri/` 已包含可启动的 macOS 桌面壳。

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

只预览前端界面时可运行 `npm run dev`，打开 `http://localhost:1420`。此时不会有 Tauri 文件系统能力。Rust 端单独检查可运行 `cargo check --locked --manifest-path src-tauri/Cargo.toml`。

目前「新建」按钮故意不可用：选择日记文件夹、读写日记会在 M2 实现；编辑器与自动保存会在 M3 实现。前端的 `DiaryRepository` 和 `TauriDiaryRepository` 已建立接口，但对应 Rust 命令尚未注册，界面不会提前调用它们。
