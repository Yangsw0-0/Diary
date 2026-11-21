# Diary 1.6.2

节点画布可用性修正版本，数据格式与 1.6.x 兼容。

## 本版内容

- 时间轴年份刻度移到轴线上方独立一行，起点圆点回到轴线，节点到日期/事件标签的虚线引线恢复显示。
- 保存状态指示器改为浮在画布右上角，不再占据布局行高；时间轴直接顶到窗口上方。
- 「to be continue…」移到箭头线下方。
- 轮盘卡片高度收紧、标题最多两行，左侧年份居中；右侧笔刷渐隐拉长；铅笔按钮放大。

## 安装包

| 平台 | 文件 | 大小 | SHA-256 |
| --- | --- | --- | --- |
| macOS Apple 芯片 | `Diary_1.6.2_aarch64.zip` | 6,203,940 字节 | `841159bcacdfdd9ae6accd09aaee0d422dab1369ccb51c69c0228a81c8b9b577` |
| Windows 10/11 x64 | `Diary_1.6.2_x64-setup.exe` | 4,222,070 字节 | `b82f3546881d4284ba387e4a3e6b7df94e295239418380657fbebd88bb23422d` |

## 验证

- 前端 `npm run check` 通过：格式、lint、113 项测试、类型检查与生产构建。
- Rust `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`（23 项）通过；Windows 目标 clippy 通过。
- macOS 应用以 ad-hoc 签名构建，`codesign --verify --deep --strict` 通过，未做 Apple 公证。
- Windows 安装包由 GitHub Actions 的 `windows-latest` 任务构建并上传；Windows 真机安装与窗口交互验收仍待完成。

## 已知限制

- macOS 包未公证，首次打开可能需要在系统设置中手动放行；Windows 包未签名，SmartScreen 可能提示“未知发布者”。
- 年份刻度与节点标签在极窄窗口、事件特别密集时仍可能互相遮挡，需要继续实机观察。
- 节点仍不支持搜索、按颜色筛选与导入导出；色板保存在本机设置中，不随 `Nodes.json` 迁移。
