# 向き · 个人主页

> 写代码，也写点生活

沈阳理工大学 · 信息科学与工程学院 · 网络工程

一个纯静态的个人主页，使用 HTML / CSS / JavaScript 手写，**零依赖、零构建**，直接托管在 GitHub Pages 上。

## 🌐 在线访问

**https://yuhanjiang518-coder.github.io/personal-site/**

## ✨ 特性

**背景**
- 以插画《魔女の旅々》风格森林场景为全屏背景
- 配色直接取自插画本身：橄榄绿 / 暖金 / 蝶粉
- 背景固定不随滚动，叠加渐变遮罩保证文字可读
- 侧边栏顶部有人物插画条
- **5 种背景模式可切换**：暗色柔化 / 原图横版 / 原图竖版 / 模糊 / 纯色
- 全站玻璃拟态（backdrop-filter），无此支持时自动降级为实色

**布局**
- 左侧固定侧边栏 + 右侧内容区（桌面端经典双栏）
- 移动端自动收起为抽屉式菜单，带遮罩层
- 顶部滚动进度条

**视觉**
- 深色氤氲主题，粉色渐变点缀色
- 背景光晕（orb）与玻璃拟态（backdrop-filter）
- 深色 / 浅色双主题，自动跟随系统并记住选择

**游戏口味**

按四类展示常玩游戏：

| 分类 | 游戏 |
|---|---|
| 音游 | Phigros、Rizline、Orzmic、世界计划 |
| 类银河恶魔城 | 空洞骑士、空洞骑士：丝之歌、奥日、苍翼：混沌效应 |
| Galgame | 罚抄、刻之樱、诗歌之樱、口袋夏日 |
| 沙盒 / Roguelike | 泰拉瑞亚、死亡细胞、杀戮尖塔 |

**动漫口味**

| 作品 | 作者 |
|---|---|
| JoJo 的奇妙冒险 | 荒木飞吕彦 |
| 魔女之旅 | 白石定规 · あずーる |
| 我心里危险的东西 | 樱井纪雄 |
| 碧蓝之海 | 井上坚二 · 吉冈公威 |

封面用 CSS 渐变 + 汉字代替海报，**避免使用版权图片**。

**账号链接**
- 侧边栏头像下方：GitHub / Bilibili 两个图标按钮
- 首屏底部：社交行（「在这些地方找到我」）
- 「常去的地方」：两张带「本人」标记的账号卡片，排在第一位
- 「联系我」：文字链接形式

- GitHub — https://github.com/yuhanjiang518-coder
- Bilibili — https://space.bilibili.com/627368437 （向きー）

**交互**
- 打字机动态标题
- 滚动显现动画、技能进度条、数字增长动画
- 侧边栏导航高亮（scroll-spy 滚动监听）
- 一键复制邮箱（带 Clipboard API 降级方案）、一键唤起邮件客户端
- 头像渐变光环旋转
- 卡片悬浮微交互

**工程**
- 图片全部转 WebP 并压缩：802 KB 原图 → 6 个变体合计 249 KB
- 快捷键：`T` 切主题、`W` 换壁纸
- 语义化标签、`aria-label` 无障碍标注、"跳到主要内容" 快捷链接
- 适配 `prefers-reduced-motion`（尊重系统减弱动效设置）
- 响应式断点：1100px / 800px / 520px

## 📁 文件结构

```
personal-site/
├── index.html    # 页面结构
├── style.css     # 样式、主题变量与动画
├── script.js     # 全部交互逻辑
├── assets/       # 背景插画（WebP，6 个尺寸/风格变体）
├── .nojekyll     # 告诉 GitHub Pages 不要跑 Jekyll
└── README.md
```

## 🚀 本地预览

直接双击 `index.html`，或起一个本地服务器：

```bash
python3 -m http.server 8000
# 访问 http://localhost:8000
```

## 🛠️ 部署到 GitHub Pages

1. 新建仓库 `personal-site`
2. 推送代码：

```bash
git remote add origin https://github.com/yuhanjiang518-coder/personal-site.git
git branch -M main
git push -u origin main
```

3. 仓库 **Settings → Pages**
4. **Source** 选 `Deploy from a branch`
5. **Branch** 选 `main` + `/ (root)`，点 **Save**
6. 等 1–2 分钟，访问 https://yuhanjiang518-coder.github.io/personal-site/

> 仓库里已经有 `.nojekyll`，避免 Jekyll 处理下划线开头的文件导致 404。

## ✏️ 如何修改内容

| 想改什么 | 改哪里 |
|---|---|
| 姓名 / 一句话签名 | `index.html` 里 `.rail-name` 和 `.rail-tag` |
| 自我介绍 | `index.html` 的 `<section id="about">` |
| 技能条目与熟练度 | `<section id="skills">`，改 `.skill-name` 和 `--w:80%` |
| 最近在做 | `<section id="skills">` 里的 `.doing` 列表 |
| 项目卡片 | `<section id="projects">` 里的 `.card` |
| 兴趣爱好 | `<section id="life">` 里的 `.hobby` |
| 游戏口味 / 常玩游戏 | `<section id="life">` 里的 `.game`（4 类，改 `.game-tags` 里的游戏名） |
| 动漫口味 / 常看作品 | `<section id="life">` 里的 `.anime-card`（改 `<h4>` 标题与 `.anime-note`） |
| 动漫封面配色 | `style.css` 里的 `.anime-jojo` / `.anime-elaina` / `.anime-bokuyaba` / `.anime-grandblue` |
| 常去的网站 | `<section id="sites">` 里的 `.site` 链接 |
| 邮箱 / 联系方式 | `<section id="contact">` |
| 打字机文案 | `script.js` 顶部的 `phrases` 数组 |
| 配色主题 | `style.css` 顶部的 `:root` 变量（改 `--accent` 换点缀色） |
| 背景图 | 替换 `assets/` 里的 webp 文件（保持同名最省事） |
| GitHub / B站 链接 | 全局搜索 `yuhanjiang518-coder` 或 `627368437` 批量替换 |

改完 `git push`，GitHub Pages 会在 1 分钟内自动重新部署。

## 🎨 配色

配色是从背景插画里采样出来的，不是随便选的：

| 变量 | 深色 | 来源 |
|---|---|---|
| `--accent` | `#f0a6c0` | 粉色蝴蝶与波斯菊 |
| `--accent-2` | `#e8c86a` | 阳光与落叶的暖金 |
| `--accent-3` | `#a8c99a` | 草地绿 |
| `--bg` | `#14170f` | 树荫深绿 |
| `--text` | `#f2f4ea` | 偏暖的米白 |

## ⚖️ 版权说明

背景插画版权归原作者（白石定规 / あずーる / GA文库）所有，此页面仅作**个人学习与非商业用途**。
如果这个页面要公开传播或用于展示，建议换成你自己绘制或有授权的图片。
页脚已标注该说明。

---

© 向き · 沈阳理工大学 网络工程
