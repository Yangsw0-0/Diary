# Diary 项目记忆

> 最近核对：2026-11-23。此文件记录当前实现与验收状态；历史计划仍见[项目规划](./Diary-Project-Plan.md)，逐项进度见[进度文档](./Diary-Project-Progress.md)。

## 当前版本与平台

- macOS Apple 芯片本轮版本为 `1.8.1`（[发布记录](./Release-1.8.1.md)）；Windows 10/11 x64 当前版本为 `1.7.0`（[发布记录](./Release-1.7.0.md)）。Windows 真机窗口验收仍待完成。
- M1–M6 已完成。M7 Windows 适配的自动检查与打包已通过；**M7-07 Windows 真机安装和窗口交互验收仍待完成**。不得把 CI 成功表述为真实 Windows 设备已验收。
- 已发布1.7.0的验证记录：前端130项、Rust26项及严格clippy通过；macOS 1.7.0 安装包已构建、ad-hoc 签名并打出 ZIP（SHA-256 见发布记录）；Windows 安装包已由 CI 构建，两个安装包的 ZIP/EXE 摘要均已核对；节点画布拖动、时间轴居中和轮盘手感仍需实际窗口复核。

- 用户发布约定：非特别说明，今后仅更新/打包/发布 macOS；Windows 保留 1.7.0，只有明确要求才构建发布。CI Windows 改为手动工作流 build_windows=true。每次仍须在 releases/v<版本号>/ 留存 macOS 安装包及摘要。

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
- 原生固定路径、拒绝符号链接与Windows重解析点（1.5.0 起 Nodes.json 不再按重解析点拒绝，仅拒绝链接/非普通文件）；首次硬链接发布，已有文件原子替换。任意外部软件与替换间仍可能竞态，不宣称跨进程事务。
- 前端107项、Rust23项测试及严格clippy已通过；macOS版本、签名、ZIP和摘要已核对；功能提交的前端/macOS/Windows三项CI均已通过；节点窗口手感和Windows真机待验收。

节点模拟画布已用内存示例核对布局、弹窗新增同日第二事件、轮盘拖动联动；示例未访问真实日记。模拟浏览器验收不代表原生输入与系统窗口生命周期的完整验收。

## 1.6.0 节点画布调整（2026-11-21）

- 轮盘卡片左侧改为「月.日」在上、年份在下（年份字号更小），标题后不再有第二个分隔符，铅笔移到卡片右侧中部。
- 卡片宽度改为 `clamp(250px, 30vw, 520px)`；笔刷底色 `::before` 改为 `inset: -14px -112px -14px -10px`、`filter: blur(9px)` 与水平遮罩，左/上/下窄边渐隐，右侧保留约 118px 长笔锋；标题自动换行。
- 时间轴节点只标「月.日」，引线改为虚线；新增 `yearTicks`，按每个跨年边界渲染刻度，左侧旧年、右侧新年，无事件的年份也保留两个边界；起点年份与「to be continue…」重排到轴线末端。
- 时间轴与轮盘之间改为可拖动分隔线：最小 120px、轮盘至少 220px，键盘 ↑/↓ 与 Home/End 可调，高度存 `diary.nodeTimelineHeight.v1`。
- 测试新增 `yearTicks` 跨年断言与分隔线拖动/持久化用例；前端 110 项测试通过。
- 1.6.0 两个安装包已由本地构建/CI 产出，ZIP 与 EXE 的大小和 SHA-256 已写入发布记录。
- 验证：`npm run check` 通过；Rust 23 项、fmt、严格 clippy 通过；macOS 1.6.0 包构建与摘要见 [发布记录](./Release-1.6.0.md)。

## 1.5.1 节点画布微调（2026-11-21）

- 移除轮盘卡片右侧的六个色块，改色统一在铅笔编辑弹窗中完成；`NodeWheel` 不再接收 `onColor`，`NodesPanel` 的颜色更新入口只剩编辑弹窗。
- 移除时间轴区域左上角的「节点」标题，`.nodes-header` 改为右对齐，仅保留保存状态。
- `.node-timeline` 高度从 200px 收到 176px，分隔线上移，轮盘获得更多空间。
- 事件卡片宽度改为 `clamp(280px, 34vw, 480px)`、高度 92px；笔刷底色 `::before` 扩展为 `inset: -26px -54px`，`mask-image` 改为 `radial-gradient(ellipse 122% 66% at 4% 50%, transparent 0, #000 12%, #000 58%, transparent 99%)`，中心侧渐隐成半圆边界，正方向不透明区更远。
- 时间轴事件标题最多 2 行（宽度 200），卡片标题最多 3 行；新事件标题输入限制 36 字（旧数据仍可读取）。`labelLayout` 默认宽度改为 64/200，2 条 lane，offset `12 + lane * 36`。
- 测试更新：面板测试不再点击卡片色块，改为点击铅笔打开弹窗后选「颜色 2」；`labelLayout` 断言改为 64/200 与 offset ≥12。前端仍为 109 项测试。
- 验证：`npm run check` 通过；Rust 23 项测试、fmt、严格 clippy 通过。

## 1.5.0 节点画布改版（2026-11-21）

- 时间轴改为「日期与事件分列轴线两侧、上下交替」，圆点缩为 7px 空心点，聚焦时以事件颜色填充并加光晕；新增轴线渐变、起点圆环和「to be continue…」箭头，时间轴两端渐隐，隐藏滚动条。
- 时间轴内边距改为半屏宽，首末事件都能滚到中央；拖动结束会吸附并聚焦最近事件，时间轴焦点与轮盘指针双向对齐。滚动时仅在拖动或最近的触控板手势内跟随焦点，避免平滑居中被自身滚动打断。
- 轮盘事件卡片去掉边框，改用 `::before` 色块叠加径向遮罩：沿正方向长渐变、垂直方向短渐变，形成笔刷软边；卡片内改为「日期 · 标题 · 六个手绘感色块」的分隔排版，卡片仍随转子旋转。
- 轮盘新增长指针（轴心、细线、箭头）与实线/虚线圆环装饰；卡片焦点态提高不透明度，色块只在悬停、聚焦或当前事件显示。
- 修复离开节点页忽略保存失败、拖动后首次点击色块/铅笔被吞、`pointerup` 使用旧位置、色块与删除异常未捕获、`reset` 残留 saving、覆盖保存被进行中保存忽略、`rows` 未 memo、焦点重复发布、`wheelWindow` 全量分配、损坏 JSON 英文报错直出等问题。
- `Nodes.json` 读取改用平台安全打开并二次核对文件类型；不再按 Windows 重解析点拒绝整个文件（兼容 OneDrive 云盘目录），仍拒绝符号链接和非普通文件。备份在硬链接不可用时回退为同目录重命名。
- 验证：前端 109 项测试、类型检查、格式与构建通过；Rust 23 项测试、fmt 与严格 clippy 通过；macOS 1.5.0 安装包签名与 ZIP 摘要已核对。节点拖动、轮盘旋转手感与 Windows 真机验收仍待用户确认。


## 1.6.3 节点时间轴修正（2026-11-21）

- 删除 `yearTicks`/`YearTick` 与时间轴上的跨年刻度、年份文字；节点日期标签恢复完整 `YYYY.MM.DD`，`labelLayout` 日期宽 76px、偏移 14px（第二层 30px），事件仍为 216px、偏移 40px 起。
- 日期标签不再生成 `.node-leader`，直接贴近轴线上方/下方；事件标签继续保留事件色虚线引线。
- 删除起点「起点」文字，只保留空心圆环；`.node-origin` 仍以圆心对齐轴线。
- 轴线右端改为连续到 `continueX`，与箭头线相接，修复原先 14px 断口。
- 测试更新：日期宽度 76、偏移 ≥14；删除 `yearTicks` 断言。前端 113 项测试通过。
- 验证：`npm run check` 通过；Rust 23 项、fmt、严格 clippy 通过；macOS 1.6.3 包 6,203,587 字节，SHA-256 `63a488a8c1fec49dbb26d1771be1a673846dfe0291b794bb22746096d68d89de`；Windows 包 4,222,299 字节，SHA-256 `fee1d9ce9f0e921e7e864ed89de22001e2acdc9a5bac5206319a62bf0eea6a66`；两包摘要已与 GitHub Release 核对。

## 1.6.2 节点画布修正（2026-11-21）

- 时间轴的跨年刻度改为轴线上的短竖线，年份文字移到轴线上方独立一行；`labelLayout` 的标签偏移由 12px 提高到 40px（第二层 78px），避免年份与「月.日」或事件标题重叠。
- 起点圆环的圆心落回轴线（`.node-origin` 不再整体垂直居中）；`to be continue…` 改为箭头线在轴线上、文字在箭头下方。
- 节点新增独立的 `.node-leader` 虚线引线，从圆点分别连到日期标签和事件标签；日期引线用前景色、事件引线用事件色。原先挂在标签上的 `::before` 会被 `overflow:hidden` 裁掉，已删除。
- `.nodes-header` 改为绝对定位在画布右上角，只保留保存指示器且不占布局高度；`.nodes-error` 顶部留 40px 避开指示器。
- 轮盘卡片高度由 92px 降到 68px，标题限 2 行、字号 15px；年份在日期列居中；笔刷 `::before` 的水平遮罩改为 55% 后开始渐隐到 100%，右侧拖尾更长；铅笔按钮 28px、字号 15px。
- 测试：`labelLayout` 偏移断言改为 ≥40；前端 113 项测试通过。
- 验证：`npm run check` 通过；Rust 23 项、fmt、严格 clippy 通过；macOS 1.6.2 包构建与摘要见 [发布记录](./Release-1.6.2.md)。

## 1.6.1 设置分类重构（2026-11-21）

- 基于1.6.0现状重构设置，正式安装包版本更新为1.6.1，安装包放入releases/v1.6.1/并上传GitHub Release。
- 设置改为左分类/右具体设置：个性化、编辑与阅读、文件与存储、帮助。分类与详情各自滚动；支持竖向tabs的方向键、Home/End及Tab导航。
- `features/settings/SettingsPanel.tsx`仅负责分类导航和组合；`SettingsCatalog.ts`集中注册分类与组件，校验非空与唯一ID，支持新增分类而不改外壳。各分类独立文件，输入接口统一在`settingsTypes.ts`，样式移至模块内`settings.css`。
- 延用现有主题/排版回调和组合根共享的NodePalette；分类切换不写偏好，不改变目录保存、节点和日记逻辑。设置关闭后重新进入默认个性化；分类选择不持久化。

本轮验证：`npm run check`完整通过（113项测试、类型检查和生产构建；lint仍有既有警告）。浏览器内存预览已核对浅/深色和560px设置区域下的分类显示、排版换行；未读写真实日记，未替代原生安装包验收。

## 1.7.0 词云栏目（2026-11-23）

- 在1.6.3基础上新增wordcloud canvas导航，与日记/标签/节点同级；复用导航历史与openTag，不影响日记边界翻页。
- 新WordCloudSession与TauriWordCloudRepository，用户目录根WordCloud.json保存自定义UUID词及配置，不存标签副本。标签由TagIndex全部主标签（含隐藏）派生，NFC文本合并但保留独立来源。
- Canvas 2D自研SphereRenderer：Fibonacci Sphere/四元数、共用投影的网格与近邻线、背面剔除、前侧渐变、碰撞避让、惯性、DPR及资源清理，无新增依赖。详见[词云架构](./Word-Cloud-Architecture.md)。
- 自动保存与关闭/失焦/模块切换/目录切换保护接入；目录reset隔离旧异步结果，读取损坏不覆盖。自定义500词、每词120字符、文件512KiB，标签不受500条限制。
- 当前发布版本更新为1.7.0，包含词云功能；浏览器模拟验证不等价于原生/Windows真机验收。

本轮验证：`npm run check`通过（130项前端测试、类型检查、格式/lint与生产构建，仍有既有lint和打包体积提示）；Rust fmt、严格clippy、26项测试通过。Canvas单元测试覆盖2000词避让；浏览器内存示例验证球面点击进入真实标签内容组件、面板伸缩、添加、标签开关及亮暗主题。原生双平台窗口与超大真实库FPS未作手工验收。

词云最终源码提交a94c12f的[跨平台CI](https://github.com/Yangsw0-0/Diary/actions/runs/45097956403)三项均通过：前端130项与构建、macOS Rust检查、Windows Rust检查与NSIS打包。缩放同步补画已在浏览器重新核对，窗口变窄后无需等待下一帧才恢复球面。后续已随1.7.0安装包发布。

## 本地安装包保留规则（用户要求，2026-11-23）

每次版本更新或发布都必须在本地`releases/v<版本号>/`保留macOS安装包，核验版本、ZIP完整性和SHA-256；不能仅留GitHub或.cache，历史包不自动清理，安装包不进入Git。该规则同时写入AGENTS.md。

本次核对GitHub最新公开Release仍为v1.6.3，已重新下载macOS包到releases/v1.6.3/Diary_1.6.3_aarch64.zip，与既有本地包及GitHub摘要一致：63a488a8c1fec49dbb26d1771be1a673846dfe0291b794bb22746096d68d89de。词云仍为未发布源码，此包不含词云；下载现有Release不等同于发布新源码安装包。

## 1.7.0 词云安装包发布（2026-11-23）

词云已打包为1.7.0，两个平台安装包均保存在本地releases/v1.7.0/；macOS ZIP与Diary.app版本、签名和完整性已核对，Windows EXE来自同版本CI。130项前端、26项Rust测试及[三项CI](https://github.com/Yangsw0-0/Diary/actions/runs/45111079085)通过；摘要与下载见[发布记录](./Release-1.7.0.md)。原生双平台窗口与超大真实词集帧率仍待手工验收。先前“词云未发布”“最新Release为1.6.3”的文字为发布前历史记录，以本节和当前版本为准。

## 1.8.0 使用体验优化（2026-11-23）

- 帮助按日常功能重写，不再混入版本迭代日志。
- 词频按正式 H2 occurrence 统计（分支并入主标签），上累计百分位分四档；同频同级，未使用词半透明。自定义来源持久化不变，当前标签类别实时派生，显示身份不变。
- CloudTagWriter 复用日记保存流程追加今日 H2，逐字符保留已有正文、去重和校验 Markdown 上下文；追加后保存失败仍打开可重试的今日草稿。
- 标签详情仅转换展示 AST 的 HTML break 和装饰空段；代码/转义和原文件不改。词云局部双轴 wheel、节点纵轴 wheel，增量归一化，不额外叠加系统惯性；原相邻日记算法未改。
- 本轮前端 143 项、Rust 26 项、类型/构建/fmt/严格 clippy 通过。macOS 1.8.0 包已生成并核对版本/arm64/签名/ZIP，摘要见发布记录，本地 releases/v1.8.0/ 留存。真实 macOS 触控板手感及实际高频连续操作仍需用户复核；本轮未做原生手势手工验收。Windows 不构建，继续标记已发布 1.7.0。

1.8.0 已推送并正式发布：[Release](https://github.com/Yangsw0-0/Diary/releases/tag/v1.8.0)，源码提交7fe4734；[CI](https://github.com/Yangsw0-0/Diary/actions/runs/45135585364)前端与macOS成功、Windows跳过。发布资产只有核对过的macOS ZIP，远端digest与本地一致。

## 1.8.1 节点径向轮盘（2026-11-23）

- NodeWheelGeometry统一半径、轨道带、日期/正文/短连接相对偏移。日期居两线之间、正文在实线外，共用旋转父级与连续卡片背景，不改上方时间轴。
- 独立SVG轨道轮廓固定，stroke-dashoffset由实际角度和各自半径计算；与rotor共用280ms ease-out，直接输入时无transition，减少动态效果时均关闭。没有额外装饰循环或依赖。
- 指针改为实线旁16px短连接、标题最多三行，距离驱动非焦点透明度。原节点数据格式/存储与鼠标、纵向触控板交互保持。
- 前端146项、Rust26项、类型/lint/格式/构建通过。浏览器内存示例已核对亮暗主题、520/760px内容宽度、长标题、正向/反向焦点与编辑弹窗。未访问真实节点；原生macOS触控板手感和持续高频帧率尚未测量。
- macOS1.8.1包版本、arm64、ad hoc签名、ZIP及摘要已核对，本地releases/v1.8.1/保留；Windows继续1.7.0，本轮不构建。详细结构见Node-Wheel-Layout.md。
