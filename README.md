# 姜雨涵 · 个人主页

沈阳理工大学 信息科学与工程学院 · 网络工程

一个纯静态的个人主页，使用 HTML / CSS / JavaScript 手写，零依赖、零构建，直接托管在 **GitHub Pages** 上。

## 🌐 在线访问

https://<你的用户名>.github.io/personal-site/

## ✨ 特性

- 📱 完全响应式（手机 / 平板 / 桌面自适应）
- 🌗 深色 / 浅色主题切换，自动跟随系统并记住选择
- ⌨️ 首屏打字机动态标题
- 🎞️ 滚动显现动画、技能进度条、数字增长动画
- 📋 一键复制邮箱、一键唤起邮件客户端
- ⚡ 纯静态三文件，无需任何依赖或构建步骤
- ♿ 适配 `prefers-reduced-motion`

## 📁 文件结构

```
personal-site/
├── index.html    # 页面结构
├── style.css     # 样式与动画
├── script.js     # 交互逻辑
└── README.md
```

## 🚀 本地预览

直接双击 `index.html` 即可，或启动一个本地服务器：

```bash
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

## 🛠️ 部署到 GitHub Pages

1. 在 GitHub 上新建仓库 `personal-site`
2. 推送代码：

```bash
git remote add origin https://github.com/<你的用户名>/personal-site.git
git branch -M main
git push -u origin main
```

3. 打开仓库 **Settings → Pages**
4. **Source** 选择 `Deploy from a branch`
5. **Branch** 选择 `main` + `/ (root)`，点击 **Save**
6. 等待 1–2 分钟，访问 `https://<你的用户名>.github.io/personal-site/`

## ✏️ 如何修改内容

| 想改什么 | 改哪里 |
|---|---|
| 姓名、学校、简介 | `index.html` 里的 `<section id="about">` |
| 技能条目与进度 | `index.html` 里的 `<section id="skills">`，改 `--w:75%` 调整长度 |
| 兴趣爱好 | `index.html` 里的 `<section id="interests">` |
| 邮箱 / 联系方式 | `index.html` 里的 `<section id="contact">` |
| 配色主题 | `style.css` 顶部的 `:root` 变量 |
| 打字机文字 | `script.js` 顶部的 `phrases` 数组 |

---

© 姜雨涵 · 沈阳理工大学 网络工程
