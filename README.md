# 向き · 个人主页

> 写代码，也写点生活

沈阳理工大学 · 信息科学与工程学院 · 网络工程

一个纯静态的个人主页：手写 HTML / CSS / JavaScript，**零依赖、零构建**，直接托管在 GitHub Pages 上。
没有 npm、没有打包器、没有框架 —— 打开 `index.html` 看到的就是仓库里的东西。

## 🌐 在线访问

**https://yuhanjiang518-coder.github.io/personal-site/**

## ✨ 视觉签名：黑胶唱片

开屏画面上最容易被记住的是那台唱片机。它原来只活在开屏里，点一次「开始旅途」就没了 ——
现在同一个记号铺到了全站，成了"一眼认出是这个站"的东西：

| 位置 | 形态 |
|---|---|
| 每个板块标题左侧 | 编号 `01 / 02 …` 坐在唱片的中央标签里，碟身骑在内容列的左边界上 |
| 加载屏 | 头像就是唱片的标签，外面一圈盘面，再外面是进度环 |
| 页脚署名行 | 1rem 的小唱片 |
| `404.html` | 品牌行前面那枚记号 |
| 应用图标 | `assets/icon-192.png` / `icon-512.png`，同一个造型 |

盘面没有一个像素是图片：整块是四层 `radial-gradient` 画的（反光 / 中央标签 / 纹路 / 盘体），
所以从 1rem 到 4.4rem 都是同一段代码，不增加任何请求。
定义在 `style.css` 第 19 节；"骑在内容列边界上"那一处的定位在 `aw.css` 第 10 节
（因为 `aw.css` 在 `style.css` 之后加载，而且那边的 `padding` 带 `!important`，只有那一层改得动）。

## 📁 文件结构

```
personal-site/
├── index.html              # 单文件，四个视图都在里面（约 1200 行）
├── style.css               # 基础样式、主题变量、动效（约 4500 行）
├── aw.css                  # 皮肤层：排版尺度、区块头部、卡片材质（约 880 行）
├── aw.js                   # 皮肤层的运行时（冲击波、行距等）
├── script.js               # 交互逻辑：视图切换、灯箱、壁纸、抽签……（约 2300 行）
├── pattern-waves.js        # 页脚波场（reactbits PatternWaves 的原生移植）
├── tech-text.js            # 板块标题的扫描镜片（reactbits TechText 的原生移植）
├── drift-wall.js           # 旅人手记墙（reactbits DriftWall 的原生移植 + 手记页层）
├── game-demo.js            # 终端回放 / 关键代码查看器（首次点击才下载）
├── js/liquid-glass/        # 顶栏的 WebGL2 折射
│   ├── liquid-glass-navigation.js
│   ├── shaders.js
│   ├── layout.js
│   └── scene-capture.js
├── assets/
│   ├── elaina/             # 伊蕾娜同人插画（54 张，含开始界面用的抠图立绘）
│   ├── games/              # 三个 C 小游戏的源码、运行截图，以及逐帧回放数据
│   ├── wall-*.webp         # 6 张壁纸 × 3 个尺寸（-p / 无后缀 / -thumb）
│   ├── icon-192.png        # PWA 图标（唱片造型）
│   ├── icon-512.png
│   ├── og-cover.png        # 分享卡片图，1200×630
│   └── *.webp              # 头像、封面、贴纸等
├── 404.html                # 自带样式的 404（不加载 index 的任何脚本）
├── manifest.webmanifest    # 可"添加到主屏幕"
├── robots.txt              # 允许抓取 + 指向 sitemap
├── sitemap.xml
├── LICENSE                 # 分三层：本站代码 / 移植件 / 同人插画
├── .nojekyll               # 别让 GitHub Pages 跑 Jekyll
└── README.md
```

## 📄 四个视图（同一个网址）

整站是**一个 HTML 文件**，靠 `.view` 容器切换显示，地址栏始终不变。

| 视图 | `data-view` | 内容 |
|---|---|---|
| 首页 | `home` | 首屏 Hero、关于我、现在在做什么、最近在看、联系我、同人画廊、项目与收藏 |
| 学习 / 工作 | `study` | 技能与近况、学习路线、我的学习法、我的专业 |
| 技能标签墙 | `tags` | 标签下落碰撞舞台、技能墙插画 |
| 兴趣 / 日常 | `life` | 今日抽签、动漫口味、游戏口味、常去的地方 |

**工作方式**

- 导航链接带 `data-view` + `data-anchor`，点击时 `preventDefault()`，只切换 `.view[hidden]`，不跳页
- 切换由"方向感知的幕布转场"驱动（向下展开 / 向上收拢），带一块章节牌报出目标页
- 隐藏视图里的元素不参与 `IntersectionObserver`，切过去才纳入观察，避免"切过去一片空白"
- 支持带 hash 直接打开（如 `#projects`）并定位到对应视图

## 🎞️ 动效一览

| 效果 | 实现 | 文件 |
|---|---|---|
| 开始界面 | 色块 / 黑胶唱片 / 白描边立绘 / 斜虚线标注，从参考站的主菜单语言重做 | `style.css` 16.35 |
| 方向感知幕布 | 每页一套配色的三色幕布 + 章节牌 | `script.js` TRANS 编排表 |
| 液态玻璃顶栏 | WebGL2 折射，实时取页面背景 | `js/liquid-glass/` |
| 技能标签墙 | 标签下落 + 真实重力碰撞 | `script.js` + `.tw-*` |
| 板块标题 | 一只镜片扫过，镜片下的字变成虚线技术轮廓，弹出测量框与「字 + 尺寸」标注 | `tech-text.js` |
| 页脚波场 | 世界坐标噪声驱动的加号阵列 | `pattern-waves.js` |
| 旅人手记墙 | 图片分列循环漂移 + 3D 平面视差，每页带页码、压住的那页翻出题名 | `drift-wall.js` |
| 联系板块 | 圆形展开 + 波浪冲击 | `aw.js` |
| 打字机标题、滚动显现、数字增长、复制邮箱 | —— | `script.js` |

## 🎮 三个 C 控制台小游戏

`assets/games/` 下是三个能直接 `gcc` 编译的 C 程序，每个都配了一张**真实运行截下来的画面**（不是画的插画）：

| 文件 | 行数 | 内容 |
|---|---|---|
| `minesweeper.c` | 249 | 扫雷。9×9/10 雷与 16×16/40 雷两档；第一次点击周围 3×3 不放雷；空格递归掀开 |
| `snake.c` | 195 | 贪吃蛇。20×20，`conio.h` 的 `_kbhit()` 做到不等回车就读键 |
| `tetris.c` | 303 | 俄罗斯方块。10×20，七种方块各一个 4×4 矩阵，旋转即矩阵转 90° 再判碰撞 |

```bash
gcc -o minesweeper minesweeper.c && ./minesweeper
```

**站上就能看它们跑起来。** 三个 `.c` 在浏览器里没法执行，所以做了一台"回放机"：
把程序自己 `printf` 出来的**每一帧**存下来按帧播一遍，逐帧着色，进度可拖、可单帧步进，
还带一个"关键代码"视图——按函数名从 `.c` 里抽原文（`rotate_piece` / `clear_line` / `open_cell` …），
不是手抄的片段。数据和播放器一共 31 KB，而且**第一次点按钮之前一个字节都不下载**。

封面与回放数据都由开发脚本生成，不在站点里：
`dev/capture-games.py`（编译并运行，抓真实 stdout）→ `dev/build-game-demos.py`（打包成回放）
→ `dev/render-game-covers.py`（渲染封面）。

平台限制写在每张卡上和回放窗口里：`snake.c` / `tetris.c` 依赖 `conio.h` 的 `_kbhit()`，
**只能 Windows**；`minesweeper.c` 只用 `stdio / stdlib / time`，哪个平台都能编。

## ♿ / 🚀 工程

- 语义化标签、`aria-label`、跳转链接、对话框焦点管理；灯箱与浮层支持键盘
- 尊重 `prefers-reduced-motion`：所有 canvas 动效都有不依赖 `requestAnimationFrame` 的静态绘制路径
- `forced-colors` / 打印模式下，纯装饰层（标题字 canvas、唱片盘面）自动退场
- 低端机让路：`hardwareConcurrency <= 4` 或 `deviceMemory <= 4` 或省电模式时不加载重力墙、波场、标题镜片
- 图片全部 WebP；插画封面 960×540，卡片按 2× 取图
- 分享卡片是 JPEG（同内容 PNG 355 KB → 79 KB，1200×630 上看不出差别）

## 📉 字节预算（实测，不是估计）

预算：**首屏 ≤1.5 MB**。测法：1000×900 视口、本地服务器（未压缩）、`load` 之后读
`performance.getEntriesByType('resource')` 去重求和。GitHub Pages 上的 HTML/CSS/JS 还会再走一遍 gzip
（`script.js` 91 KB → 线上约 25 KB），所以真实首屏比下表更低。

| 指标 | 改前 | 现在 | |
|---|---|---|---|
| 资源个数 | 85 | **49** | −36 |
| 首屏总字节 | 4081 KB | **2237 KB** | **−45 %** |
| 其中图片 | 3641 KB | **1796 KB** | −1845 KB |
| `og-cover` | 355 KB（PNG） | **79 KB**（JPEG q82） | −276 KB |

**那 1.8 MB 是怎么省下来的**：Chromium 有一条例外 —— 处在 `display:none` 子树里的
`<img loading="lazy">` **不会**被懒加载拦住，它算不出位置，就按立即加载处理。
本站有三个视图是 `hidden` 的，里面有 48 张整幅插画，于是页面一 `load` 就全下来了。
改法是：这些图的 `src` 直接写成 `data-src`，`showView()` 切过去时再装回来
（`script.js` 里的 `deferHiddenImages` / `hydrateImages`）。
每张图本来就写了 `width` / `height`，所以摘掉 `src` 不会跳版。

> 中途踩过一次：`drift-wall.js` 在页面 `load` 时就收集画廊条目，而那时 `src` 还没装回去，
> 于是墙上一条都收不到、入口按钮直接不出现。现在它回退读 `data-src`。
> 这类"初始化时读 DOM 属性"的代码，改懒加载一定要一起过一遍。
- 快捷键：`T` 切主题、`W` 换壁纸
- 分享卡片：Open Graph / Twitter Card / canonical / JSON-LD `Person`
- 响应式断点：1100px / 900px / 700px / 640px / 560px / 420px

## 🚀 本地预览

直接双击 `index.html` 即可；或者起一个本地服务器（推荐，`fetch` 与 WebGL 才有正确行为）：

```bash
python -m http.server 8000
# 打开 http://localhost:8000
```

## 🛠️ 部署到 GitHub Pages

1. Settings → Pages
2. Source 选 `Deploy from a branch`
3. Branch 选 `main` + `/ (root)`，Save
4. 等 1–2 分钟，访问 https://yuhanjiang518-coder.github.io/personal-site/

> 仓库里已有 `.nojekyll`，避免 Jekyll 处理下划线开头的文件导致 404。

## ✏️ 如何修改内容

| 想改什么 | 改哪里 |
|---|---|
| 姓名 / 一句话签名 | `index.html` 的 `.brand` 与页脚 |
| 自我介绍 | `index.html` 的 `<section id="about">` |
| 学习路线 | `<section id="roadmap">` 的 `.rm-item`，改 `done` / `doing` / `next` 换状态 |
| 课程矩阵 | `<section id="courses">` 的 `.mx`，改 `lv-done` / `lv-doing` / `lv-todo` |
| 项目卡片 | `<section id="projects">` 里的 `.proj`，封面放 `assets/` 后改 `<img src>` |
| 画廊 | `<section id="artStrip">`，每张 `figure.art` 带 `data-full`（大图）与 `data-cap`（题名，墙上的题名条也用这个） |
| 游戏口味 / 动漫口味 | `<section id="life">` 里的 `.game` / `.anime-card` |
| 邮箱 / 联系方式 | `<section id="contact">` |
| 打字机文案 | `script.js` 顶部的 `phrases` 数组 |
| 配色 | `style.css` 顶部 `:root` 的 `--hue`（换色相只改这一个数） |
| 壁纸 | 替换 `assets/wall-*.webp`（保持同名最省事） |
| 分享卡片图 | 改 `dev/gen-og.py` 后重新生成 `assets/og-cover.jpg` |
| 应用图标 | 改 `dev/gen-icons.py` 后重新生成 `assets/icon-192.png` / `icon-512.png` |
| 板块编号的唱片 | `aw.css` 最后一节 `.sec-idx` |
| GitHub / B 站链接 | 全局搜索 `yuhanjiang518-coder` 或 `627368437` |

改完 `git push`，GitHub Pages 一分钟内自动重新部署。
改了 `style.css` / `aw.css` / 任何 `.js` 之后，记得把 `index.html` 里对应的 `?v=` 日期戳一起改掉，否则浏览器会用缓存里的旧文件。

## 🎨 配色

配色是从插画里采样出来的，不是随便选的：

| 变量 | 值 | 来源 |
|---|---|---|
| `--primary` | `oklch(.68 .15 340)` | 粉色蝴蝶与波斯菊 |
| `--primary-deep` | `oklch(.55 .16 340)` | 同色系压深，用于文字与描边 |
| 暖金 | `#e8c86a` | 阳光与落叶 |
| 草地绿 | `#a8c99a` | 草地 |
| `--page-bg`（浅色） | `#fdfaf4` | 暖纸白 |

## ⚖️ 版权说明

见 [`LICENSE`](LICENSE)，分三层写清楚了：

1. **本站自己的代码**（HTML / CSS / JS / 三个 C 程序）—— MIT；
2. **三个 reactbits 移植件** —— 带上原作 `MIT + Commons Clause` 全文（该条款限制的是"把组件本身再卖 / 再发一遍"，作为网站的一部分使用是被明确允许的）；
3. **伊蕾娜同人插画** —— 版权归各画师所有，来自 elaina1017.com 的公开画廊，仅作个人非商业展示，不在上面两条授权范围内。

页脚同样标注了第 3 条。如果任何一位作者不希望作品出现在这里，告知后会立刻撤下。

---

© 向き · 沈阳理工大学 网络工程
