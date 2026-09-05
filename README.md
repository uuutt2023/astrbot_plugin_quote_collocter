# 语录投稿 (Quote Collector)

> 群友语录 / 黑历史投稿插件，支持 WebUI 管理界面。  
> 发送「语录投稿+图片」即可让 bot 永久保存群友名场面。bot 被戳一戳时还会随机抽一张发出来。

## ✨ 功能

- 📸 **语录投稿**：群友直接发送「语录投稿」+ 图片即可投稿
- 💬 **引用投稿**：回复一张图片 + 「语录投稿」也能保存
- 🎲 **随机语录**：发送 `/语录` 或 `语录` 主动抽一张
- 👉 **戳一戳彩蛋**：bot 被戳时随机发送一张语录（10 秒冷却，可调）
- 🔐 **投稿权限**：0=关闭、1=仅管理员、2=全体成员
- 🖼️ **WebUI 管理**：在 AstrBot Dashboard 中浏览、删除、移动、上传图片 (React + Ant Design)

## 🚀 安装

1. 在 AstrBot 中添加插件，源地址填：
   ```
   https://github.com/uuutt2023/astrbot_plugin_quote_collocter
   ```
2. 安装后插件会自动加载 `requirements.txt` 中的依赖（`Pillow` 用于缩略图）。
3. 重启 AstrBot。
4. 打开 AstrBot Dashboard → 插件 → **语录管理** 进入 WebUI。

## 📖 使用方法

| 指令 | 说明 | 权限 |
|:----:|:----|:----:|
| 语录投稿 + 图片 | 投稿一张图到当前群 | 群成员 (按 mode) |
| 回复图片 + 语录投稿 | 把别人发的图也存下来 | 群成员 (按 mode) |
| `/语录` 或 `语录` | 主动抽一张图 | 群成员 |
| 戳一戳 bot | 随机抽一张图（10s 冷却） | 群成员 |
| 投稿权限 0/1/2 | 关闭 / 仅管理员 / 全体 | Bot 管理员 |
| 戳戳冷却 数字 | 修改戳一戳冷却（秒） | Bot 管理员 |

## 🖥️ WebUI

`pages/quote-gallery/` 下的 SPA（React 18 + Ant Design 5 + TanStack Query + Zustand）。  
主要功能：

- 侧边栏：群聊列表（按图片数量排序）
- 顶部统计：总群数 / 总图片 / 占用空间 / 缩略图优化状态
- 网格视图：缩略图列表，支持搜索、分页、批量选择
- 预览大图：一键查看原图、下载
- 批量操作：删除、移动到其他群
- 上传：拖拽上传到当前群
- 群设置：投稿权限 + 戳戳冷却
- 浅色/深色主题切换
- 中/英双语（`zh-CN` / `en-US`）

数据通过 AstrBot 提供的 Bridge API (`window.AstrBotPluginPage.apiGet / apiPost / upload`) 转发到插件注册的后端 API (`/api/plug/quote_collocter/...`)。

## 🔧 重新构建 WebUI（开发可选）

```bash
cd webui
npm install
npm run build
# 产物会自动输出到 ../pages/quote-gallery/
```

> AstrBot 在发布版本中已经预构建好了 `pages/quote-gallery/`，普通用户不需要重新构建。  
> 仅当修改 React 源码后需要重新打包。

## 📝 更新日志

### v1.6.0 (WebUI)
- 🆕 新增 WebUI 管理页面（React + Ant Design）
  - 浏览 / 删除 / 移动 / 重命名 / 上传语录图片
  - 在线修改每群的投稿权限和戳戳冷却
  - 支持浅色 / 深色主题，中英双语
- 🆕 后端 API 注册到 `/api/plug/quote_collocter/...`
- 🆕 自动生成缩略图（Pillow 可选，未安装时返回原图）
- 🆕 新增 i18n 文件（`.astrbot-plugin/i18n/{zh-CN,en-US}.json`）

### v1.5
- 引用回复投稿兼容
- 多端 CQ 码兼容
- 增加 `/语录` 主动命令

### v1.4
- 优化管理员权限获取

## 📜 License

MIT
