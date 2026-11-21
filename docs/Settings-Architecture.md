# 设置模块扩展约定

设置页采用左分类、右详情。`SettingsPanel`只负责选择、键盘导航、分类组件组合与帮助弹窗；不承载具体设置字段。

|文件|职责|
|---|---|
|`SettingsCatalog.ts`|不可变分类目录，注册id/标题/说明/图标/Content，验证唯一id与非空目录|
|`settingsTypes.ts`|沿用应用已有回调的输入契约；统一默认值由外壳提供|
|`PersonalizationSettings.tsx`|外观、主题色、列表色调、节点色板|
|`ReadingSettings.tsx`|正文行距、字距与重置|
|`StorageSettings.tsx`|目录信息和更换入口|
|`HelpSettings.tsx`|使用说明入口|
|`settings.css`|模块布局、控件样式与窄区域适配|

新增分类：实现接收`SettingsContentProps`的React组件，在`defaultSettingsCatalog`增加描述项即可；不需要修改导航渲染或switch。外部组合也可通过SettingsPanel的catalog参数注入目录。分类id应稳定，不应复用为不同用途。

新增现有分类下的设置：放到对应分类组件；增加持久化能力时经应用服务/回调传入，不让分类页面直接写日记文件或另建一份偏好状态。颜色继续使用组合根共享的NodePalette，主题与排版沿用既有回调。分类切换只影响展示；选中分类在设置页内保留，关闭后重新打开回到默认分类。

分类导航使用纵向tabs：方向键自动激活并移动焦点，Home/End首尾定位，Tab进入详情。tab和tabpanel用useId生成的稳定关联标识连接；未选分类内容卸载，不保留隐藏表单的焦点。新增临时表单草稿时应明确提供会话级状态与离开处理。

验证至少覆盖：新增目录项可显示、分类选择与键盘、原偏好回调及值保持、隐藏内容不可聚焦、帮助弹窗焦点恢复、文件夹切换。CSS采用minmax(0,1fr)、min-width:0及控件换行约束详情宽度，分类与详情独立滚动。
