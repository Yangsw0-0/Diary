# Diary 1.3.2 更新记录

日期：2026-11-20。平台：Apple 芯片 macOS。

## 新功能

- 左侧功能栏底部新增写作统计卡片，显示当前日记文件夹已记录的日期数和累计字数。
- 字数按已保存日记的可见非空白字符计算；Markdown 标记、首行日期和图片路径不计入。中文、英文字母、标点及完整表情各按一个字符计。
- 保存、删除、刷新或切换文件夹后自动更新。未保存草稿不计入；文件载入失败时提示统计可能不完整。

## 验证与安装

- 前端格式、静态检查、类型检查、测试和生产构建通过；macOS 应用包版本与 ad hoc 签名、ZIP 完整性均已核对。
- [下载 Diary_1.3.2_aarch64.zip](https://github.com/Yangsw0-0/Diary/releases/download/v1.3.2/Diary_1.3.2_aarch64.zip)。SHA-256：`1d6181a9a5bdd56dc4f8b3cbc3812f8ff5db340b6929ab719111fa8e67926f8c`。

退出旧版后解压，将新的 `Diary.app` 放到旧版位置并确认替换。日记和附件不在安装包内。Windows 用户继续使用 [1.3.0 安装包](https://github.com/Yangsw0-0/Diary/releases/tag/v1.3.0)；Windows 真机验收仍待完成。
