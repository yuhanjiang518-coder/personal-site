/* =====================================================================
   向き · MUKI — script.js
   加载屏 / 壁纸切换 / 视图路由 / 揭示动画 / 每日抽签 / 主题
   纯原生，无依赖。
   ===================================================================== */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var doc = document.documentElement;
  var LS = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==================================================================
     1. 壁纸库
     ================================================================== */
  var WALLS = [
    { id: 'bed',    name: '卧床读书' },
    { id: 'rain',   name: '星伞雨空' },
    { id: 'window', name: '夜窗蓝调' },
    { id: 'desert', name: '沙漠舞娘' },
    { id: 'lemon',  name: '柠檬庭院' }
  ];
  var MODES = ['full', 'soft', 'none'];

  /* 每种模式下的遮罩基准（上 / 中 / 下），再乘用户浓度 */
  var VEIL_BY_MODE = {
    full: [46, 66, 92],
    soft: [24, 40, 66],
    none: [0, 0, 0]
  };

  function wallSrc(id) {
    var portrait = window.matchMedia('(max-width: 720px)').matches;
    return 'assets/wall-' + id + (portrait ? '-p' : '') + '.webp';
  }

  /* ==================================================================
     2. 状态
     ================================================================== */
  var state = {
    wall:  LS.get('jyh-wall', 'bed'),
    mode:  LS.get('jyh-wall-mode', 'full'),
    veil:  parseInt(LS.get('jyh-veil', '62'), 10),
    hue:   LS.get('jyh-hue', '340'),
    theme: LS.get('jyh-theme', 'dark')
  };
  if (MODES.indexOf(state.mode) < 0) state.mode = 'full';
  if (!WALLS.some(function (w) { return w.id === state.wall; })) state.wall = 'bed';
  if (isNaN(state.veil)) state.veil = 62;
  state.veil = Math.max(0, Math.min(96, state.veil));

  /* ==================================================================
     3. 提示条
     ================================================================== */
  var toastEl = $('#toast'), toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2100);
  }

  /* ==================================================================
     4. 主题 / 色相
     ================================================================== */
  function applyTheme(t) {
    state.theme = t;
    doc.setAttribute('data-theme', t);
    LS.set('jyh-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#16141a' : '#f7f5f8');
  }
  applyTheme(state.theme);

  function applyHue(h) {
    state.hue = String(h);
    doc.style.setProperty('--hue', state.hue);
    LS.set('jyh-hue', state.hue);
  }
  applyHue(state.hue);

  var themeToggle = $('#themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
      toast(state.theme === 'dark' ? '已切换到深色' : '已切换到浅色');
    });
  }

  /* ==================================================================
     5. 壁纸
     ================================================================== */
  var bgLayer = $('#bg-layer');
  var wallGrid = $('#wallGrid');
  var veilRange = $('#veilRange');
  var veilVal = $('#veilVal');
  var veilEl = $('#bg-veil');

  /* 预建两层，做交叉淡入 */
  var layers = [];
  for (var li = 0; li < 2; li++) {
    var dv = document.createElement('div');
    dv.className = 'bg-img';
    bgLayer.appendChild(dv);
    layers.push(dv);
  }
  var front = 0;

  function applyVeil() {
    var base = VEIL_BY_MODE[state.mode] || VEIL_BY_MODE.full;
    var k = state.veil / 100;
    if (!veilEl) return;
    veilEl.style.setProperty('--veil-top', String(Math.round(base[0] * k)));
    veilEl.style.setProperty('--veil-mid', String(Math.round(base[1] * k)));
    veilEl.style.setProperty('--veil-bot', String(Math.round(base[2] * k)));
  }

  function setWallpaper(id, opts) {
    opts = opts || {};
    var item = WALLS.filter(function (w) { return w.id === id; })[0] || WALLS[0];
    var changed = state.wall !== item.id;

    state.wall = item.id;
    document.body.setAttribute('data-wallpaper', item.id);
    LS.set('jyh-wall', item.id);

    if (state.mode !== 'none') {
      paintWall(item.id, !!opts.immediate);
    }

    if (wallGrid) {
      $$('.wall-item', wallGrid).forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.wall === item.id));
      });
    }
    if (changed && opts.announce !== false) toast('壁纸：' + item.name);
  }

  function setMode(mode) {
    if (MODES.indexOf(mode) < 0) mode = 'full';
    state.mode = mode;
    LS.set('jyh-wall-mode', mode);
    document.body.setAttribute('data-wall-mode', mode);
    $$('#wallMode .seg-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    });
    applyVeil();
    /* 纯色：全部撤掉；其它模式：交给 setWallpaper 重新贴上当前壁纸 */
    if (mode === 'none') {
      layers.forEach(function (l) { l.classList.remove('is-active'); });
    } else {
      paintWall(state.wall, true);
    }
  }

  /* 把指定壁纸贴到「非当前」层，然后交叉淡入。
     immediate=true 时不淡入（初次进入 / 从纯色切回）。 */
  function paintWall(id, immediate) {
    var src = wallSrc(id);
    var el = layers[1 - front];
    var other = front;
    var paint = function () {
      el.style.backgroundImage = 'url("' + src + '")';
      el.classList.add('is-active');
      layers[other].classList.remove('is-active');
      front = 1 - other;
    };
    if (immediate) {
      /* 立刻贴上，不做等待 */
      el.style.transition = 'none';
      paint();
      requestAnimationFrame(function () { el.style.transition = ''; });
      return;
    }
    var im = new Image();
    im.onload = paint;
    im.onerror = paint;
    im.src = src;
  }

  /* 缩略图网格 */
  if (wallGrid) {
    WALLS.forEach(function (w) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'wall-item';
      b.dataset.wall = w.id;
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', '壁纸：' + w.name);
      b.title = w.name;
      b.innerHTML = '<img src="assets/wall-' + w.id + '-thumb.webp" alt="" width="160" height="100" loading="lazy" decoding="async">' +
                    '<span class="wall-name">' + w.name + '</span>';
      b.addEventListener('click', function () { setWallpaper(w.id); });
      wallGrid.appendChild(b);
    });
  }

  $$('#wallMode .seg-btn').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.mode); });
  });


  var randBtn = $('#wallRandom');
  if (randBtn) {
    randBtn.addEventListener('click', function () {
      var others = WALLS.filter(function (w) { return w.id !== state.wall; });
      setWallpaper(others[Math.floor(Math.random() * others.length)].id);
    });
  }

  if (veilRange) {
    veilRange.value = String(state.veil);
    if (veilVal) veilVal.textContent = state.veil + '%';
    veilRange.addEventListener('input', function () {
      state.veil = parseInt(veilRange.value, 10);
      LS.set('jyh-veil', String(state.veil));
      if (veilVal) veilVal.textContent = state.veil + '%';
      applyVeil();
    });
  }

  /* 色相圆点 */
  var HUES = [340, 275, 210, 160, 30, 0, 95];
  var hueRow = $('#hueRow');
  if (hueRow) {
    HUES.forEach(function (h) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hue-dot';
      b.dataset.hue = String(h);
      b.setAttribute('aria-label', '主题色 ' + h);
      b.setAttribute('aria-pressed', String(String(h) === state.hue));
      b.style.background = 'oklch(.68 .15 ' + h + ')';
      b.addEventListener('click', function () {
        applyHue(h);
        $$('.hue-dot', hueRow).forEach(function (x) {
          x.setAttribute('aria-pressed', String(x.dataset.hue === String(h)));
        });
      });
      hueRow.appendChild(b);
    });
  }

  /* 恢复默认外观 */
  var resetBtn = $('#resetLook');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      state.veil = 62;
      if (veilRange) veilRange.value = '62';
      if (veilVal) veilVal.textContent = '62%';
      LS.set('jyh-veil', '62');
      applyHue('340');
      if (hueRow) {
        $$('.hue-dot', hueRow).forEach(function (x) {
          x.setAttribute('aria-pressed', String(x.dataset.hue === '340'));
        });
      }
      setMode('full');
      applyTheme('dark');
      setWallpaper('bed', { announce: false });
      toast('已恢复默认外观');
    });
  }

  /* 初次应用：先定模式（不重绘），再一次性把壁纸贴上，避免两层互相撤掉 */
  document.body.setAttribute('data-wall-mode', state.mode);
  $$('#wallMode .seg-btn').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
  });
  applyVeil();
  setWallpaper(state.wall, { announce: false, immediate: true });

  /* ==================================================================
     6. 面板开关
     ================================================================== */
  var panel = $('#wallPanel'), scrim = $('#wallScrim');
  var wallBtns = [$('#wallBtn'), $('#footWall')].filter(Boolean);

  function openPanel() {
    panel.classList.add('is-open');
    scrim.classList.add('is-open');
    wallBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
    var first = $('.seg-btn', panel);
    if (first) first.focus({ preventScroll: true });
  }
  function closePanel() {
    panel.classList.remove('is-open');
    scrim.classList.remove('is-open');
    wallBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  }
  function panelOpen() { return panel.classList.contains('is-open'); }

  wallBtns.forEach(function (b) {
    b.addEventListener('click', function () { panelOpen() ? closePanel() : openPanel(); });
  });
  var wallClose = $('#wallClose');
  if (wallClose) wallClose.addEventListener('click', closePanel);
  if (scrim) scrim.addEventListener('click', closePanel);

  /* ==================================================================
     7. 视图路由
     ================================================================== */
  var views = $$('.view');
  var nav = $('#nav');
  var navToggle = $('#navToggle');
  var currentView = 'home';

  function setNavCurrent(view) {
    $$('.nav-link', nav).forEach(function (b) {
      var a = b.dataset.anchor;
      var on = (b.dataset.view === view) &&
               a !== 'about' && a !== 'contact' && a !== 'home';
      if (view === 'home' && a === 'home') on = true;
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
  }
  setNavCurrent('home');

  function showView(name) {
    if (name === currentView) return false;
    var target = $('#view-' + name);
    if (!target) return false;
    views.forEach(function (v) { v.hidden = v.dataset.view !== name; });
    currentView = name;
    setNavCurrent(name);
    return true;
  }

  /* 幕布扫过 */
  var curtain = $('#curtain'), figure = $('#jump-figure');
  var sweeping = false;

  function sweep(done) {
    if (reduceMotion || sweeping) { done(); return; }
    sweeping = true;
    curtain.classList.add('is-sweeping');
    if (figure) { figure.hidden = false; figure.classList.add('is-jumping'); }
    setTimeout(done, 380);                 /* 幕布盖满的瞬间换内容 */
    setTimeout(function () {
      curtain.classList.remove('is-sweeping');
      if (figure) { figure.classList.remove('is-jumping'); figure.hidden = true; }
      sweeping = false;
    }, 900);
  }

  function navH() {
    var v = parseInt(getComputedStyle(doc).getPropertyValue('--nav-h'), 10);
    return isNaN(v) ? 60 : v;
  }
  function scrollToAnchor(anchor) {
    if (!anchor) return;
    var el = document.getElementById(anchor);
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.pageYOffset - navH() - 14;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function go(view, anchor) {
    closeNav();
    if (view && view !== currentView) {
      sweep(function () {
        showView(view);
        window.scrollTo({ top: 0, behavior: 'auto' });
        armReveal($('#view-' + view));
        if (anchor) requestAnimationFrame(function () { scrollToAnchor(anchor); });
      });
    } else {
      if (view) setNavCurrent(view);
      scrollToAnchor(anchor);
    }
  }

  /* 只绑定「触发器」，排除视图容器本身
     （.view 上也带 data-view，绑定它会导致视图内任意点击都触发跳转） */
  $$('[data-view]').forEach(function (el) {
    if (el.classList.contains('view')) return;
    el.addEventListener('click', function (e) {
      var view = el.dataset.view, anchor = el.dataset.anchor;
      if (!view && !anchor) return;
      if (el.tagName === 'A') e.preventDefault();
      go(view, anchor);
    });
  });

  /* 抽屉导航 */
  function closeNav() {
    if (!nav) return;
    nav.classList.remove('is-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  }
  if (navToggle) {
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* ==================================================================
     8. 揭示动画
     ================================================================== */
  var revealSel = '.reveal';
  var io = null;

  function assignStagger(scope) {
    var groups = [];
    $$(revealSel, scope || document).forEach(function (el) {
      var parent = el.parentElement;
      if (!parent) return;
      var idx = groups.indexOf(parent);
      if (idx < 0) { groups.push(parent); idx = groups.length - 1; }
      /* 每个父容器各自计数 → 同组错峰 */
      var count = parent.__rvCount || 0;
      parent.__rvCount = count + 1;
      el.style.setProperty('--stagger-i', String(Math.min(count, 7)));
    });
  }

  function armReveal(scope) {
    if (!('IntersectionObserver' in window)) {
      $$(revealSel, scope || document).forEach(function (el) { el.classList.add('show'); });
      return;
    }
    $$(revealSel, scope || document).forEach(function (el) {
      if (el.dataset.revealBound === '1') return;
      el.dataset.revealBound = '1';
      io.observe(el);
    });
  }

  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        setTimeout(function () { el.classList.add('show'); }, reduceMotion ? 0 : 40);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  }

  assignStagger();
  armReveal();

  /* 进度条 */
  var bars = $$('.bar > i');
  if (bars.length) {
    if ('IntersectionObserver' in window) {
      var barIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var el = en.target;
          setTimeout(function () { el.style.width = (el.dataset.w || 0) + '%'; }, reduceMotion ? 0 : 180);
          barIO.unobserve(el);
        });
      }, { threshold: 0.35 });
      bars.forEach(function (b) { barIO.observe(b); });
    } else {
      bars.forEach(function (b) { b.style.width = (b.dataset.w || 0) + '%'; });
    }
  }

  /* 数字滚动 */
  var counters = $$('.stat-n[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    var cIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var goal = parseInt(el.dataset.count, 10) || 0;
        var t0 = performance.now(), dur = 900;
        (function step(now) {
          var p = Math.min(1, (now - t0) / dur);
          el.textContent = String(Math.round(goal * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        })(t0);
        cIO.unobserve(el);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (c) { cIO.observe(c); });
  }

  /* 打字机 */
  var typedEl = $('#typed');
  if (typedEl) {
    var PHRASES = ['网络工程学生', 'C / C++ / Python 爱好者', '二次元 + 游戏玩家', '正在研究 AI'];
    if (reduceMotion) {
      typedEl.textContent = PHRASES[0];
    } else {
      var pi = 0, ci = 0, deleting = false;
      (function tick() {
        var p = PHRASES[pi];
        if (!deleting) {
          ci++;
          typedEl.textContent = p.slice(0, ci);
          if (ci >= p.length) { deleting = true; return setTimeout(tick, 1700); }
          return setTimeout(tick, 78);
        }
        ci--;
        typedEl.textContent = p.slice(0, ci);
        if (ci <= 0) { deleting = false; pi = (pi + 1) % PHRASES.length; return setTimeout(tick, 320); }
        setTimeout(tick, 34);
      })();
    }
  }

  /* ==================================================================
     9. 星野壁纸的星空
     ================================================================== */
  var cvs = $('#stars');
  var ctx = cvs ? cvs.getContext('2d') : null;
  var stars = [], rafId = null, running = false;

  function sizeCanvas() {
    if (!cvs || !ctx) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    cvs.width = Math.floor(w * dpr);
    cvs.height = Math.floor(h * dpr);
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.max(40, Math.round((w * h) / 16000));
    stars = [];
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        a: Math.random() * 0.6 + 0.25,
        s: Math.random() * 0.022 + 0.005
      });
    }
  }

  function drawStars() {
    if (!ctx) return;
    var w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      st.a += st.s;
      if (st.a > 0.92 || st.a < 0.16) st.s *= -1;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + st.a.toFixed(3) + ')';
      ctx.fill();
    }
    rafId = requestAnimationFrame(drawStars);
  }

  function startStars() {
    if (!cvs || running || reduceMotion) return;
    running = true;
    drawStars();
  }
  function stopStars() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (cvs) {
    sizeCanvas();
    var resizeT = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        sizeCanvas();
        if (state.mode !== 'none') {
          layers[front].style.backgroundImage = 'url("' + wallSrc(state.wall) + '")';
        }
      }, 220);
    });
    if (state.wall === 'star') startStars();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopStars();
      else if (state.wall === 'star') startStars();
    });
  }

  /* ==================================================================
     10. 每日抽签
     ================================================================== */
  var FORTUNES = {
    witch: {
      label: '旅人之签',
      ranks: [
        { k: '大吉', w: 6,  grad: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
        { k: '中吉', w: 14, grad: 'linear-gradient(135deg,#f472b6,#a855f7)' },
        { k: '小吉', w: 22, grad: 'linear-gradient(135deg,#60a5fa,#34d399)' },
        { k: '吉',   w: 26, grad: 'linear-gradient(135deg,#34d399,#14b8a6)' },
        { k: '末吉', w: 20, grad: 'linear-gradient(135deg,#a78bfa,#818cf8)' },
        { k: '凶',   w: 12, grad: 'linear-gradient(135deg,#94a3b8,#64748b)' }
      ],
      poems: [
        '路远不见尽，一步是一步。',
        '风起于青萍，浪成于微澜。',
        '行到水穷处，坐看云起时。',
        '别怕走得慢，怕的是站着不动。',
        '翻开的一页，就是新的国家。',
        '旅人没有地图，只有方向。',
        '今日的雨，是明日花开的理由。',
        '背包里装的不是行李，是想去的地方。',
        '有些答案，要走出去才会遇见。',
        '把钱花在书和路上，别的都会贬值。'
      ],
      descs: [
        '今天适合开一段新的旅程：把那个一直搁着的想法，写成第一行代码。',
        '状态正好，适合啃硬骨头。挑最难的那门课，先啃二十分钟。',
        '会有一个小惊喜，多半藏在你随手点开的链接里。',
        '别急着下结论。今天多看一点，答案明天自己会浮出来。',
        '适合整理。把桌面、笔记、收藏夹清一遍，思路会跟着清爽。',
        '有人会来找你聊天，耐心听完，里面可能有你需要的信息。',
        '今天学新东西的性价比很高，趁手感在，多跑通一个小例子。',
        '慢一点没关系。你现在走的每一步，以后都会算数。'
      ],
      dims: [
        { k: '学习运', lo: 45, hi: 99 },
        { k: '代码运', lo: 40, hi: 98 },
        { k: '心情',   lo: 50, hi: 99 },
        { k: '财运',   lo: 30, hi: 92 }
      ],
      lucky: {
        color: ['蝶粉', '雾蓝', '草绿', '暖金', '墨黑', '月光白'],
        item:  ['一支笔', '一杯热茶', '一副耳机', '一本没读完的书', '一颗糖', '一张车票'],
        time:  ['清晨', '上午十点', '午后三点', '黄昏', '深夜'],
        num:   ['3', '7', '11', '17', '23', '42', '63']
      }
    },
    code: {
      label: '代码之签',
      ranks: [
        { k: '一次过',   w: 8,  grad: 'linear-gradient(135deg,#22c55e,#16a34a)' },
        { k: 'AC',       w: 20, grad: 'linear-gradient(135deg,#34d399,#14b8a6)' },
        { k: '小 WA',    w: 24, grad: 'linear-gradient(135deg,#60a5fa,#818cf8)' },
        { k: '需要调试', w: 22, grad: 'linear-gradient(135deg,#fbbf24,#f59e0b)' },
        { k: '段错误',   w: 16, grad: 'linear-gradient(135deg,#fb7185,#e11d48)' },
        { k: '重写吧',   w: 10, grad: 'linear-gradient(135deg,#94a3b8,#475569)' }
      ],
      poems: [
        '先让它跑起来，再让它跑得快。',
        '看不懂就打印出来，答案在输出里。',
        'Bug 不可怕，可怕的是不知道为什么好了。',
        '今天写的每一行，都是明天的脚手架。',
        '复制来的代码，迟早会还给你。',
        '边界情况，才是真正考功力的地方。',
        '删掉一百行，比写一百行更需要勇气。',
        '想不明白就画图，画完就明白了。'
      ],
      descs: [
        '状态在线，适合写点有挑战的东西。今天写的代码多半不用大改。',
        '大概率会遇到一个卡住你的报错。别硬刚，先搜一遍，多半有人踩过。',
        '适合重构。把手头那段「能跑但很丑」的代码收拾一下，收获比写新的还大。',
        '小心边界。今天特别容易在数组下标和空值上翻车，多测两组用例。',
        '适合读代码。找个开源项目看看别人怎么组织的，比写一天更有用。',
        '犯困就去睡。硬撑着调的 bug，醒来往往五分钟就解决了。',
        '今天适合把零散笔记整理成文档，以后会感谢现在的自己。',
        '别人的方案可以借鉴，但一定要自己敲一遍——不然下次还是不会。'
      ],
      dims: [
        { k: '编译通过',   lo: 50, hi: 99 },
        { k: 'Debug 速度', lo: 35, hi: 96 },
        { k: '专注度',     lo: 45, hi: 99 },
        { k: '摸鱼指数',   lo: 5,  hi: 88 }
      ],
      lucky: {
        color: ['终端绿', '夜蓝', '警告黄', '报错红'],
        item:  ['第二杯咖啡', '机械键盘', '双显示器', '一份好文档', '橡皮鸭'],
        time:  ['凌晨', '上午', '下午茶时间', '睡前'],
        num:   ['0', '1', '8', '64', '128', '404', '500']
      }
    },
    anime: {
      label: '番剧之签',
      ranks: [
        { k: '神作',     w: 10, grad: 'linear-gradient(135deg,#f472b6,#a855f7)' },
        { k: '霸权',     w: 18, grad: 'linear-gradient(135deg,#fb7185,#f43f5e)' },
        { k: '佳作',     w: 26, grad: 'linear-gradient(135deg,#60a5fa,#3b82f6)' },
        { k: '值得一看', w: 24, grad: 'linear-gradient(135deg,#34d399,#10b981)' },
        { k: '还行',     w: 14, grad: 'linear-gradient(135deg,#fbbf24,#f59e0b)' },
        { k: '弃了',     w: 8,  grad: 'linear-gradient(135deg,#94a3b8,#64748b)' }
      ],
      poems: [
        '一个人上路，也能遇到很好的风景。',
        '故事结束的地方，是想象的开始。',
        '治愈你的从来不是结局，是那段路。',
        '再看一集就睡——你每次都这么说。',
        '台词会过时，被戳中的感觉不会。',
        '有些番要等长大一点才看得懂。',
        '弹幕里也藏着很好的人。',
        '喜欢就多看几遍，不用觉得不好意思。'
      ],
      descs: [
        '今天适合开新番。随便点一部，第一集不喜欢就换，别硬看。',
        '适合重温。找那部你看过三遍的，再看一遍还是会有新发现。',
        '可能会被一句台词戳中，记得截图存下来。',
        '适合看剧场版。两小时一口气讲完，比追番过瘾。',
        '今天容易一口气刷到天亮，记得先定个闹钟。',
        '适合去找 OST 听。有些曲子单拎出来比片子还耐听。',
        '别只看评分，冷门里也有很对胃口的。',
        '适合和别人一起看。有人一起吐槽，观感翻倍。'
      ],
      dims: [
        { k: '催泪指数', lo: 20, hi: 99 },
        { k: '燃度',     lo: 25, hi: 99 },
        { k: '治愈度',   lo: 30, hi: 99 },
        { k: '想二刷',   lo: 15, hi: 97 }
      ],
      lucky: {
        color: ['樱粉', '夜空蓝', '夕阳橘', '雪白'],
        item:  ['一包薯片', '毛毯', '耳机', '一盒纸巾', '冰可乐'],
        time:  ['午饭后', '傍晚', '深夜', '周末下午'],
        num:   ['1', '2', '12', '24', '25']
      }
    }
  };

  var activeKind = LS.get('jyh-fortune-kind', 'witch');
  if (!FORTUNES[activeKind]) activeKind = 'witch';

  var resultEl = $('#fortuneResult');
  var omikujiEl = $('#omikuji');
  var hintEl = $('#omikujiHint');

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* 同一天 + 同一签种 → 同一结果（稳定伪随机） */
  function seededRandom(seed) {
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 15), h | 1);
      h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
      return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickWeighted(list, rnd) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].w;
    var r = rnd() * total;
    for (i = 0; i < list.length; i++) {
      r -= list[i].w;
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }
  function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length) % arr.length]; }

  function makeFortune(kind, dateKey) {
    var F = FORTUNES[kind];
    var rnd = seededRandom(kind + '|' + dateKey);
    var rank = pickWeighted(F.ranks, rnd);
    var rankIdx = F.ranks.indexOf(rank);
    var quality = 1 - rankIdx / (F.ranks.length - 1);
    var dims = F.dims.map(function (d) {
      var base = d.lo + (d.hi - d.lo) * quality;
      var jitter = (rnd() - 0.5) * (d.hi - d.lo) * 0.36;
      return { k: d.k, v: Math.max(2, Math.min(99, Math.round(base + jitter))) };
    });
    return {
      kind: kind, label: F.label, date: dateKey,
      rank: rank.k, grad: rank.grad,
      poem: pick(F.poems, rnd),
      desc: pick(F.descs, rnd),
      dims: dims,
      lucky: {
        color: pick(F.lucky.color, rnd),
        item:  pick(F.lucky.item, rnd),
        time:  pick(F.lucky.time, rnd),
        num:   pick(F.lucky.num, rnd)
      },
      no: Math.floor(rnd() * 60) + 1
    };
  }

  function readLog() {
    try { return JSON.parse(LS.get('jyh-fortune-log', '{}')) || {}; } catch (e) { return {}; }
  }
  function getResult(kind) {
    var s = readLog();
    return (s[kind] && s[kind].date === todayKey()) ? s[kind] : null;
  }
  function putResult(res) {
    var s = readLog();
    s[res.kind] = res;
    /* 只保留最近三种签，避免无限增长 */
    var keys = Object.keys(s);
    if (keys.length > 3) keys.slice(0, keys.length - 3).forEach(function (k) { delete s[k]; });
    LS.set('jyh-fortune-log', JSON.stringify(s));
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderEmpty(kind) {
    var F = FORTUNES[kind];
    var tail = kind === 'code' ? '看看今天的代码运势'
             : kind === 'anime' ? '看看今天适合看什么'
             : '看看今天落在哪一句上';
    resultEl.innerHTML =
      '<div class="fr-empty">' +
        '<h3>' + esc(F.label) + '</h3>' +
        '<p>今天还没抽。点左边的签筒摇一摇，' + tail + '。</p>' +
        '<div><span class="fr-no">共 ' + F.ranks.length + ' 种签 · 每天一签</span></div>' +
      '</div>';
    if (hintEl) hintEl.textContent = '点我抽签';
  }

  function renderResult(res) {
    var bars = res.dims.map(function (d) {
      return '<div class="fr-luck-row">' +
        '<span class="fr-luck-k">' + esc(d.k) + '</span>' +
        '<span class="fr-luck-bar"><i data-w="' + d.v + '"></i></span>' +
        '<span class="fr-luck-v">' + d.v + '</span>' +
      '</div>';
    }).join('');

    resultEl.innerHTML =
      '<div class="fr-done">' +
        '<div class="fr-rank-row">' +
          '<span class="fr-rank" style="--grad:' + res.grad + '">' + esc(res.rank) +
            '<small>第 ' + res.no + ' 签</small></span>' +
          '<span class="fr-date">' + esc(res.date) + ' · ' + esc(res.label) + '</span>' +
        '</div>' +
        '<p class="fr-poem">' + esc(res.poem) + '</p>' +
        '<p class="fr-desc">' + esc(res.desc) + '</p>' +
        '<div class="fr-luck">' + bars + '</div>' +
        '<div class="fr-lucky">' +
          '<span>幸运色 <b>' + esc(res.lucky.color) + '</b></span>' +
          '<span>幸运物 <b>' + esc(res.lucky.item) + '</b></span>' +
          '<span>吉时 <b>' + esc(res.lucky.time) + '</b></span>' +
          '<span>幸运数 <b>' + esc(res.lucky.num) + '</b></span>' +
        '</div>' +
      '</div>';

    if (hintEl) hintEl.textContent = '已成签 · 明日再来';

    requestAnimationFrame(function () {
      $$('.fr-luck-bar > i', resultEl).forEach(function (b, i) {
        setTimeout(function () { b.style.width = (b.dataset.w || 0) + '%'; }, 90 + i * 95);
      });
    });
  }

  function renderFortune(kind) {
    if (!resultEl) return;
    var res = getResult(kind);
    if (res) renderResult(res); else renderEmpty(kind);
    if (omikujiEl) omikujiEl.classList.toggle('is-done', !!res);
  }

  var tabsEl = $('#fortuneTabs');
  if (tabsEl) {
    Object.keys(FORTUNES).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fortune-tab';
      b.dataset.kind = k;
      b.setAttribute('aria-pressed', String(k === activeKind));
      b.textContent = FORTUNES[k].label;
      b.addEventListener('click', function () {
        activeKind = k;
        LS.set('jyh-fortune-kind', k);
        $$('.fortune-tab', tabsEl).forEach(function (x) {
          x.setAttribute('aria-pressed', String(x.dataset.kind === k));
        });
        renderFortune(k);
      });
      tabsEl.appendChild(b);
    });
  }
  renderFortune(activeKind);

  var drawing = false;
  function draw() {
    if (!omikujiEl || drawing) return;
    if (getResult(activeKind)) { toast('今天已经抽过了，明天再来'); return; }
    drawing = true;
    omikujiEl.classList.add('is-shaking');
    if (hintEl) hintEl.textContent = '摇一摇…';

    setTimeout(function () {
      omikujiEl.classList.remove('is-shaking');
      var res = makeFortune(activeKind, todayKey());
      putResult(res);
      renderResult(res);
      omikujiEl.classList.add('is-done');
      if (hintEl) hintEl.textContent = '已成签 · 明日再来';
      drawing = false;
      toast('抽到了「' + res.rank + '」');
    }, reduceMotion ? 60 : 1150);
  }
  if (omikujiEl) omikujiEl.addEventListener('click', draw);

  /* ==================================================================
     11. 复制邮箱
     ================================================================== */
  $$('[data-mail]').forEach(function (b) {
    b.addEventListener('click', function () {
      var mail = b.dataset.mail;
      var ok = function () { toast('邮箱已复制：' + mail); };
      var fallback = function () {
        var ta = document.createElement('textarea');
        ta.value = mail;
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); ok(); } catch (e) { toast(mail); }
        document.body.removeChild(ta);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(mail).then(ok, fallback);
      } else { fallback(); }
    });
  });

  /* ==================================================================
     12. 加载屏
     ================================================================== */
  var loaderEl = $('#loader');
  var loadBar = $('#loadBar');
  var loadArc = $('#loadArc');
  var loadPct = $('#loadPct');
  var loadMsg = $('#loadMsg');

  var CRITICAL = [
    'assets/avatar.webp',
    'assets/avatar@2x.webp',
    'assets/wall-' + state.wall + '.webp',
    'assets/wall-' + state.wall + '-p.webp',
    'assets/wall-' + state.wall + '-thumb.webp',
    'assets/muki-feature.webp',
    'assets/cover-elaina.webp'
  ];
  var MSGS = ['正在展开地图…', '正在整理行囊…', '正在点亮灯火…', '马上出发…'];

  function finishLoad() {
    if (loadBar) loadBar.style.width = '100%';
    if (loadArc) loadArc.style.strokeDashoffset = '0';
    if (loadPct) loadPct.textContent = '100';
    document.body.classList.add('loaded');

    if (!reduceMotion) {
      curtain.classList.add('is-sweeping');
      setTimeout(function () { curtain.classList.remove('is-sweeping'); }, 900);
    }
    setTimeout(function () {
      if (loaderEl) loaderEl.classList.add('is-gone');
      armReveal($('#view-' + currentView));
    }, reduceMotion ? 0 : 300);
    setTimeout(function () { if (loaderEl) loaderEl.style.display = 'none'; }, 1200);
  }

  (function runLoader() {
    var total = CRITICAL.length;
    var shown = -1;

    function setProgress(p) {
      if (p <= shown) return;
      shown = p;
      if (loadBar) loadBar.style.width = p + '%';
      if (loadArc) loadArc.style.strokeDashoffset = String(201 - (201 * p) / 100);
      if (loadPct) loadPct.textContent = String(p);
      if (loadMsg) loadMsg.textContent = MSGS[Math.min(MSGS.length - 1, Math.floor((p / 100) * MSGS.length))];
    }

    var seen = false;
    try { seen = sessionStorage.getItem('jyh-booted') === '1'; } catch (e) {}

    if (seen) { setProgress(100); setTimeout(finishLoad, 60); return; }

    var done = 0;
    function bump() {
      done++;
      setProgress(Math.round((done / total) * 100));
    }
    CRITICAL.forEach(function (src) {
      var im = new Image();
      im.onload = im.onerror = bump;
      im.src = src;
    });

    /* 兜底：最少展示 900ms，最多 4s */
    var t0 = Date.now();
    var MIN_MS = reduceMotion ? 0 : 900;
    setTimeout(function () {
      var wait = Math.max(0, MIN_MS - (Date.now() - t0));
      setTimeout(function () {
        try { sessionStorage.setItem('jyh-booted', '1'); } catch (e) {}
        setProgress(100);
        finishLoad();
      }, wait);
    }, 0);
  })();

  /* ==================================================================
     13. 顶栏自动隐藏
     ================================================================== */
  var lastY = window.pageYOffset, ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset;
      if (y > 220 && y > lastY + 6) document.body.classList.add('nav-hidden');
      else if (y < lastY - 6 || y < 120) document.body.classList.remove('nav-hidden');
      lastY = y;
      ticking = false;
    });
  }, { passive: true });

  /* ==================================================================
     14. 杂项
     ================================================================== */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (panelOpen()) closePanel(); else closeNav();
  });

  /* 回到前台若已跨天，刷新签面 */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) renderFortune(activeKind);
  });
})();
