# Diary

一个本地 Markdown 日记应用。首版面向 macOS，使用 Tauri 2、React、TypeScript 和 Rust；Windows 支持列入后续阶段。

目前处于规划阶段，应用尚未开始实现：[项目规划](./docs/Diary-Project-Plan.md) · [进度与任务](./docs/Diary-Project-Progress.md)。

日记根文件夹由用户首次启动时自行选择。日记正文与附件属于用户数据，不应提交到本代码仓库。

## 仓库目录

| 目录 | 用途 |
| --- | --- |
| `docs/` | 产品规划、架构说明和项目进度。 |
| `src/` | 后续 React、TypeScript 前端与业务代码。 |
| `src-tauri/` | 后续 Tauri、Rust 桌面端和文件系统代码。 |
| `tests/` | 测试代码与人工编写的示例数据。 |
| `scripts/` | 开发、检查与打包辅助脚本。 |
| `notes/` | 本地无关笔记；被 Git 忽略，不随项目推送。 |

仓库根目录保留 README、`.gitignore`，未来还会放 `package.json`、Vite/Tauri 等构建配置。源码目录目前只是占位，首次工程初始化后替换占位文件。
