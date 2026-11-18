# Diary 1.1.1 图标更新

日期：2026-11-18。平台：Apple 芯片 macOS。

- 使用用户提供的“暖象牙底色上的记忆书页轨迹”图片作为应用标志。原图只读；在项目内裁为 890×890 正方形，使书页与轨迹约占图标宽度的 75%，保留四周暖象牙留白。
- 同步更新 macOS 应用图标、应用左上角标志和页面图标。项目保留裁切后的 `src-tauri/icons/icon-master.png`，供以后重新生成不同尺寸。
- 未改动日记数据、附件格式或业务行为。

前端 74 项测试、类型检查和生产构建通过；`.app` 版本号 `1.1.1`、ad hoc 签名和 ZIP 完整性检查通过。

[下载 Diary_1.1.1_aarch64.zip](https://github.com/Yangsw0-0/Diary/releases/download/v1.1.1/Diary_1.1.1_aarch64.zip)。SHA-256：`220bd768d190e48344f1a484c932e5aa5b1df6e265088371f0c0d87367e4e623`。

退出旧版后解压，替换原安装位置的 `Diary.app`。应用使用 ad hoc 签名，未做 Apple 公证；首次启动可能需要在 macOS“隐私与安全性”中手动允许。
