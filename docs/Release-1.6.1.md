# Diary 1.6.1：设置分类

日期：2026-11-21。

- 设置改为左侧分类、右侧具体选项的两级布局：个性化、编辑与阅读、文件与存储、帮助。
- 将外观、主题色、列表色调与节点色板归入个性化；正文行距和字距归入编辑与阅读。
- 分类与内容独立滚动，窄窗口自动换行；支持方向键、Home/End和Tab导航。
- 拆分设置分类组件与统一注册目录，后续新增分类无需修改设置外壳；更新使用说明。
- 沿用已有偏好与日记/节点数据格式，升级不需要迁移日记文件。

验证：前端113项测试、类型检查、格式、lint和构建通过（lint仍有既有警告）。已用内存预览检查浅/深色和窄区域布局，未访问真实日记。原生窗口体验与Windows真机验收仍待完成。

退出旧版后，macOS解压并用Diary.app替换旧应用；Windows运行新版安装程序。macOS为ad hoc签名、未公证，Windows安装包未签名。应用不提供自动更新。

## 安装包

| 平台 | 下载 | 大小 | SHA-256 |
| --- | --- | --- | --- |
| macOS Apple 芯片 | [Diary_1.6.1_aarch64.zip](https://github.com/Yangsw0-0/Diary/releases/download/v1.6.1/Diary_1.6.1_aarch64.zip) | 6,204,303 字节 | `97c812d316f9dd4c5a5f37f3027101aec3ada90b1fbad32151d79c8f073c87a3` |
| Windows 10/11 x64 | [Diary_1.6.1_x64-setup.exe](https://github.com/Yangsw0-0/Diary/releases/download/v1.6.1/Diary_1.6.1_x64-setup.exe) | 4,220,498 字节 | `a31d6671675f7c7145991508db1bbbe931bfa970d04733bce917894f619907e0` |

本地安装包与应用目录：`releases/v1.6.1/`（不进入Git）。macOS版本、签名、arm64架构和ZIP完整性已核对。Rust fmt、严格clippy与23项测试通过；[前端、macOS与Windows三项CI](https://github.com/Yangsw0-0/Diary/actions/runs/44863750864)均通过。Windows安装包来自该提交的CI构建；真机验收尚未完成。
