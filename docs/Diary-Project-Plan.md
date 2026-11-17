# Diary 项目规划

Diary 是一个本地 Markdown 日记应用。日记页用于写作和按日期回看，标签页把不同日期下的同名主题小节集中展示。首个正式版仅面向 macOS；完成 M6 的功能与验收后发布 `1.0.0`。

## 1. 首版范围

- 新建、查看和编辑某一天的日记，正文在同一编辑区实时渲染。
- 以 UTF-8 Markdown 保存日记，打开应用后按日期列出本地已有条目。
- 从二级标题提取主题，把同名小节按日期堆叠展示。
- 使用 shadcn/ui 搭建界面。左侧功能栏可调宽、可收起，收起时支持鼠标贴边唤出。
- 旧版单文件日记的批量导入属于正式版之后的额外工作，不阻碍首版发布。
- Markdown 文件是正文的唯一真实来源。标签索引和列表摘要可重建，不建立第二份正文数据库。
- 首次启动必须由用户选择日记根文件夹；未选择时保持在引导页，不默认选择或创建任何日记目录。
- 支持将图片和其他附件复制进所选文件夹，并以相对路径写入 Markdown。

## 2. 界面布局

| 区域 | 交互 |
| --- | --- |
| 左侧功能栏 | 显示「日记」「标签」。展开默认占窗口约四分之一，拖动可调至约三分之一，记住上次宽度。手动收起后，鼠标进入窗口左侧触发区时临时浮出，移出触发区和菜单后收起。临时浮出覆盖内容，避免正文重新排版。 |
| 日记页中间列表 | 按日期倒序显示有日记的日子。行格式为 `11.16 开始实习的第一天`，日期补零并固定显示，长标题用省略号截断。跨年处用细线分组，在线的上方和下方分别用灰色居中小字标出对应年份。 |
| 日记页右侧正文 | 点击列表条目后直接阅读和编辑当天。提供「新建日记」，当天已有日记时直接打开。编辑时正文就在原位显示标题、粗体、列表、图片等排版效果，没有只读阅读模式的切换要求。编辑器保存时可以规范化 Markdown 写法。停顿后自动保存，也可用 `⌘S` 立即保存。 |
| 标签页中间列表 | 主列表显示在至少两天出现的主题，单次主题收在可展开的「仅出现一次」分组。每组按最近一次出现的日记日期倒序排列。 |
| 标签页右侧正文 | 每次出现对应一个只读内容块，左上角以灰色小字显示完整日期，下面展示所选主题的正文。区块按日期倒序堆叠，用细线分隔。点击日期跳到原日记对应的小节编辑。 |
| 顶部导航 | 提供类似浏览器的「后退」「前进」。从标签跳到原日记、改完后后退，应恢复原标签和阅读滚动位置；再前进可回到刚才的日记位置。 |

## 3. 文档格式与主题提取

首次启动显示选择文件夹引导页，由用户选择一个**已经存在**的日记根文件夹；应用不预选、不自动创建文件夹，取消选择则继续停留在引导页。所选路径保存在应用配置目录的 `settings.json` 中，配置只存路径和界面偏好，不存正文。下次启动先检查该路径是否仍存在且可读写；不可用时提示重新选择。设置页允许更换根文件夹，更换前先完成或明确处理未保存草稿。提供「打开日记文件夹」方便查看与备份。

日记位于所选根文件夹的年份子目录，每天一个文件，例如 `2026/2026-11-16.md`。只有用户选择文件夹并首次成功保存相应日记时，才创建所需的年份目录和文件。日期以文件名为准，正文首行必须是 `# YYYY-MM-DD 可选标题`，且日期与文件名一致；新建时由应用生成该首行。日期列表只展示一次月日，一级标题没有附加标题时只显示日期。文件名与年份目录必须一致，按 ISO 日期排序；文件采用 UTF-8 与 `\n` 换行，读取兼容 `\r\n`。不符合首行规则的现有文件仍保留在原处，扫描时逐项提示；保存不写入不符合规则的内容。

图片及附件统一复制到所选根目录的 `assets/<年份>/<日期>/<生成的唯一文件名>`，日记中使用相对路径，例如 `![说明](../assets/2026/2026-11-16/abc123.png)`。粘贴或拖入图片时显示预览；其他附件插入普通 Markdown 链接，点击后由系统打开。复制成功后再插入链接；复制失败时保留编辑器内容并提示。附件原件不随日记小节移动或标签重排而变化；删除引用时暂不自动删除附件，避免误删被其他日记引用的文件。备份时需要同时复制年份目录和 `assets/`。

```markdown
# 2026-11-16 开始实习的第一天

## 自我评价

今天我发现，我经常先猜别人怎么看我。

### 一件具体的事

开会时，我有一个想法，等到散会才说。

## 明天的计划

明天试着在会上主动发言一次。
```

- 每个顶层二级标题 `##` 是候选主题。提取标题可见文字后，以 `NFC(去除首尾空白的文字)` 作为标签键；大小写敏感，内部空白不折叠，空标题忽略。显示时保留原文标题。
- 小节范围从标题之后延伸至下一个同级或更高级标题之前，或延伸至文末。以示例为例，「自我评价」包含「一件具体的事」，在「明天的计划」前结束。
- 同一个主题在同一天出现多次时，聚合页保留每次出现的区块，并遵循当天原文顺序。是否进入主列表按出现的不同日期数计算。
- 使用 Markdown 解析树识别标题层级和正文范围。代码块中的 `##` 示例仍作为代码处理。
- Markdown 文件是日记的原始数据。标签索引从文件生成，可在启动时重建，保存后只更新对应日期。
- 后续若开展旧文件导入：旧日记是一个含多天内容的 Markdown 文件，以带日期的顶层 `#` 为分界，保留各天内部的标题和正文。具体旧日期格式和同日期条目的处理方式在拿到脱敏样例后确定；此功能不属于 `1.0.0` 验收范围。

## 4. 技术选型与架构

| 层次 | 语言与技术 | 职责 |
| --- | --- | --- |
| 桌面壳与文件系统 | Tauri 2、Rust | 窗口、文件夹选择、受控的本地读写、附件复制与原子保存。 |
| 前端与业务逻辑 | TypeScript（严格类型）、React、Vite | 页面、状态、日记用例、Markdown 解析和内存标签索引。 |
| 组件与样式 | shadcn/ui、CSS | 三栏布局、可调宽侧栏、按钮和状态反馈；边缘悬停由应用实现。 |
| 编辑器 | Milkdown Crepe | 原位编辑和 Markdown 序列化，通过适配器隔离具体 API。 |
| Markdown 解析 | remark-parse / mdast | 从语法树和源码位置提取标题、小节边界。 |
| 测试 | Vitest；必要时 React Testing Library | 验证解析、索引替换、保存顺序和关键交互。 |

主业务模型采用面向对象设计：实体和值对象封装数据约束，服务类封装业务规则，接口隔离文件仓储与编辑器。React 组件只呈现和处理交互，不直接解析 Markdown 或读写文件。首版无需服务器、账号或数据库。

依赖方向：`React 页面 → DiaryService / TagIndex → DiaryRepository 接口 → Tauri 命令 → Rust 文件系统`。`MarkdownSectionExtractor` 是纯文本服务，供启动扫描与保存后增量更新共用。

| 对象或接口 | 职责与关键字段/方法 |
| --- | --- |
| `DiaryDate`（值对象） | 校验 `YYYY-MM-DD`，提供年份、比较及文件名转换，阻止非法日期和路径穿越。 |
| `DiaryEntry`（实体） | `date`、`markdown`、`revision`；正文仅由仓储读写。 |
| `DiarySummary` | `date`、`title`；供日期列表展示。 |
| `TagOccurrence`（值对象） | `date`、`key`、`displayTitle`、`ordinal`、`revision`、`headingOffset`、`contentStartOffset`、`endOffset`；表示一次主题出现。偏移只对应其 `revision` 标识的 Markdown 版本。 |
| `DiaryRepository`（接口） | `list()` 返回有效条目和逐文件诊断；`read(date)` 缺失时报 `not_found`；`save(date, markdown, expectation)` 明确区分新建与匹配指定 revision。`TauriDiaryRepository` 调用 Rust 命令。 |
| `MarkdownSectionExtractor` | `parse(markdown, date, revision)` 返回摘要和小节记录，不访问文件。 |
| `TagIndex` | 维护日期与标签双向索引，提供 `replaceDay`、`removeDay`、`listGroups`、`getOccurrences`。 |
| `DiaryService` | 协调读取、保存、摘要更新及保存成功后的索引替换。 |
| `WorkspaceService` | 首次选目录、保存所选根路径、校验可用性及切换目录；不自行创建根文件夹。 |
| `AttachmentService` | 将导入的图片/附件复制到 `assets/`，生成唯一文件名与相对 Markdown 链接。 |
| `NavigationHistory` | 管理当前视图、后退栈和前进栈；每条记录包含页面、所选日期或标签、目标小节及滚动位置。 |
| `EditorAdapter`（接口） | mount、getMarkdown、setReadonly、focusSection、destroy；CrepeEditorAdapter 封装 Milkdown，正文滚动位置由 AppShell 统一捕获和恢复。 |
| `FeatureModule`（接口） | 提供导航标签及 List、Detail、Provider 插槽；AppShell 集中管理类型化导航状态和内容区滚动位置。 |

标签功能通过 `openDiarySection(ref)` 请求日记页打开并定位，不直接操作日记页内部状态。AppShell 持有进程内导航历史，按模块保存选中日期或标签及正文滚动位置；编辑器适配器只负责按标签键和当日出现序号定位可见标题。`revision` 可采用文件内容哈希：Rust 保存前检查磁盘版本是否仍与读取时一致，外部修改冲突时保留编辑器草稿并提示处理。

导航历史仅在当前应用进程的内存中，关闭应用后清空。普通导航先记录当前视图状态并清空前进栈；后退将当前状态压入前进栈，再恢复上一状态；前进反向操作。视图状态包括功能页、选中的标签/日期、标签详情滚动容器的位置，以及日记编辑器当前小节和滚动位置。恢复滚动应在目标视图渲染完成后进行；当标签内容因编辑而变短时，将滚动位置限制在新的有效范围。用户在日记中修改后点击后退，须先等待自动保存完成；保存失败则保留草稿，并且不能因视图切换丢失。历史不写进 `settings.json`。

## 5. 标签提取与聚合算法

### 5.1 提取规则

1. 用 `remark-parse` 解析整篇 Markdown，只读取文档顶层的二级 `heading` 节点。代码块、引用或列表里的 `##` 不算主题。
2. 小节从该二级标题末尾起，到下一个顶层二级或一级标题开始处止；没有后续边界则延伸到文末。三级及更深标题属于当前二级主题。以源码偏移截取正文，保留 Markdown 格式。
3. 同日同名主题每次生成一条 `TagOccurrence`。`ordinal` 是该主题在当天从 0 开始的出现序号；没有二级标题的正文不进入标签索引。

### 5.2 数据结构与查询

```ts
class TagIndex {
  private byDate: Map<string, TagOccurrence[]>;
  private byTag: Map<string, Map<string, TagOccurrence[]>>;
}
```

- 启动时枚举合法日期文件，逐篇解析并加入索引。`byDate` 用于删除某天的旧记录；`byTag` 用于按标签查询。内存索引随时可由 Markdown 重建，不写缓存文件。
- `replaceDay(date, next)` 先按 `byDate[date]` 删除对应 `byTag[key][date]`，清理空组，再插入新记录并更新 `byDate[date]`。视图只接收替换完成后的快照。
- 某标签出现的**不同日期数**是 `byTag[key].size`，而非小节总数。至少两天出现的主题进主列表，仅一天出现的进「仅出现一次」。
- 每组按最近日期倒序；最近日期相同时按标签键排序。内容块按日期倒序，同一天的重复主题按 `ordinal` 升序。打开主题时读取对应 Markdown，先确认其 revision 与索引记录匹配；若外部文件已变化则重建该天索引，再用 `[contentStartOffset, endOffset)` 截取只读正文。
- 解析成本与单篇长度近似成正比。保存某天后只重新解析该天；主题列表排序只处理索引中的标签，不重新读取全部日记。

### 5.3 跳回原文

跳转参数为 `date + key + ordinal`，`headingOffset` 只作快速定位提示。日记页先打开目标日期，再在编辑器文档中使用相同的标签键归一化规则查找二级标题，按当日出现序号定位并滚动至标题。编辑器可能重新序列化 Markdown，不能将旧源码偏移直接当成编辑器光标位置。若目标已被修改或删除，打开该日并提示“小节已变化”。

## 6. 存储、保存与异常处理

Rust 暴露 `choose_diary_root`、`list_diaries`、`read_diary`、`save_diary`、`import_attachment` 等受控命令。只有文件夹选择命令接收操作系统选择器返回的根路径；读写日记和附件时，前端仅传经过校验的日期或待导入文件引用，不传任意目标绝对路径。Rust 统一组合并约束目标路径必须位于所选根目录内。每个日期最多一个文件。若正文一级标题日期与文件名不符，提示修正，不暗中移动文件。无效文件名或无法读取的文件需要显示错误，其余日记继续加载。

IPC 契约：`DiaryDate` 在 TypeScript 边界转为 `YYYY-MM-DD` 字符串；Rust 独立验证日期和路径。`list_diaries` 返回 `{ entries: [{ date, markdown, revision }], failures: [{ fileName, reason }] }`，有效条目按日期倒序排列。Rust 只读文件和报告错误，一级标题提取由 TypeScript `MarkdownSectionExtractor` 统一完成。`read_diary`、`save_diary` 返回相同的 `{ date, markdown, revision }`；存储错误使用 `{ code, message }`，`code` 包括 `conflict`、`not_found`、`corrupt_file`、`permission_denied`、`invalid_date`。前端在 IPC 边界校验返回数据并将未知错误归一为 `unexpected`。`save_diary` 接收 `expectation: { kind: 'new' } | { kind: 'match', revision: string }`；Rust 命令参数名使用 `camelCase` JSON 字段，两侧测试共用 `tests/fixtures/diary-ipc.json`。

附件的 Markdown 链接继续保留相对路径，以便整体迁移。预览时不能直接把该路径交给 webview；M6 由 Rust 在已选根目录下安全解析并读取附件，再提供受控的预览 URL 或二进制数据。不得仅凭 CSP 的 `asset:` 声明认为本地附件可访问，也不得对任意系统路径开放资源 scope。

M2 的文件命令在后台阻塞线程执行；工作区的读锁允许多个读取并行，切换根目录取得写锁并等待当前文件操作结束，保存另由互斥门串行化。前端切换功能页时保持两个模块挂载，避免日记视图状态被卸载。M3 已增加独立的编辑会话与草稿保存队列，更换根目录前先等待保存；M4 的标签索引从有效日记重建，保存成功后仅替换当天记录。

1. 编辑器变化后标记未保存；停顿约 700–1000 毫秒自动保存，`⌘S` 立即保存。中文输入法组合输入期间不提交保存。
2. `DiaryService` 对同一天的保存请求串行处理，并记录草稿版本号。旧请求完成时若已有新修改，继续提交最新草稿，避免旧内容覆盖新内容。
3. Rust 在目标文件同目录写临时文件并刷新数据；新建通过硬链接提交，避免并发出现同名文件时被覆盖；更新再次核对 revision 后用同目录重命名替换。成功后返回新 revision；失败时不能先删除原文件。外部程序若恰好在最后一次版本核对与替换之间写入，仍存在极短竞争窗口；`1.0.0` 在 macOS 上验证此保存流程。
4. 保存成功后更新日期摘要、仅重新解析该天，并调用 `TagIndex.replaceDay`。保存失败或 revision 冲突时保留草稿和未保存状态，不更新标签索引。
5. 标签页展示最后一次成功保存的数据；有草稿时提示“保存后更新标签”。目前不把外部程序同时编辑作为主要流程，但应用重新获得焦点时仍检查文件变化：无草稿则重读并重建对应日期，有草稿则提示冲突。残留临时文件不自动覆盖正式文件。

## 7. 建议代码目录与文件职责

仓库根目录按用途分为 `docs/`（项目文档）、`src/`（前端与业务代码）、`src-tauri/`（Rust 桌面端）、`tests/`（测试与示例）、`scripts/`（开发辅助脚本）。根目录保留 README、依赖与构建配置。当前其他无关笔记放在本地 `notes/`，由 Git 忽略。详细阶段和任务状态见[项目进度](./Diary-Project-Progress.md)。

```text
src/
├── app/
│   ├── AppShell.tsx                # 三栏外壳和功能导航
│   ├── AppRoot.tsx                 # 首次选目录与工作区状态
│   ├── AppErrorBoundary.tsx        # 渲染错误兜底
│   ├── bootstrap.ts                # 组合根和模块注册
│   ├── moduleRegistry.ts           # FeatureModule 注册
│   ├── NavigationHistory.ts        # 内存前进/后退栈与视图快照
│   └── services.ts                 # 创建并注入服务实例
├── domain/
│   ├── DiaryDate.ts                # 日期值对象
│   ├── DiaryEntry.ts               # 日记、摘要类型
│   ├── DiaryError.ts               # 仓储错误代码
│   ├── TagOccurrence.ts            # 标签出现记录
│   └── DiaryRepository.ts          # 仓储接口
├── application/
│   ├── DiaryService.ts             # 日记用例与保存协调
│   ├── MarkdownSectionExtractor.ts # 标题和小节解析
│   ├── WorkspaceService.ts         # 根目录选择、校验与切换
│   ├── AttachmentService.ts        # 附件导入与相对链接
│   └── TagIndex.ts                 # 双向索引与聚合查询
├── infrastructure/
│   ├── TauriDiaryRepository.ts     # Tauri 命令适配
│   ├── diaryIpc.ts                 # IPC 名称与返回值校验
│   ├── TauriWorkspaceGateway.ts    # 目录选择与设置适配
│   ├── TauriAttachmentGateway.ts   # 附件复制命令适配
│   └── CrepeEditorAdapter.ts       # 编辑器适配
├── features/
│   ├── diary/
│   │   ├── DiaryPanels.tsx          # 日记列表与正文内容
│   │   ├── DiaryList.tsx            # 日期列表
│   │   └── DiaryEditor.tsx          # 编辑器与保存状态
│   └── tags/
│       ├── TagsPanels.tsx           # 标签列表与详情内容
│       ├── TagList.tsx              # 主题列表与单次分组
│       └── TagDetail.tsx            # 只读小节堆叠及跳转
├── components/ui/                  # shadcn 通用 UI 组件
└── lib/                            # 通用工具函数

src-tauri/src/
├── lib.rs                          # 注册 Tauri 命令
├── diary_commands.rs               # 命令参数校验与响应
├── diary_storage.rs                # 路径、枚举与原子读写
├── error.rs                        # IPC 错误契约
├── workspace.rs                    # 用户所选根目录与配置
└── attachment_storage.rs           # 附件路径与安全复制
```

`domain` 不依赖 React、Tauri 或 Milkdown；`application` 不调用具体 UI；`infrastructure` 负责第三方 API；`features` 只处理页面状态和交互。业务规则集中在服务和索引类，不在两个页面各实现一套。首版不为简单类型增加继承层级。

## 8. 开发顺序与验收

1. **Mac 写作流程。** 首次启动选择已有文件夹，取消选择后不创建文件；重启能恢复选择，路径失效时可重选。建立仓储、日期校验和编辑器适配。新建日记，输入中文、标题、粗体和列表，验证编辑时原位渲染、中文输入法、撤销、自动保存和 `⌘S`。重启后确认日记可以继续编辑；保存失败时草稿不丢失。
2. **标签聚合。** 用跨年样例验证同名标题合并、单次主题折叠、子标题随正文展示、代码块排除、同日重复、区块排序和原文跳转。改名并保存后确认旧标签消失、新标签出现。针对小节边界和 `replaceDay` 写单元测试。
3. **导航、附件与桌面布局。** 验证从标签详情跳到日记编辑后，后退能恢复原标签和滚动位置，前进能回到日记；关闭重开后历史为空。验证图片预览、附件打开、相对链接和整目录迁移。再验证侧栏拖动、宽度记忆、手动收起、贴边浮出、跨年分割和长标题截断；缩小时仍要留出可编辑的正文宽度。
4. **M6 macOS 正式版验收与发布。** 在真实桌面窗口逐项验收首次选目录、写作与中文输入法、撤销、保存与失败恢复、标签聚合、原文跳转、导航位置、附件和小窗口布局；运行前端与 Rust 检查，验证安装包的安装、启动、关闭重开和数据目录备份/迁移。整理安装说明、备份说明和已知问题。全部通过后统一更新应用、包和 Cargo 版本为 `1.0.0`，重新打包，在 Git 提交上打 `v1.0.0` 标签并推送；未通过时保持预发布版本，不宣称正式发布。

旧单文件日记导入列为正式版后的额外工作：获得脱敏样例后先预览拆分日期和数量，再处理冲突及写入。Windows 适配目前不在开发计划和 `1.0.0` 验收范围内，只有以后明确决定支持时再单独规划。

## 9. Git 与 GitHub 版本管理

- 本项目代码及规划文档使用 Git 管理，GitHub 仓库设为私有，默认分支为 `main`。每次完成一组可验证的代码或文档更改后，先检查差异与必要测试，再创建说明清楚的提交并推送到 GitHub。
- 仓库只保存程序源码、构建配置、文档和人工编写的测试示例。用户日记、图片、附件、所选根目录配置、密钥、本地无关笔记与构建产物不提交。`.gitignore` 要覆盖这些常见路径，但提交前仍需人工检查 `git status`，因为用户可能选择任意文件夹。
- GitHub 用于项目代码版本管理，不等同于日记自动备份。用户自行选择的日记根目录及其附件不会因为代码推送而同步到 GitHub。

## 开发参考

- [shadcn/ui GitHub](https://github.com/shadcn-ui/ui)
- [shadcn/ui 侧栏示例](https://ui.shadcn.com/blocks/sidebar) · [可调面板](https://ui.shadcn.com/docs/components/base/resizable)
- [Milkdown Crepe 的 React 接入与演示](https://milkdown.dev/docs/recipes/react)
- [Tauri 的 Vite 配置](https://tauri.app/start/frontend/vite/)
- [Markdown 标题区间提取](https://github.com/syntax-tree/mdast-util-heading-range)
- [Tauri 2 文件系统与平台说明](https://v2.tauri.app/plugin/file-system/)
- [Tauri 2 文件系统 API](https://v2.tauri.app/reference/javascript/fs/)
- [Milkdown Crepe 使用说明](https://milkdown.dev/docs/guide/using-crepe)
- [remark / mdast](https://unifiedjs.com/explore/package/remark/)
