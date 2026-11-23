# 词云实现与验证

## 仓库事实与方案选择

基于当前1.6.3源码：ModuleRegistry支持split/canvas模块；NavigationHistory为内存导航，标签跳转使用openTag(key)；TagIndex由Markdown二级标题动态派生主标签，key是现有稳定关联键（项目没有另一个标签UUID）。NodesSession采用独立JSON文件、useSyncExternalStore、串行保存与revision冲突保护。词云沿用相同分层和生命周期模式，不另建数据库。

已阅读官方参考：[TagCanvas](https://www.goat1000.com/tagcanvas.php)、[拖拽与减速选项](https://www.goat1000.com/tagcanvas-drag.php)、[TagCloud.js说明](https://github.com/cong-min/TagCloud)。TagCanvas已有Canvas拖拽、减速交互；TagCloud.js提供轻量鼠标旋转词云及更新/暂停/销毁接口。本实现参考交互，使用独立Canvas 2D渲染器，以统一定制背面剔除、透明度与同步线条；不复制两项目源码，不增加图形库或运行时依赖。

## 文件与职责

|文件|职责|
|---|---|
|`src/domain/WordCloud.ts`|数据模型、配置默认值、NFC规范化、验证、来源合并投影|
|`src/domain/WordCloudRepository.ts`|JSON/revision读写端口|
|`src/application/WordCloudSession.ts`|工作区隔离、加载/损坏保护、800ms自动保存、串行续存、失败草稿、外部修改冲突|
|`src/infrastructure/TauriWordCloudRepository.ts`|IPC命令与运行时响应解码|
|`src-tauri/src/word_cloud.rs`|固定WordCloud.json路径、安全读取、大小/结构检查、线程池命令、revision校验与原子发布|
|`src/features/wordcloud/sphereMath.ts`|Fibonacci Sphere、四元数、球面插值、透视、smoothstep、近邻连线和经纬线路径|
|`src/features/wordcloud/SphereRenderer.ts`|画布绘制、透明度、碰撞避让、拖动/惯性、可见点击、尺寸/DPR、主题与动画资源清理|
|`WordSphere.tsx` / `WordCloudPanel.tsx` / `word-cloud.css`|React适配、管理表单、来源列表、开关、删除撤销和布局|
|`app/services.ts` / `bootstrap.ts`|仓库/会话单实例注入、注册canvas导航|
|`AppShell.tsx` / `useAppNavigation.ts` / `NavigationHistory.ts` / `NavigationContext.ts`|最小化新增wordcloud视图、保留导航历史和标签入口；不走日记边界翻页|
|`AppRoot.tsx`|关闭/失焦flush、外部变化检查、换目录flush/reset、丢弃提示|

## 数据边界

`WordCloud.json`版本1包含words[{id,text}]与preferences{showTags,autoRotate,lineMode,panelCollapsed}。配置缺字段时补默认值；未知版本或损坏数据不清空、不覆盖。最多500个自定义词、每词120个Unicode码点、512KiB；标签数不设同样的500条上限。首次读取不创建文件，首次实际变更才写盘。Git忽略根目录WordCloud.json。

标签从TagIndex.listGroups的全部主标签（包括隐藏分组）生成，不持久化标签副本。按trim+NFC文本合并显示，保留customIds与tagKey；合并词的显示id由规范文本决定，底层自定义ID仍为UUID。重命名在现有系统中体现为旧key消失/新key出现，词云同步更新。删除/撤销只调用词云会话，绝不调用标签索引变更接口。

沿用节点的同目录临时写、sync_all、发布前再次核对revision；新文件硬链接无覆盖发布，已有文件使用既有跨平台原子替换。符号链接与非普通文件拒绝读取。无法保证任意外部编辑器参与的跨进程事务；不支持硬链接的目录按项目既有约定失败关闭。外部冲突需重新读取或显式覆盖，损坏文件需修复后重新读取，不自动删文件。

## 几何与性能

- Fibonacci Sphere确定初始位置，按显示词文本排序保证输入顺序稳定；数量变化时球面插值约500ms并淡入/淡出。相同显示词集的标签更新只更新来源，不重启布局。
- 四元数累积旋转并归一化，无欧拉角奇点；指针捕获、4px点击阈值、时间归一化惯性与指数减速。正常释放指针捕获不会清空惯性；取消、窗口失焦会停止。
- 摄像机朝正z，alpha=smoothstep(0,0.5,z)，背面不绘制、不命中；前侧透视略放大，文字始终正对观察者。命中使用实际绘制且alpha>0.12的词。
- 网格与近邻连线都在同一旋转/投影体系中。空间桶限候选近邻，连线仅在词集变更时计算。文字按深度排序，屏幕空间桶做矩形避让，不执行每帧全量两两碰撞。
- requestAnimationFrame绘制不更新整页React；空闲且无自动旋转/过渡时停止，离开模块、打开设置、页面不可见时暂停；销毁清理监听器、Observer和RAF。尺寸变化后同步补画，避免ResizeObserver清空缓冲后的闪空；高DPI最高3倍缓冲；标签测量缓存有8192项上限，长词按字素二分省略。
- 自动旋转、惯性和过渡尊重prefers-reduced-motion；普通词长、0/1/2词以及2000词算法/避让有自动测试。未宣称在所有真实设备的大型词集上达到固定FPS。

## 验证与限制

前端测试涵盖来源去重、标签动态变化/实际内容跳转、删除撤销、重启配置恢复、保存中编辑、损坏与外部冲突、旧工作区读取隔离、失败导航和原生关闭保护，以及几何/背面点击/惯性/暂停/销毁/密集避让。Rust覆盖读写/冲突/强制保存、UTF-8与大小、结构校验、符号链接及日记扫描隔离。

浏览器内存示例检查了自由拖动、输入Enter添加、标签显示开关、收起面板扩展、球面点击进入标签关联内容、亮暗主题、网格/星座/混合模式与760px最小窗口。未访问真实日记。原生macOS/Windows交互与超大真实词集的帧率仍待真机验收；本轮未发布新安装包。

最终结果：`npm run check`通过，130项前端测试、26项Rust测试与严格clippy通过；[a94c12f三项CI](https://github.com/Yangsw0-0/Diary/actions/runs/45097956403)均通过，包括Windows编译与安装包构建。尺寸变化同步补画的回归测试与浏览器复核通过。本轮源码已推送，未发布新安装包。
