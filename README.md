# 青空导演系统

青空导演系统是用于 Tavo 的剧情 CG 插件。可从对话选景生图、为已保存回复补图，也可以设计并登记角色、调整已有画面和制作动态 CG。

## 安装与使用

从 [最新发布](https://github.com/AozoraCynthiAStudio/Tavo-Aozora-Director-System/releases/latest) 下载 `.tpg` 安装包，在 Tavo 的插件管理中导入。进入聊天后，在输入菜单选择「导演下一幕」或「设计人物外观」。聊天悬浮按钮可以打开图片卡片，侧栏可以打开导演设置。配置示例和图标说明见插件内的「教程」。

## 生图服务

初次安装默认选择 NAI 4.5 Full。静态生图还支持 NAI 5 Full、Seedream 5.5、GPT Image 和通用 · Tavo。可在「画风」页选择内置预设，也支持自建、导入和导出。

NAI 4.5、NAI 5、Seedream 和 GPT Image 可在「动态」页独立设置图生图和双帧动态所用的 API。请选择支持对应编辑请求的服务商。动态 CG 由原图和一张变化帧交替播放，使用费用以渠道报价为准。

## 人物档案与图片

满意的人物候选可以登记，供后续画面延续外貌。图片卡片顶部的档案夹直达已登记角色。历史记录按回复显示剧情和对应图片，图库可查阅已保存的图片。有关联生成记录的图片也可以检查实际提示词和参数。

## 从源码构建

在源码包根目录运行以下命令。测试和构建使用 Node.js，打包使用 PowerShell。

```powershell
npm test
npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-local.ps1
```

安装包与源码包生成在 dist 目录。插件素材来源和第三方许可见安装包中的 ASSET_PROVENANCE.json 与 THIRD_PARTY_NOTICES.txt。
