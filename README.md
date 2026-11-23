# Diary

一个本地 Markdown 日记应用，使用 Tauri 2、React、TypeScript 和 Rust，提供 macOS 与 Windows 两个平行桌面版本。日记与附件只保存在用户选择的本地文件夹。

M1–M6 已完成，macOS 正式版为 `1.0.0`；macOS 当前版本为 `1.9.0`，Windows x64 保留 `1.7.0`。旧文件批量导入工具属于后续额外工作。

[项目规划](./docs/Diary-Project-Plan.md) · [进度与任务](./docs/Diary-Project-Progress.md) · [使用说明](./docs/Diary-User-Guide.md) · [平台支持与源码分区](./docs/Platform-Support.md) · [1.1.0 交互规划](./docs/Diary-Interaction-Iteration-Plan.md)

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

仓库根目录保留 README、`.gitignore`、`package.json`、Vite 和 TypeScript 配置。应用首次启动会要求选择已有日记文件夹；取消后仍停留在引导页。选定后可新建或打开日记，在原位渲染的编辑器中写作；停顿约 800 毫秒后自动保存，也可按 `⌘S`（macOS）或 `Ctrl+S`（Windows）保存。保存失败时草稿留在当前页面，可重新加载、确认覆盖保存或放弃草稿；更换文件夹前会再次尝试保存。

左侧底部的「设置」可更换日记文件夹、切换浅色与深色主题、选择绿色、浅粉、浅蓝或自选主题色，并从“帮助”打开使用说明；侧栏右下角可收起导航。中间列表可拖动分隔条调整宽度，或按列表边缘按钮折叠。三个区域各自滚动。打开日记后，右下角可将正文缩放至 50%–150%，也可让正文暂时占满整个窗口。日记列表显示当天的标签；标签可写成 `## 主标签 - 分支`，并在标签页按主标签聚合。

## 使用和备份

首次启动请选择一个**已有的**文件夹。应用不会替你创建根目录。每天的 Markdown 保存在 `<所选文件夹>/<年份>/<YYYY-MM-DD>.md`；附件保存在同一根目录的 `assets/<年份>/<日期>/`。在正文右键选择「插入插件 → 图片或附件…」，或将文件拖入编辑器、粘贴图片。单个文件须非空且不超过 20 MiB；PNG、JPEG、GIF、WebP、AVIF 可在编辑器及标签页预览，其余文件以链接形式打开。复制成功后才会插入相对链接；删除日记里的链接不会删除附件文件。

备份时请复制**整个日记根目录**，包括所有年份文件夹和 `assets/`。恢复或迁移时保持这套目录结构，再在应用中重新选择新位置。GitHub 仓库不包含你的日记和附件。侧栏可拖动右边缘调整宽度、收起，并在收起后从窗口左边缘悬停唤出；宽度与收起状态保存在应用设置中。

编辑日记首行的日期并保存时，应用会将文件改名并移至对应年份目录；目标日期已有日记时保留草稿并提示冲突。日记列表右键可删除日记：文件会移入所选根目录的 `Trash/`，附件保持原状。恢复时请先确认目标日期没有同名文件，再将回收文件移回对应年份目录，并把文件名恢复为 `YYYY-MM-DD.md`。

## 安装

macOS 当前版本为 `1.9.0`，Windows 保留 `1.7.0`。默认后续更新只发布 macOS，Windows 仅在明确要求时更新。安装包从 [GitHub Release](https://github.com/Yangsw0-0/Diary/releases) 下载。

### macOS

适用于 Apple 芯片 Mac：[Diary_1.9.0_aarch64.zip](https://github.com/Yangsw0-0/Diary/releases/download/v1.9.0/Diary_1.9.0_aarch64.zip)。解压后退出旧版 Diary，再将 `Diary.app` 拖到「应用程序」文件夹替换旧版。首次运行请选择一个已有的日记文件夹。应用使用临时（ad hoc）签名，未做 Apple 公证；macOS 若阻止打开，请在系统设置的「隐私与安全性」中确认你信任此应用后手动放行。

### Windows

适用于 Windows 10/11 x64：[Diary_1.7.0_x64-setup.exe](https://github.com/Yangsw0-0/Diary/releases/download/v1.7.0/Diary_1.7.0_x64-setup.exe)。运行 NSIS 安装程序即可，按当前用户安装，不需要管理员权限；升级时直接运行新安装包覆盖安装。

Windows 11 已内置 WebView2；Windows 10 缺少时，安装程序会联网下载运行时。安装包未做代码签名，SmartScreen 可能提示“未知发布者”，确认文件来自本仓库后可选择“更多信息 → 仍要运行”。当前不提供 MSI 和 Windows ARM64 版本。

两个平台的平台矩阵、行为差异和源码分区见 [平台支持与源码分区](./docs/Platform-Support.md)。附件上限均为单个 20 MiB；删除正文中的附件链接不会清理附件文件，清理时请在备份后手动核对。项目不提供云同步或自动备份，建议定期复制整个日记根目录。不要忽略来源不明安装包的安全提示。

## 本地开发

准备 Node.js 24 或更新版本、npm 和 Rust stable。macOS 还需要 Xcode Command Line Tools；Windows 还需要 Visual Studio 2022 Build Tools 的“使用 C++ 的桌面开发”和 Rust MSVC 工具链。若用 Homebrew 安装 `rustup`，先让当前终端能找到 Rust 工具链：

```sh
export PATH="$(brew --prefix rustup)/bin:$HOME/.cargo/bin:$PATH"
rustup default stable
```

然后在仓库根目录运行：

```sh
npm ci
npm run tauri:dev   # 启动桌面窗口和 Vite 开发服务器
npm run check       # 格式、lint、Vitest、类型检查、前端生产构建
npm run tauri:build # 打包桌面应用（macOS 生成 .app）
npm run tauri:build -- --bundles nsis # Windows 上生成 NSIS 安装程序
```

只预览前端界面时可运行 `npm run dev`，打开 `http://localhost:1420`。此时没有 Tauri 文件系统能力，工作区状态会提示连接失败。Rust 端单独检查可运行 `cargo check --locked --manifest-path src-tauri/Cargo.toml`。

平台相关的系统调用集中在 `src-tauri/src/platform/`，业务代码不直接判断操作系统；Windows 专属打包配置在 `src-tauri/tauri.windows.conf.json`。M2 已实现 `choose_diary_root`、`get_workspace_status`、`list_diaries`、`read_diary` 和 `save_diary`。M3 已接入 Milkdown Crepe：编辑器允许规范化 Markdown（例如列表符号），按日期新建和打开，保存时使用 revision 冲突检测。M4 已接入标签提取与聚合：顶层二级标题作为标签，保存后更新当天索引，标签详情只读并在展示前核对原文件 revision。M5 已支持点击标签日期跳回原日记小节，以及后退、前进和阅读位置恢复；导航历史仅保存在本次运行的内存中。用户选择的根目录记录在应用配置目录的 `settings.json`，日记正文仍只存在于用户选定的文件夹。存储测试使用临时目录，不使用真实日记。

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

1.6.3 调整节点时间轴：取消跨年刻度，节点恢复「年.月.日」并紧贴轴线，日期不再使用引线，起点只留圆环，修复轴线右端与箭头之间的断线。

1.6.2 修正节点画布：时间轴年份刻度移到轴线上方独立一行，起点圆点回到轴线，恢复节点到日期/事件标签的虚线引线，保存指示器浮到右上角不再占行，「to be continue…」移到箭头下方；轮盘卡片降低高度、标题限两行、年份居中、笔刷渐变拉长、铅笔放大。

1.6.0 调整节点画布：事件卡片改为「月.日」加小字年份、铅笔居中、右侧长笔锋的笔刷底色与自适应宽度；时间轴加入跨年刻度、节点只标月日、虚线引线，并重排起点与「to be continue…」；时间轴与轮盘之间的分隔线可拖动并记住高度。

1.5.1 微调节点画布：事件卡片不再直接显示色块、改色统一在铅笔弹窗，移除时间轴左上标题，收紧时间轴并上移分隔线，加宽笔刷底色并在中心侧半圆渐隐，时间轴标题两行、卡片标题三行，新事件概述限制 36 字。

1.5.0 重做节点画布：日期与事件交替排布的时间轴、可居中对齐的拖动与「起点 / to be continue…」边界、无边框笔刷事件卡片、长指针和圆环装饰；同时修复节点保存失败离开提示、拖动后点击色块、OneDrive 目录兼容和损坏文件中文提示。使用方式见设置中的帮助。

1.7.0 词云栏目：可拖动球形词云、动态标签联动、自定义词语与三种线条模式；数据保存在WordCloud.json，详见[词云架构](./docs/Word-Cloud-Architecture.md)。
