# Diary 1.5.1

发布日期：2026-11-21

## 本版内容

1.5.1 对节点画布做细节微调：

- **改色入口统一**：移除事件卡片右侧直接显示的六个色块，颜色统一在铅笔编辑弹窗中选择；卡片更简洁，标题获得更多宽度。
- **时间轴标题**：移除时间轴区域左上角的「节点」标题，保存状态仍显示在右上角。
- **空间分配**：时间轴高度收紧，与轮盘之间的分隔线上移，把更多高度留给轮盘。
- **笔刷底色**：事件卡片加宽，底色沿远离轮盘的方向延伸更远、文字区域更宽；靠轮盘中心一侧改为半圆渐隐，与上下软边共同形成更完整的笔刷形状。
- **多行标题**：时间轴事件标题最多两行，轮盘卡片标题最多三行；新事件的时间概述限制为 36 字，保证完整显示，不再用省略号截断。旧数据中更长的标题仍可读取。

macOS 与 Windows 使用同一套节点数据和交互，差异仅限平台打开方式与打包配置；详见[平台支持与源码分区](https://github.com/Yangsw0-0/Diary/blob/main/docs/Platform-Support.md)。

## 安装包

| 平台 | 文件 | 大小 | SHA-256 |
| --- | --- | --- | --- |
| macOS（Apple 芯片） | `Diary_1.5.1_aarch64.zip` | 5.91 MiB（6,202,129 字节） | `3a93594c2018654b7d6eac65d63ff38ff9f191cad70eced2feb9409c7f384e78` |
| Windows（10/11 x64） | `Diary_1.5.1_x64-setup.exe` | 4.02 MiB（4,217,059 字节） | `fc0562e9d69eb440e61883a900e8e8aa019f0b3badfca4d55433f624cdf07f73` |

macOS 安装包使用临时（ad hoc）签名，未做 Apple 公证；首次打开若被阻止，请在「系统设置 → 隐私与安全性」中确认来源后放行。Windows 安装包未签名，SmartScreen 可能提示「未知发布者」。

## 验证

- 前端：`npm run check`（Prettier、oxlint、109 项测试、TypeScript 类型检查、Vite 生产构建）通过。
- Rust：`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`（23 项）通过。
- macOS：`Diary.app` 版本 1.5.1、arm64，`codesign --verify --deep --strict` 通过，ZIP 摘要见上表。
- Windows：GitHub Actions Windows 任务完成 NSIS 构建与单元测试；真机窗口交互仍待验收。

## 已知限制

- 新事件概述限制 36 字；更长的旧标题在时间轴两行、卡片三行内显示。
- 节点拖动、轮盘旋转和触控板手感仍需实际窗口确认；自动测试不能替代原生输入验收。
- Windows 真机安装、窗口布局与附件打开尚未完成逐项验收。
- 节点暂不支持搜索、筛选和导入导出；`Nodes.json` 请与日记、附件一起备份。
