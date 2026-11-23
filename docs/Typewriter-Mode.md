# 日记打字机模式与手势移除

适用版本：macOS 1.9.0。产品行为参考[Typora官方使用说明](https://support.typora.io/Focus-and-Typewriter-Mode/)，实现基于项目现有Milkdown/ProseMirror，不替换编辑器、不修改Markdown格式。

## 分工与动画

- `TypewriterButton`复用保存圆点的34×34圆形按钮样式，自绘轻量打字机SVG、title提示、aria-pressed，附件文件选择保留给正文右键菜单。拖入、图片粘贴、已有相对链接和附件存储仍在。
- `TypewriterPreferences`在应用localStorage的`diary.typewriter.v1`只存布尔值；缺失或无效时关闭。切日期/栏目与重启会恢复；存储失败提示但当次开关有效。
- `CrepeEditorAdapter`注册局部ProseMirror plugin，只有文档或选区实际改变时请求跟随。`handleScrollToSelection`在模式开启时接管默认瞬移，普通模式返回false；原文跳转也交给同一控制器。
- `TypewriterController`根据真实折叠DOM选区行矩形（不可用时回退coordsAtPos）与`.module-content`扣除sticky工具栏后的可视中心，计算scrollTop目标。单一RAF、临界阻尼闭式积分、18/s响应系数，更新目标时保留连续位置和速度，禁止越过目标；误差小于0.5px即停止，不持续轮询，不触发React每帧重绘。
- 首尾留白为可编辑视口高度的一半，CSS作用于ProseMirror padding，不是文档空行。开启/关闭或resize时通过真实首个文档节点补偿布局；跳过Crepe绝对定位的virtual-cursor装饰，避免错误锚定造成闪动。
- 同步Crepe虚拟光标的局部top/left/height，修正纯CSS留白与缩放后装饰坐标缓存；不派发文档transaction，不改变选区、焦点或光标闪烁类。布局变化时暂时隐藏旧块操作手柄，下一次鼠标移动由原编辑器定位。

## 滚动、IME与生命周期

wheel/touchmove/原生滚动条拖动仅暂停跟随，不preventDefault、不导航；resize不打断手动阅读。实际输入、选区变化或明确重开模式时恢复。范围选择不强制拉回。

IME沿用ProseMirror文档/选区更新及compositionend通知；控制器不处理输入内容，不重置selection、不focus、不操作候选词。仅在有跟随任务时量取布局。系统减少动态效果直接定位；resize重新计算可用中心；隐藏视口暂停，卸载取消RAF并清理observer/局部监听。

模式开启时不重放日记历史scrollTop，避免历史位置与自动跟随竞争；普通模式的日记、标签导航恢复逻辑保留。模式关闭取消动画、移除留白并尽量补偿当前可见位置，实际边界仍由浏览器钳制。

## 移除范围

删除`useAdjacentDiaryNavigation`、`AdjacentDiaryNavigator`、仅为翻页等待的`EditorReadiness`与专属测试，移除轨道/预览DOM、阈值/锁/回弹与CSS。`useAppNavigation`只保留普通导航的过期回调generation保护。

删除原生`scroll_phase.rs`、AppKit监控安装及三个直接macOS依赖；Cargo.lock保持其余锁定版本。节点和词云仍使用各自组件局部wheel监听及共享wheelDelta，不受影响。原手势测试替换成上下/水平滚轮与touch不换日期的回归，列表点击、前进/后退及保存保护照常测试。

## 验证边界

单元与集成覆盖：平滑开启、连续重定向/换行、单RAF、手动阅读和恢复、首尾居中、关闭与销毁、减少动态效果、虚拟光标锚点、持久化及普通日期导航。实际Crepe的附件导入/相对链接、Markdown序列化测试保留。

浏览器内存示例已核对：首尾与正文输入居中、真实光标与装饰对齐、手动阅读、关闭重开、模式跨日期、滚动不换日期、深浅主题及按钮同为34px。示例未读取真实日记。原生macOS中文输入法候选框、多屏/高DPI与长期连续输入的手感仍需实机复核，自动测试不替代原生验收。
