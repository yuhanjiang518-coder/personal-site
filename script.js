/* ==========================================================
   向き · 个人主页 v2  |  script.js
   ========================================================== */
(function () {
  'use strict';
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };


  /* ---------- 0. 加载动画 ---------- */
  (function initLoader() {
    var loader = $('#loader');
    if (!loader) return;

    var bar   = $('#loaderBar');
    var msgEl = $('#loaderMsg');
    var pctEl = $('#loaderPct');

    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var seen = false;
    try { seen = sessionStorage.getItem('jyh-booted') === '1'; } catch (e) {}

    function finish() {
      loader.classList.add('done');
      document.body.classList.add('loaded');
      try { sessionStorage.setItem('jyh-booted', '1'); } catch (e) {}
      setTimeout(function () {
        if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
      }, 700);
      // 让首屏动画从头播放
      window.dispatchEvent(new Event('resize'));
    }

    // 无障碍 / 重复访问 / 无 JS 动画能力 → 直接跳过
    if (reduce || seen) { finish(); return; }

    // 锁定滚动，避免加载时背景滑动
    document.documentElement.style.overflow = 'hidden';

    var MESSAGES = [
      [0,  '初始化环境…'],
      [18, '加载背景插画…'],
      [42, '解析样式表…'],
      [62, '启动交互脚本…'],
      [80, '渲染页面结构…'],
      [93, '准备就绪']
    ];

    var progress = 0;
    var target   = 0;
    var done     = false;

    function label(p) {
      var out = MESSAGES[0][1];
      for (var i = 0; i < MESSAGES.length; i++) {
        if (p >= MESSAGES[i][0]) out = MESSAGES[i][1];
      }
      return out;
    }

    function paint(p) {
      var v = Math.max(0, Math.min(100, Math.round(p)));
      if (bar)   bar.style.width = v + '%';
      if (pctEl) pctEl.textContent = v;
      if (msgEl) {
        var t = label(v);
        if (msgEl.textContent !== t) msgEl.textContent = t;
      }
    }

    // 真实进度：统计已完成的加载项
    var assets = [];
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) assets.push(imgs[i]);

    // 背景图（CSS 里的）+ 主资源
    ['assets/bg-dark.webp', 'assets/bg-rail.webp'].forEach(function (src) {
      var im = new Image();
      im.src = src;
      assets.push(im);
    });

    var total = assets.length || 1;
    var loadedCount = 0;

    function onAsset() {
      loadedCount++;
      target = Math.min(88, (loadedCount / total) * 88);
    }
    assets.forEach(function (im) {
      if (im.complete) { onAsset(); return; }
      im.addEventListener('load',  onAsset, { once: true });
      im.addEventListener('error', onAsset, { once: true });
    });

    // 页面本身 ready 后推进到 95
    if (document.readyState === 'complete') {
      target = Math.max(target, 95);
    } else {
      window.addEventListener('load', function () {
        target = Math.max(target, 95);
      }, { once: true });
    }

    var t0 = Date.now();
    var MIN_MS = 900;    // 最短展示时间，避免闪一下就没了
    var MAX_MS = 2800;   // 硬上限，卡住也一定能进
    var EASE   = 0.22;

    var timer = setInterval(function () {
      var elapsed = Date.now() - t0;

      // 缓和跟随目标
      var ceiling = elapsed >= MIN_MS ? 100 : 94;
      var goal = Math.min(target, ceiling);

      // 时间兜底：真卡住时才强行推进
      if (elapsed > MAX_MS * 0.55) {
        goal = Math.max(goal, Math.min(100, 55 + (elapsed / MAX_MS) * 60));
      }

      progress += (goal - progress) * EASE;

      // 临近 MAX_MS 时线性补足，避免指数收敛拖尾
      if (elapsed >= MAX_MS * 0.7) {
        var forced = 100 * Math.min(1, (elapsed - MAX_MS * 0.7) / (MAX_MS * 0.3));
        if (forced > progress) progress += (forced - progress) * 0.4;
      }

      if (goal >= 100 && progress > 99.4) progress = 100;
      paint(progress);

      if (!done && elapsed >= MIN_MS && progress >= 99.9) {
        done = true;
        clearInterval(timer);
        paint(100);
        document.documentElement.style.overflow = '';
        setTimeout(finish, 300);
      }
      if (!done && elapsed >= MAX_MS) {
        done = true;
        clearInterval(timer);
        paint(100);
        document.documentElement.style.overflow = '';
        setTimeout(finish, 200);
      }
    }, 40);

    // 万一用户切走了页面，回来立即收尾
    document.addEventListener('visibilitychange', function () {
      if (document.hidden || done) return;
      var el = Date.now() - t0;
      if (el > MIN_MS) {
        target = 100;
      }
    });
  })();

  /* ---------- 1. 打字机 ---------- */
  var phrases = [
    '网络工程 · 本科生',
    'C / C++ / Python 开发者',
    '动漫爱好者',
    '游戏玩家',
    'AI 探索者'
  ];
  var typedEl = $('#typed'), pi = 0, ci = 0, deleting = false;
  function type() {
    if (!typedEl) return;
    var w = phrases[pi];
    typedEl.textContent = deleting ? w.slice(0, --ci) : w.slice(0, ++ci);
    var d = deleting ? 55 : 105;
    if (!deleting && ci === w.length) { deleting = true; d = 1600; }
    else if (deleting && ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; d = 360; }
    setTimeout(type, d);
  }
  if (typedEl) setTimeout(type, 600);

  /* ---------- 2. 滚动显现 ---------- */
  var revealTargets = $$('.section > *, .hero-main, .hero-side, .panel, .card, .hobby, .site');
  revealTargets.forEach(function (el) { el.classList.add('reveal'); });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e, i) {
        if (!e.isIntersecting) return;
        var el = e.target;
        setTimeout(function () { el.classList.add('show'); }, Math.min(i, 5) * 60);
        io.unobserve(el);
      });
    }, { threshold: .1, rootMargin: '0px 0px -50px 0px' });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('show'); });
  }

  /* ---------- 3. 技能条 ---------- */
  var bars = $$('.bar i');
  if ('IntersectionObserver' in window) {
    var bo = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        setTimeout(function () { e.target.classList.add('fill'); }, 160);
        bo.unobserve(e.target);
      });
    }, { threshold: .35 });
    bars.forEach(function (b) { bo.observe(b); });
  } else {
    bars.forEach(function (b) { b.classList.add('fill'); });
  }

  /* ---------- 4. 数字增长 ---------- */
  var nums = $$('[data-count]');
  if ('IntersectionObserver' in window) {
    var no = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, t = parseInt(el.getAttribute('data-count'), 10) || 0, c = 0;
        var step = Math.max(1, Math.ceil(t / 16));
        var iv = setInterval(function () {
          c += step;
          if (c >= t) { c = t; clearInterval(iv); }
          el.textContent = c;
        }, 55);
        no.unobserve(el);
      });
    }, { threshold: .5 });
    nums.forEach(function (n) { no.observe(n); });
  } else {
    nums.forEach(function (n) { n.textContent = n.getAttribute('data-count'); });
  }

  /* ---------- 5. 滚动进度条 ---------- */
  var prog = $('#progress');
  function onScroll() {
    if (!prog) return;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.transform = 'scaleX(' + (h > 0 ? Math.min(window.scrollY / h, 1) : 0) + ')';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- 6. 导航高亮（scroll spy） ---------- */
  var links = $$('.rail-link');
  var sections = links.map(function (a) { return $(a.getAttribute('href')); }).filter(Boolean);

  function spy() {
    var pos = window.scrollY + window.innerHeight * 0.28;
    var idx = 0;
    sections.forEach(function (s, i) { if (s.offsetTop <= pos) idx = i; });
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 60) {
      idx = sections.length - 1;
    }
    links.forEach(function (a, i) { a.classList.toggle('active', i === idx); });
  }
  window.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('resize', spy);
  spy();

  /* ---------- 7. 平滑滚动（含侧栏偏移） ---------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      var t = $(id);
      if (!t) return;
      e.preventDefault();
      window.scrollTo({ top: t.offsetTop - 22, behavior: 'smooth' });
      closeRail();
    });
  });

  /* ---------- 8. 移动端抽屉 ---------- */
  var rail = $('#rail'), toggle = $('#railToggle'), backdrop = null;
  if (rail) {
    backdrop = document.createElement('div');
    backdrop.className = 'rail-backdrop';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', closeRail);
  }
  function closeRail() {
    if (rail) rail.classList.remove('open');
    if (backdrop) backdrop.classList.remove('show');
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      rail.classList.toggle('open');
      backdrop.classList.toggle('show', rail.classList.contains('open'));
    });
  }

  /* ---------- 9. 复制邮箱 ---------- */
  function legacyCopy(text, ok) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); ok(); } catch (err) { toast('复制失败，请手动复制'); }
    document.body.removeChild(ta);
  }
  $$('[data-mail]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mail = btn.getAttribute('data-mail');
      var done = function () { toast('邮箱已复制：' + mail); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(mail).then(done, function () { legacyCopy(mail, done); });
      } else { legacyCopy(mail, done); }
    });
  });

  /* ---------- 10. Toast ---------- */
  var toastEl = $('#toast'), timer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(timer);
    timer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ---------- 11. 邮件按钮 ---------- */
  var mailBtn = $('#mailBtn');
  if (mailBtn) {
    mailBtn.setAttribute('href',
      'mailto:3356559040@qq.com?subject=' + encodeURIComponent('你好，向き！'));
  }

  /* ---------- 12. 主题切换 ---------- */
  var root = document.documentElement, tt = $('#themeToggle');
  var saved = null;
  try { saved = localStorage.getItem('jyh-theme'); } catch (e) {}
  var prefersLight = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: light)').matches;
  setTheme(saved || (prefersLight ? 'light' : 'dark'));

  if (tt) {
    tt.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      setTheme(next);
      try { localStorage.setItem('jyh-theme', next); } catch (e) {}
      toast(next === 'light' ? '已切换到浅色' : '已切换到深色');
    });
  }
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    if (tt) tt.textContent = t === 'light' ? '☀️' : '🌙';
  }


  /* ---------- 14. 壁纸切换 ---------- */
  var WALLS = ['landscape', 'portrait', 'blur', 'dark', 'none'];
  var DEFAULT_WALL = 'dark';
  var wallPanel = $('#wallPanel');
  var wallBtn = $('#wallBtn');
  var wallSaved = null;
  try { wallSaved = localStorage.getItem('jyh-wall'); } catch (e) {}

  function setWall(w, save) {
    if (WALLS.indexOf(w) === -1) w = DEFAULT_WALL;
    document.body.setAttribute('data-wall', w);
    $$('.wall-opt').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-wall') === w);
    });
    if (wallBtn) wallBtn.classList.toggle('on', w !== DEFAULT_WALL);
    if (save !== false) {
      try { localStorage.setItem('jyh-wall', w); } catch (e) {}
    }
  }
  setWall(wallSaved || DEFAULT_WALL, false);

  if (wallBtn && wallPanel) {
    wallBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      wallPanel.classList.toggle('show');
    });
    document.addEventListener('click', function (e) {
      if (!wallPanel.contains(e.target) && e.target !== wallBtn) {
        wallPanel.classList.remove('show');
      }
    });
  }
  $$('.wall-opt').forEach(function (b) {
    b.addEventListener('click', function () {
      setWall(b.getAttribute('data-wall'));
      toast('背景已切换');
    });
  });

  /* ---------- 15. 键盘快捷键 ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 't' || e.key === 'T') { tt && tt.click(); }
    if (e.key === 'w' || e.key === 'W') { wallPanel && wallPanel.classList.toggle('show'); }
  });

  /* ---------- 13. 页脚年份 ---------- */
  var y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
})();
