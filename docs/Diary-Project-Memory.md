# Diary 项目记忆

> 最近核对：2026-11-21。此文件记录当前实现与验收状态；历史计划仍见[项目规划](./Diary-Project-Plan.md)，逐项进度见[进度文档](./Diary-Project-Progress.md)。

## 当前版本与平台

- macOS Apple 芯片当前版本为 `1.4.0`（[发布记录](./Release-1.4.0.md)）；Windows 10/11 x64 最新安装包为 `1.3.0`（[发布记录](./Release-1.3.0.md)）。Windows 真机窗口验收仍待完成。
- M1–M6 已完成。M7 Windows 适配的自动检查与打包已通过；**M7-07 Windows 真机安装和窗口交互验收仍待完成**。不得把 CI 成功表述为真实 Windows 设备已验收。
- 本地前端 `npm run check` 通过，测试为 107 项；Rust 23 项测试与严格 clippy 通过，macOS 1.4.0 ZIP 已构建、签名并校验；新触控板交互仍需实际窗口手感复核。

## 架构与数据边界

- 前端使用 React 19、TypeScript 和 Milkdown Crepe，桌面与文件层使用 Tauri 2、Rust。日记正文以用户选择目录中的 Markdown 文件为唯一真实来源；附件位于同一根目录的 `assets/`。Git 与发布附件不得包含真实日记、附件、缓存或 `notes/`。
- macOS 与 Windows 共用业务逻辑和日记目录结构。系统打开链接/文件、安全读取附件由 `src-tauri/src/platform/` 门面分派到 `macos.rs`、`windows.rs`。Windows 打包差异在 `src-tauri/tauri.windows.conf.json`；自动检查在 `.github/workflows/check.yml`。
- 两个平台均无自动更新和云同步。升级安装程序不代替日记根目录备份。旧单文件日记批量导入仍是额外工作，不属于 M7。
- macOS 相邻日记手势使用 `src-tauri/src/scroll_phase.rs` 的 AppKit 滚动阶段事件判断手指松开；Web 前端 `AdjacentDiaryNavigator` 负责阈值、回弹和一手势一页。向上翻页落在目标结尾，向下翻页落在目标开头。`AppearancePreferences` 独立保存列表底色、正文行距和字距于应用 WebView 的 localStorage，不改动日记 Markdown。
- 左侧栏写作统计由 `DiaryStatistics` 从 `DiarySession.entries` 派生，只统计当前文件夹已保存且成功载入的日记；可见字符按 Markdown 解析后统计，并按日期、revision 与原文缓存。卡片位于设置分隔线上方，文件载入失败时提示数字不完整；统计不写入日记或额外数据库。

## 本次审查发现的待处理项

1. **新建文件回退已改为失败关闭（1.3.3）。** 已移除直接向最终路径复制的回退；硬链接不支持时返回错误并保留草稿。exFAT/FAT32 等目录的无覆盖原子发布仍待实现，当前不承诺支持。
2. **Windows 重解析点防护缺少专项验证。** `src-tauri/src/platform/windows.rs` 使用 `FILE_FLAG_OPEN_REPARSE_POINT` 打开附件，再检查 `file_type().is_symlink()`；目录和文件路径也用 `symlink_metadata` 检查。当前 Windows CI 主要证明编译、通用单元测试和打包成功，尚无 Windows 符号链接、目录联接或其他重解析点的专项用例。发布文档中的“拒绝目录联接”需要在 Windows 真机或 CI 中以用例证实；如需拒绝所有重解析点，应检查 [`FILE_ATTRIBUTE_REPARSE_POINT`](https://learn.microsoft.com/windows/win32/fileio/reparse-point-operations) 等 Windows 属性。
3. **窗口级验收未完成。** 首次选目录、中文输入、自动保存与失败恢复、标签/导航、附件打开、改日期、删除日记和小窗口布局仍需在真实 Windows 10/11 x64 设备上逐项检查；长路径和缺少 WebView2 的 Windows 10 也尚未实测。

以上待处理项是审查发现的风险或验证缺口，不表示 CI 或现有安装包已失败。修改实现前先用测试复现具体行为；版本状态变化后更新本文件与[平台支持文档](./Platform-Support.md)。

## 1.3.3 维护改动

- 修复无目标的边界手势进入锁定状态，以及物理触控未结束时提前解锁。
- `EditorReadiness` 统一等待者清理与就绪、取消、超时结果；翻页等待后再次检查取消标记。
- 相邻日记交互已提取至 `useAdjacentDiaryNavigation`；AppShell 保留布局与组合职责。
- 组合根共享 `MarkdownDocumentCache` 给标签提取和写作统计；按原文命中，LRU 上限为 256 篇、合计 200 万 UTF-16 字符（非精确堆内存上限），超大文档不缓存，切换工作区清理。超过容量时可能重新解析，不宣称所有文档始终只解析一次。

本轮源码验证：前端 98 项测试、类型检查、lint（仍有既有警告）及构建通过；Rust 19 项测试与 clippy 严格检查通过。原生触控板手感仍需用户复核；不能用自动测试代替真机交互验收。

## 1.4.0 节点模块（2026-11-21）

- 工作计划：[节点计划](./Diary-Node-Plan.md)。用户确认一天一个节点、一天可有多条事件；version=2 的 events[] 结构，支持v1单事件模型内存迁移，未知版本不覆盖。
- Nodes.json 位于日记目录根下，首次新增保存才创建；扫描与写作统计忽略它。最多1000个事件/4MiB。
- NodesSession 独立串行保存、800ms防抖、revision校验、冲突和损坏保护；切换目录前flush，reset隔离旧读取结果。
- NodePalette 由组合根共享，键 diary.nodeColors.v1；文件仅保存颜色槽位，色板迁移需另行设置。
- 原生固定路径、拒绝符号链接与Windows重解析点；首次硬链接发布，已有文件原子替换。任意外部软件与替换间仍可能竞态，不宣称跨进程事务。
- 前端107项、Rust23项测试及严格clippy已通过；macOS版本、签名、ZIP和摘要已核对；功能提交的前端/macOS/Windows三项CI均已通过；节点窗口手感和Windows真机待验收。

节点模拟画布已用内存示例核对布局、弹窗新增同日第二事件、轮盘拖动联动；示例未访问真实日记。模拟浏览器验收不代表原生输入与系统窗口生命周期的完整验收。
