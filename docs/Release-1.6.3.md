# Diary 1.6.3

节点时间轴的回归与修正版本，数据格式与 1.6.x 兼容。

## 本版内容

- 取消时间轴上的跨年刻度与年份文字，改为在每个节点标注完整日期「年.月.日」。
- 日期直接紧贴轴线上方或下方，不再使用引线；事件标题继续保留虚线引线。
- 起点位置只保留空心圆环，删除「起点」二字。
- 修复轴线最右端与箭头之间的断线，轴线现在连续连接到「to be continue…」的箭头。
- 轮盘保持 1.6.2 的紧凑卡片、两行标题与加长笔刷渐变。

## 安装包

| 平台 | 文件 | 大小 | SHA-256 |
| --- | --- | --- | --- |
| macOS Apple 芯片 | `Diary_1.6.3_aarch64.zip` | 6,203,587 字节 | `63a488a8c1fec49dbb26d1771be1a673846dfe0291b794bb22746096d68d89de` |
| Windows 10/11 x64 | `Diary_1.6.3_x64-setup.exe` | 4,222,299 字节 | `fee1d9ce9f0e921e7e864ed89de22001e2acdc9a5bac5206319a62bf0eea6a66` |

## 验证

- 前端 `npm run check` 通过：格式、lint、113 项测试、类型检查与生产构建。
- Rust `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`（23 项）通过；Windows 目标 clippy 通过。
- macOS 应用以 ad-hoc 签名构建，`codesign --verify --deep --strict` 通过，未做 Apple 公证。
- Windows 安装包由 GitHub Actions 的 `windows-latest` 任务构建并上传；Windows 真机安装与窗口交互验收仍待完成。

## 已知限制

- macOS 包未公证，首次打开可能需要在系统设置中手动放行；Windows 包未签名，SmartScreen 可能提示“未知发布者”。
- 日期标签紧贴轴线，在极窄窗口或相邻日期很近时可能与圆点拥挤，需要继续实机观察。
- 节点仍不支持搜索、按颜色筛选与导入导出；色板保存在本机设置中，不随 `Nodes.json` 迁移。
