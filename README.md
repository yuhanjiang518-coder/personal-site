# 姜雨涵 · 个人主页

> 写代码，也写点生活

沈阳理工大学 · 信息科学与工程学院 · 网络工程

一个纯静态的个人主页，使用 HTML / CSS / JavaScript 手写，**零依赖、零构建**，直接托管在 GitHub Pages 上。

## 🌐 在线访问

**https://yuhanjiang518-coder.github.io/personal-site/**

## ✨ 特性

**布局**
- 左侧固定侧边栏 + 右侧内容区（桌面端经典双栏）
- 移动端自动收起为抽屉式菜单，带遮罩层
- 顶部滚动进度条

**视觉**
- 深色氤氲主题，粉色渐变点缀色
- 背景光晕（orb）与玻璃拟态（backdrop-filter）
- 深色 / 浅色双主题，自动跟随系统并记住选择

**交互**
- 打字机动态标题
- 滚动显现动画、技能进度条、数字增长动画
- 侧边栏导航高亮（scroll-spy 滚动监听）
- 一键复制邮箱（带 Clipboard API 降级方案）、一键唤起邮件客户端
- 头像渐变光环旋转
- 卡片悬浮微交互

**工程**
- 语义化标签、`aria-label` 无障碍标注、"跳到主要内容" 快捷链接
- 适配 `prefers-reduced-motion`（尊重系统减弱动效设置）
- 响应式断点：1100px / 800px / 520px

## 📁 文件结构

```
personal-site/
├── index.html    # 页面结构
├── style.css     # 样式、主题变量与动画
├── script.js     # 全部交互逻辑
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
| 常去的网站 | `<section id="sites">` 里的 `.site` 链接 |
| 邮箱 / 联系方式 | `<section id="contact">` |
| 打字机文案 | `script.js` 顶部的 `phrases` 数组 |
| 配色主题 | `style.css` 顶部的 `:root` 变量（改 `--accent` 换点缀色） |

改完 `git push`，GitHub Pages 会在 1 分钟内自动重新部署。

## 🎨 配色

| 变量 | 深色 | 说明 |
|---|---|---|
| `--accent` | `#ff89b5` | 粉色点缀色 |
| `--accent-2` | `#c1a3ff` | 紫色渐变终点 |
| `--bg` | `#121118` | 背景 |
| `--panel` | `rgba(27,24,33,.92)` | 面板底色 |
| `--text` | `#f6f3f8` | 主文字 |
| `--muted` | `#bdb6c7` | 次要文字 |

---

© 姜雨涵 · 沈阳理工大学 网络工程
