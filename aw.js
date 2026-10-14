/* ============================================================================
   aw.js — 「WODNIACK 皮肤」的交互层
   ----------------------------------------------------------------------------
   搬自 https://wodniack.dev 的开源实现（Antoine Wodniack，CC BY-NC 4.0）：
     · a-waves   —— Spring-mass 波浪线，逐帧改写 SVG <path> 的 d
     · a-separator —— 二进制分隔条，0/1 随机翻转
     · 顶栏控制台 —— 等宽体逐字打字
     · 自绘滚动条
   全部是原生 JS，没有引入 GSAP / Lenis 之类的新依赖。
   零构建、零外部请求。任何一处出错都不会影响原有 script.js。
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;

  /* ==========================================================================
     1. 微型事件总线 + 帧循环
     参考站用的是 Emitter + Ticker（底层 gsap.ticker）。这里自己写一个，
     只保留需要的能力：on / off / once / emit，以及一个 requestAnimationFrame 循环。
     ========================================================================== */

  function Emitter() {
    this.listeners = {};
  }

  Emitter.prototype.on = function (name, fn, ctx) {
    (this.listeners[name] || (this.listeners[name] = [])).push({ fn: fn, ctx: ctx });
    return this;
  };

  Emitter.prototype.off = function (name, fn, ctx) {
    var list = this.listeners[name];
    if (!list) return this;
    this.listeners[name] = list.filter(function (item) {
      return !(item.fn === fn && (!ctx || item.ctx === ctx));
    });
    return this;
  };

  Emitter.prototype.emit = function (name, arg) {
    var list = this.listeners[name];
    if (!list) return this;
    for (var i = 0; i < list.length; i++) {
      try { list[i].fn.call(list[i].ctx, arg); } catch (err) { /* 隔离单个监听器 */ }
    }
    return this;
  };

  var bus = new Emitter();

  var Ticker = {
    running: false,
    start: 0,
    last: 0,
    step: function (now) {
      if (!Ticker.start) Ticker.start = now;
      Ticker.last = now;
      bus.emit('tick', now - Ticker.start);
      window.requestAnimationFrame(Ticker.step);
    },
    init: function () {
      if (Ticker.running) return;
      Ticker.running = true;
      window.requestAnimationFrame(Ticker.step);
    }
  };

  /* ==========================================================================
     2. Perlin 噪声（Ken Perlin 的 classic noise，改写成紧凑版）
     参考站 src/utils/Noise.js 用的就是这一套，`noise.perlin2(x, y)` 返回 -1..1。
     ========================================================================== */

  function Noise(seed) {
    this.p = new Uint8Array(512);
    this.gradP = new Int8Array(512);

    var permutation = [
      151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
      140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247,
      120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57,
      177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74,
      165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60,
      211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65,
      25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200,
      196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52,
      217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207,
      206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119,
      248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129,
      22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218,
      246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
      81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
      184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
      222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
    ];

    var s = Math.random();
    if (seed !== undefined) s = seed;
    if (s > 0 && s < 1) s *= 65536;
    s = Math.floor(s);
    if (s < 256) s |= s << 8;

    for (var i = 0; i < 256; i++) {
      var v = i & 1 ? permutation[(i + s) & 255] : permutation[i];
      this.p[i] = this.p[i + 256] = v;
    }

    var grad3 = [
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [1, 0], [-1, 0],
      [0, 1], [0, -1], [0, 1], [0, -1]
    ];
    for (var j = 0; j < 512; j++) {
      this.gradP[j] = grad3[this.p[j] & 11][0];
    }
    this.gradY = grad3;
  }

  // 简单的二维 value-noise 足够做波浪扰动，而且比完整 perlin 快
  Noise.prototype.perlin2 = function (x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    var v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);

    var p = this.p;
    function h(a, b) {
      var idx = p[(a & 255)] + (b & 255);
      var g = p[idx & 511];
      return ((g & 15) / 7.5) - 1;
    }

    var n00 = h(xi, yi), n10 = h(xi + 1, yi);
    var n01 = h(xi, yi + 1), n11 = h(xi + 1, yi + 1);

    var nx0 = n00 + u * (n10 - n00);
    var nx1 = n01 + u * (n11 - n01);
    return nx0 + v * (nx1 - nx0);
  };

  /* ==========================================================================
     3. <aw-waves> —— 波浪物理线
     逐字搬自参考站的 AWaves：网格点做 spring-mass，
     位移 = perlin 噪声（常驻波动）+ 光标弹簧（跟随鼠标/手指）。
     ========================================================================== */

  function AWaves() { return Reflect.construct(HTMLElement, [], AWaves); }
  AWaves.prototype = Object.create(HTMLElement.prototype);
  AWaves.prototype.constructor = AWaves;
  Object.setPrototypeOf(AWaves, HTMLElement);

  AWaves.prototype.connectedCallback = function () {
    var self = this;
    this.svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.appendChild(this.svg);

    this.mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false };
    this.lines = [];
    this.paths = [];
    this.noise = new Noise(Math.random());
    this.isInteractive = false;
    this.isPaused = true;
    this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (this.reduced) return;

    this.onMouseMove = function (x, y) { self.updateMousePosition(x, y); };
    this.onResize = function () { self.setSize(); self.setLines(); };
    this.onTouchMove = function (e) {
      var t = e.touches[0];
      if (t) self.updateMousePosition(t.clientX, t.clientY);
    };
    this.onTick = function (time) { self.tick(time); };

    bus.on('pointermove', this.onMouseMove);
    bus.on('resize', this.onResize);
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });

    this.setSize();
    this.setLines();

    // 到过屏内才开始跑，离开就停 —— 手机上省电的关键
    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && self.isPaused) {
            self.isPaused = false;
            bus.on('tick', self.onTick);
          } else if (!entry.isIntersecting && !self.isPaused) {
            self.isPaused = true;
            bus.off('tick', self.onTick);
          }
        });
      }, { rootMargin: '120px' });
      this.io.observe(this);
    } else {
      this.isPaused = false;
      bus.on('tick', this.onTick);
    }
  };

  AWaves.prototype.disconnectedCallback = function () {
    bus.off('pointermove', this.onMouseMove);
    bus.off('resize', this.onResize);
    bus.off('tick', this.onTick);
    window.removeEventListener('touchmove', this.onTouchMove);
    if (this.io) this.io.disconnect();
  };

  AWaves.prototype.updateMousePosition = function (x, y) {
    var m = this.mouse;
    m.x = x - this.bounding.left;
    m.y = y - this.bounding.top + window.scrollY;
    if (!m.set) {
      m.sx = m.x; m.sy = m.y; m.lx = m.x; m.ly = m.y;
      m.set = true;
    }
  };

  AWaves.prototype.setSize = function () {
    var rect = this.getBoundingClientRect();
    this.bounding = {
      left: rect.left,
      top: rect.top + window.scrollY,
      width: this.clientWidth || rect.width,
      height: this.clientHeight || rect.height
    };
  };

  AWaves.prototype.setLines = function () {
    var b = this.bounding;
    if (!b.width || !b.height) return;

    this.lines = [];
    this.paths.forEach(function (p) { p.remove(); });
    this.paths = [];
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

    // 手机上把网格放粗一档，点数少一半，肉眼几乎看不出差别
    var narrow = b.width < 700;
    var xGap = narrow ? 18 : 10;
    var yGap = narrow ? 40 : 32;

    var oWidth = b.width + 200;
    var oHeight = b.height + 30;
    var totalLines = Math.ceil(oWidth / xGap);
    var totalPoints = Math.ceil(oHeight / yGap);
    var xStart = (b.width - xGap * totalLines) / 2;
    var yStart = (b.height - yGap * totalPoints) / 2;

    for (var i = 0; i <= totalLines; i++) {
      var points = [];
      for (var j = 0; j <= totalPoints; j++) {
        points.push({
          x: xStart + xGap * i,
          y: yStart + yGap * j,
          wave: { x: 0, y: 0 },
          cursor: { x: 0, y: 0, vx: 0, vy: 0 }
        });
      }

      var path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'aw-line');
      this.svg.appendChild(path);
      this.paths.push(path);
      this.lines.push(points);
    }

    this.drawLines();
  };

  AWaves.prototype.movePoints = function (time) {
    var m = this.mouse, noise = this.noise, interactive = this.isInteractive;
    var l = Math.max(175, m.vs);

    for (var a = 0; a < this.lines.length; a++) {
      var points = this.lines[a];
      for (var b = 0; b < points.length; b++) {
        var p = points[b];

        // 常驻波动：perlin 噪声驱动的椭圆位移
        var move = noise.perlin2(
          (p.x + time * 0.0125) * 0.002,
          (p.y + time * 0.005) * 0.0015
        ) * 12;
        p.wave.x = Math.cos(move) * 32;
        p.wave.y = Math.sin(move) * 16;

        // 光标弹簧
        if (interactive) {
          var dx = p.x - m.sx;
          var dy = p.y - m.sy;
          var d = Math.sqrt(dx * dx + dy * dy);

          if (d < l) {
            var s = 1 - d / l;
            var f = Math.cos(d * 0.001) * s;
            p.cursor.vx += Math.cos(m.a) * f * l * m.vs * 0.00065;
            p.cursor.vy += Math.sin(m.a) * f * l * m.vs * 0.00065;
          }
        }

        p.cursor.vx += (0 - p.cursor.x) * 0.005;   // 张力
        p.cursor.vy += (0 - p.cursor.y) * 0.005;
        p.cursor.vx *= 0.925;                       // 阻尼
        p.cursor.vy *= 0.925;
        p.cursor.x += p.cursor.vx * 2;              // 强度
        p.cursor.y += p.cursor.vy * 2;
        p.cursor.x = Math.min(100, Math.max(-100, p.cursor.x));
        p.cursor.y = Math.min(100, Math.max(-100, p.cursor.y));
      }
    }
  };

  AWaves.prototype.moved = function (point, withCursorForce) {
    var x = point.x + point.wave.x + (withCursorForce ? point.cursor.x : 0);
    var y = point.y + point.wave.y + (withCursorForce ? point.cursor.y : 0);
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  };

  AWaves.prototype.drawLines = function () {
    for (var a = 0; a < this.lines.length; a++) {
      var points = this.lines[a];
      var p1 = this.moved(points[0], false);
      var d = 'M ' + p1.x + ' ' + p1.y;

      for (var b = 0; b < points.length; b++) {
        var isLast = b === points.length - 1;
        var cur = this.moved(points[b], !isLast);
        d += 'L ' + cur.x + ' ' + cur.y;
      }

      this.paths[a].setAttribute('d', d);
    }
  };

  AWaves.prototype.tick = function (time) {
    var m = this.mouse;

    m.sx += (m.x - m.sx) * 0.1;
    m.sy += (m.y - m.sy) * 0.1;

    var dx = m.x - m.lx;
    var dy = m.y - m.ly;
    var d = Math.sqrt(dx * dx + dy * dy);

    m.v = d;
    m.vs += (d - m.vs) * 0.1;
    m.vs = Math.min(100, m.vs);
    m.lx = m.x; m.ly = m.y;
    m.a = Math.atan2(dy, dx);

    this.style.setProperty('--x', m.sx + 'px');
    this.style.setProperty('--y', m.sy + 'px');

    this.movePoints(time);
    this.drawLines();
  };

  if (window.customElements && !customElements.get('aw-waves')) {
    customElements.define('aw-waves', AWaves);
  }

  /* ==========================================================================
     4. <aw-sep> —— 二进制分隔条
     结构照抄参考站的 a-separator：三角形 + 若干组「二进制 + 斜杠」。
     0/1 靠 :before 的 translate 切换（合成层，不触发重排）。
     ========================================================================== */

  var SEP_STRINGS = ['MUKI', '向き', 'NETWORK', 'CODE'];

  function buildSeparator(style) {
    var el = doc.createElement('aw-sep');
    if (style) el.setAttribute('data-style', style);

    var triL = doc.createElement('span');
    triL.className = 'aw-sep__tri aw-sep__tri--l';
    el.appendChild(triL);

    var wrap = doc.createElement('span');
    wrap.className = 'aw-sep__binaries';

    SEP_STRINGS.forEach(function (str) {
      var binary = str.split('').map(function (ch) {
        return ch.charCodeAt(0).toString(2);
      }).join(' ');

      var code = doc.createElement('span');
      code.className = 'aw-sep__code';
      binary.split('').forEach(function (ch) {
        var c = doc.createElement('span');
        c.className = 'aw-sep__char js-char' + (ch === ' ' ? ' aw-sep__char--blank' : '');
        c.textContent = ch;
        code.appendChild(c);
      });
      wrap.appendChild(code);

      var stripes = doc.createElement('span');
      stripes.className = 'aw-sep__stripes';
      wrap.appendChild(stripes);
    });

    el.appendChild(wrap);

    var triR = doc.createElement('span');
    triR.className = 'aw-sep__tri aw-sep__tri--r';
    el.appendChild(triR);

    return el;
  }

  // 每帧只翻一小部分字符 —— 参考站是 Math.random() > 0.1 就跳过
  function startSeparators() {
    var seps = [];
    var chars = [];

    doc.querySelectorAll('aw-sep').forEach(function (el) {
      seps.push(el);
      el.querySelectorAll('.js-char').forEach(function (c) {
        if (!c.classList.contains('aw-sep__char--blank')) chars.push(c);
      });
    });

    if (!chars.length) return;

    var active = [];
    bus.on('tick', function () {
      active.forEach(function (list) {
        for (var i = 0; i < list.length; i++) {
          var char = list[i];
          if (Math.random() > 0.1) continue;
          var isOne = char.classList.contains('aw-sep__char--1');
          char.classList.toggle('aw-sep__char--1', !isOne);
        }
      });
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var list = entry.target.__chars || [];
          var idx = active.indexOf(list);
          if (entry.isIntersecting && idx === -1) active.push(list);
          if (!entry.isIntersecting && idx !== -1) active.splice(idx, 1);
        });
      }, { rootMargin: '80px' });

      seps.forEach(function (el) {
        el.__chars = Array.prototype.slice.call(el.querySelectorAll('.js-char'));
        io.observe(el);
      });
    } else {
      seps.forEach(function (el) {
        active.push(Array.prototype.slice.call(el.querySelectorAll('.js-char')));
      });
    }
  }

  /* ==========================================================================
     5. 顶栏控制台 —— 等宽体逐字打字
     照搬参考站 SiteHead 的 updateConsole：随机取一条消息，按字符逐个吐出来，
     标点处停顿更久，只保留最后 5 行。
     ========================================================================== */

  var MESSAGES = [
    '正在为不可避免的 debug 做准备',
    '把设计师的梦编译成开发者的噩梦…',
    '请稍等，我先把这件事想复杂一点',
    '优化中…但没有什么是完美的',
    '正在配置下一个微不足道的麻烦',
    '正在加载…顺便思考人生的意义',
    '重新调整你的期待…预计延迟',
    '试图让热情动起来…不太顺利',
    '卡在了一个死循环里',
    '加载中…依然没什么意义',
    '正在模拟进度…姑且算有',
    '这东西可能马上就要坏了',
    '在代码里寻找意义',
    '计算失败概率中',
    '请无限期等待…',
    '用爱渲染每一个像素',
    '在魔法与代码之间做集成',
    '优化创造力…待命中',
    '设计与代码握手成功',
    '正在获取灵感…快好了',
    '一切尽在掌握',
    '正在载入酷炫度…即将就绪',
    '校准设计师的梦',
    '融合设计与动画',
    '运行创造力协议',
    '打磨魔法…请稍候',
    '调整字体…几乎看不见的差别',
    '把像素对齐…小心翼翼地',
    '跑一些聪明（大概）的算法',
    '就快好了…上下浮动',
    '集成中…像专业人士一样',
    '打磨中…保证不弄坏任何东西',
    '写代码，也写点生活',
    '沈阳 · 网络工程 · 在读',
    '大概率是 <div> 的问题'
  ];

  function initConsole() {
    var host = doc.querySelector('.js-aw-console');
    if (!host) return;

    var message = '';
    var lastMessage = '';
    var lineBreak = false;
    var lastTypeTime = 0;
    var writeDelay = 700;

    bus.on('tick', function (time) {
      if (time - lastTypeTime < writeDelay) return;

      if (message === '') {
        var next = MESSAGES[(Math.random() * MESSAGES.length) | 0];
        if (next === lastMessage) next = MESSAGES[(Math.random() * MESSAGES.length) | 0];
        message = next;
        writeDelay = 1400;
        return;
      }

      if (message === lastMessage || lineBreak) host.textContent += '\n';

      var char = message.charAt(0);
      message = message.substring(1);

      if (char === '，' || char === ',') writeDelay = 90;
      else if (char === ' ') writeDelay = 80;
      else if (char === '…') writeDelay = 380;
      else if (char === '。' || char === '.') writeDelay = 380;
      else writeDelay = 34;

      host.textContent += char;

      lineBreak = char === '…';

      var lines = host.textContent.split('\n');
      if (lines.length > 5) host.textContent = lines.slice(-5).join('\n');

      lastMessage = message;
      lastTypeTime = time;
    });
  }

  /* ==========================================================================
     6. 自绘滚动条
     用 transform（--aw-sb-y）移动，不用 top，避免每帧重排。
     ========================================================================== */

  function initScrollbar() {
    if (window.matchMedia && window.matchMedia('(max-width: 720px)').matches) return;

    var root = doc.createElement('div');
    root.className = 'aw-scrollbar';
    root.setAttribute('aria-hidden', 'true');

    var thumb = doc.createElement('div');
    thumb.className = 'aw-scrollbar__thumb';
    root.appendChild(thumb);
    doc.body.appendChild(root);

    var dragging = false;
    var dragStartY = 0;
    var dragStartScroll = 0;

    function metrics() {
      var viewport = window.innerHeight;
      var total = doc.documentElement.scrollHeight;
      var maxScroll = Math.max(1, total - viewport);
      var h = Math.max(48, (viewport / total) * viewport);
      var travel = viewport - h;
      return { viewport: viewport, maxScroll: maxScroll, h: h, travel: travel };
    }

    function paint() {
      var m = metrics();
      var ratio = Math.min(1, Math.max(0, window.scrollY / m.maxScroll));
      root.style.setProperty('--aw-sb-h', m.h + 'px');
      root.style.setProperty('--aw-sb-y', (ratio * m.travel) + 'px');
    }

    function onDown(e) {
      dragging = true;
      root.classList.add('is-dragging');
      dragStartY = e.clientY;
      dragStartScroll = window.scrollY;
      thumb.setPointerCapture && e.pointerId !== undefined && thumb.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging) return;
      var m = metrics();
      var delta = (e.clientY - dragStartY) / m.travel;
      window.scrollTo(0, dragStartScroll + delta * m.maxScroll);
    }

    function onUp() {
      dragging = false;
      root.classList.remove('is-dragging');
    }

    thumb.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('scroll', paint, { passive: true });
    window.addEventListener('resize', paint);
    bus.on('resize', paint);

    paint();
    setTimeout(paint, 400);
    setTimeout(paint, 1600);
  }

  /* ==========================================================================
     7. 启动
     ========================================================================== */

  /* --- 皮肤开关 ---------------------------------------------------------
     默认 aw；`?skin=classic` 或面板里的按钮可以切回原皮肤，选择记在 localStorage。
     这套皮肤本身只是「加一层」，切回去就是原来一模一样的站点。
     -------------------------------------------------------------------- */
  var SKIN_KEY = 'jyh-skin';

  function resolveSkin() {
    var pref = null;
    try { pref = window.localStorage.getItem(SKIN_KEY); } catch (e) {}

    try {
      var q = new URLSearchParams(window.location.search).get('skin');
      if (q === 'classic' || q === 'aw') {
        pref = q;
        try { window.localStorage.setItem(SKIN_KEY, q); } catch (e) {}
      }
    } catch (e) {}

    var on = pref !== 'classic';
    if (on) doc.documentElement.setAttribute('data-skin', 'aw');
    else doc.documentElement.removeAttribute('data-skin');
    return on;
  }

  function initSkinSwitch(on) {
    var body = doc.querySelector('#wallPanel .panel-body');
    if (!body || body.querySelector('.js-aw-skin-btn')) return;

    var set = doc.createElement('div');
    set.className = 'field-set';

    var label = doc.createElement('p');
    label.className = 'field-label';
    label.textContent = '外观皮肤';

    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-block js-aw-skin-btn';
    btn.textContent = on ? '切回原皮肤' : '切换到 WODNIACK 皮肤';
    btn.addEventListener('click', function () {
      try { window.localStorage.setItem(SKIN_KEY, on ? 'classic' : 'aw'); } catch (e) {}
      window.location.reload();
    });

    set.appendChild(label);
    set.appendChild(btn);

    var reset = doc.querySelector('#resetLook');
    if (reset && reset.parentElement === body) body.insertBefore(set, reset);
    else body.appendChild(set);
  }

  function init() {
    var on = resolveSkin();
    initSkinSwitch(on);
    if (!on) return;

    Ticker.init();

    // 波浪：塞进英雄区最底层
    var hero = doc.querySelector('.hero');
    if (hero && !hero.querySelector('aw-waves')) {
      var waves = doc.createElement('aw-waves');
      waves.className = 'aw-waves';
      waves.setAttribute('aria-hidden', 'true');
      hero.insertBefore(waves, hero.firstChild);
    }

    // 分隔条：每个区块头部之前插一条，另外首页英雄区与跑马灯之间插一条
    var head = doc.querySelector('.topbar');
    doc.querySelectorAll('.sec-head').forEach(function (secHead) {
      var host = secHead.parentElement;
      if (!host || host.querySelector(':scope > aw-sep')) return;
      host.insertBefore(buildSeparator(''), secHead);
    });

    var marquee = doc.querySelector('.marquee');
    if (marquee && marquee.parentElement) {
      var prev = marquee.previousElementSibling;
      if (!prev || prev.tagName !== 'AW-SEP') {
        marquee.parentElement.insertBefore(buildSeparator('solid'), marquee);
      }
    }

    // 控制台宿主（放在顶栏中间）
    if (head && !head.querySelector('.aw-console')) {
      var nav = head.querySelector('.nav');
      var console_ = doc.createElement('div');
      console_.className = 'aw-console';
      console_.setAttribute('role', 'presentation');
      var inner = doc.createElement('div');
      inner.className = 'aw-console__inner';
      var text = doc.createElement('div');
      text.className = 'js-aw-console';
      var caret = doc.createElement('span');
      caret.className = 'aw-console__caret';
      inner.appendChild(text);
      inner.appendChild(caret);
      console_.appendChild(inner);
      if (nav && nav.nextSibling) head.insertBefore(console_, nav.nextSibling);
      else head.appendChild(console_);
    }

    startSeparators();
    initConsole();
    initScrollbar();

    // 光标位置广播给波浪（用 rAF 合并，别让 mousemove 每个事件都算）
    var pending = null;
    var scheduled = false;
    function flush() {
      scheduled = false;
      if (pending) bus.emit('pointermove', pending.x, pending.y);
      pending = null;
    }
    window.addEventListener('pointermove', function (e) {
      pending = { x: e.clientX, y: e.clientY };
      if (!scheduled) { scheduled = true; window.requestAnimationFrame(flush); }
    }, { passive: true });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { bus.emit('resize'); }, 180);
    }, { passive: true });

    // 开屏动画的扳机：只负责让大标题从下方滑上来
    setTimeout(function () {
      doc.documentElement.classList.add('aw-ready');
      // 波浪在开屏结束后才开始跟手（跟参考站的 introend 一致）
      doc.querySelectorAll('aw-waves').forEach(function (w) { w.isInteractive = true; });
      bus.emit('resize');
    }, 520);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
