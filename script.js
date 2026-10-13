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
    var arc    = $('.le-arc');
    var emblem = $('.loader-emblem');
    var RING   = 128.8;           // 2 * PI * r(20.5)
    var lastRipple = 0;           // 每推进 20% 荡开一圈脉冲

    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var seen = false;
    try { seen = sessionStorage.getItem('jyh-booted') === '1'; } catch (e) {}

    // skip=true 表示不做开屏动画（无障碍 / 二次访问），直接让位
    function finish(skip) {
      if (arc) arc.style.strokeDashoffset = '0';
      if (bar) bar.style.width = '100%';
      if (pctEl) pctEl.textContent = '100';

      var riseDelay = skip ? 0 : 240;

      // 起幕；幕布 0.9s + 最后一层错峰 0.22s + 余量
      setTimeout(function () {
        loader.classList.add('done');
        document.body.classList.add('loaded');
      }, riseDelay);

      try { sessionStorage.setItem('jyh-booted', '1'); } catch (e) {}

      setTimeout(function () {
        if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
      }, riseDelay + (skip ? 0 : 900 + 220 + 260));

      // 让首屏动画从头播放
      window.dispatchEvent(new Event('resize'));
    }

    // 无障碍 / 重复访问 / 无 JS 动画能力 → 直接跳过
    if (reduce || seen) { finish(true); return; }

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
      if (arc)   arc.style.strokeDashoffset = (RING * (1 - v / 100)).toFixed(2);

      // 每跨过 20% 让徽记荡一圈涟漪（只在跨档时触发一次）
      if (emblem) {
        var mark = Math.floor(v / 20) * 20;
        if (mark > lastRipple && v < 100) {
          lastRipple = mark;
          emblem.classList.remove('tick');
          void emblem.offsetWidth;      // 强制回流，让动画能重播
          emblem.classList.add('tick');
        }
      }
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

  /* ---------- 0a. 转场幕布节点 ---------- */
  var curtain2 = (function () {
    if (!$('#loader')) return null;
    if (window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    var el = document.createElement('div');
    el.id = 'curtain2';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<i></i>';
    document.body.appendChild(el);
    return el;
  })();

  /* ---------- 0b. 粒子星空背景 ---------- */
  (function starField() {
    var cv = $('#stars');
    if (!cv) return;
    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    var ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, pts = [];
    var mouse = { x: -9999, y: -9999, active: false };

    // 从主题色板取色：蝶粉 / 暖金 / 草绿
    var DOT   = 'rgba(240, 166, 192, ';   // --accent 蝶粉
    var LINE  = 'rgba(232, 200, 106, ';   // --accent-2 暖金
    var LINK  = 'rgba(240, 166, 192, ';
    var isLight = function () {
      return document.documentElement.getAttribute('data-theme') === 'light';
    };

    function build() {
      var vw = window.innerWidth, vh = window.innerHeight;
      w = cv.width  = Math.floor(vw * dpr);
      h = cv.height = Math.floor(vh * dpr);
      cv.style.width  = vw + 'px';
      cv.style.height = vh + 'px';

      // 密度：每 11000 平方 CSS 像素一颗，上限 150
      var n = Math.min(150, Math.round((vw * vh) / 11000));
      if (vw < 600) n = Math.min(n, 70);        // 手机上收一点，省电

      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.20 * dpr,
          vy: (Math.random() - 0.5) * 0.20 * dpr,
          r: (Math.random() * 1.5 + 0.5) * dpr,
          a: Math.random() * 0.45 + 0.22,
          gold: Math.random() < 0.3          // 三成粒子用暖金色
        });
      }
    }

    window.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX * dpr;
      mouse.y = e.clientY * dpr;
      mouse.active = true;
    }, { passive: true });
    window.addEventListener('mouseleave', function () {
      mouse.active = false;
      mouse.x = mouse.y = -9999;
    }, { passive: true });

    var running = true;
    var raf = 0;

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      var link   = 130 * dpr;
      var reach  = 150 * dpr;
      var light  = isLight();
      var dim    = light ? 1.35 : 1;   // 浅色主题下加深一点

      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // 圆点
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = (p.gold ? LINE : DOT) + (p.a * dim).toFixed(3) + ')';
        ctx.fill();

        // 粒子之间连线
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j];
          var dx = p.x - q.x, dy = p.y - q.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < link * link) {
            var d = Math.sqrt(d2);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = LINK + (0.15 * (1 - d / link) * dim).toFixed(3) + ')';
            ctx.lineWidth = dpr * 0.6;
            ctx.stroke();
          }
        }

        // 鼠标附近的粒子与指针连线
        if (mouse.active) {
          var mdx = p.x - mouse.x, mdy = p.y - mouse.y;
          var md2 = mdx * mdx + mdy * mdy;
          if (md2 < reach * reach) {
            var md = Math.sqrt(md2);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = DOT + (0.30 * (1 - md / reach) * dim).toFixed(3) + ')';
            ctx.lineWidth = dpr * 0.7;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(frame);
    }

    build();
    window.addEventListener('resize', build);

    // 切到后台就暂停，省电
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; raf = requestAnimationFrame(frame); }
    });

    raf = requestAnimationFrame(frame);
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

  /* ---------- 2. 滚动显现（隐藏视图内的元素暂不观察） ----------
     错峰由 CSS 的 --stagger-i × 45ms 承担，这里只负责标序号和触发，
     避免 setTimeout 排队导致长列表越来越慢。 */
  var revealSel = '.section > *, .panel, .card, .hobby, .site, .game, .anime-card, .rm-item, .mx-group, .page-head';
  var revealTargets = $$(revealSel);
  revealTargets.forEach(function (el) { el.classList.add('reveal'); });

  // 同一组（同一个父元素）内的兄弟依次错峰，跨组重置
  var STAGGER_STEP = 45;   // ms，落在规范建议的 30–80ms
  var STAGGER_MAX  = 8;    // 最多叠 8 档（360ms），再长就一起出来
  function assignStagger(scope) {
    var groups = {};
    Array.prototype.forEach.call(scope.querySelectorAll('.reveal'), function (el) {
      var key = el.parentNode;
      groups[key] = groups[key] || [];
      groups[key].push(el);
    });
    Object.keys(groups).forEach(function (k) {
      groups[k].forEach(function (el, i) {
        el.style.setProperty('--stagger-i', Math.min(i, STAGGER_MAX));
      });
    });
  }

  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('show');
        io.unobserve(e.target);   // 只播一次，不在每次滚动时重放
      });
    }, { threshold: .1, rootMargin: '0px 0px -50px 0px' });
  }

  // 切换视图时调用：把该视图内还没显现的元素重新纳入观察
  function armReveal(scope) {
    var nodes = scope ? scope.querySelectorAll(revealSel) : [];
    if (!nodes.length && scope) nodes = scope.querySelectorAll('.reveal');

    // 错峰序号先标好，无 IO 的分支也要有（否则 CSS 拿到默认值 0，全挤在一起）
    assignStagger(scope || document);

    if (!io) {
      Array.prototype.forEach.call(nodes, function (el) { el.classList.add('show'); });
      return;
    }
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.classList.contains('show')) return;
      io.observe(el);
    });
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

  /* ---------- 6. 视图切换（不刷新、不改 URL） ---------- */
  var views    = $$('.view');
  var links    = $$('.rail-link');

  function currentView() {
    for (var i = 0; i < views.length; i++) {
      if (!views[i].hidden) return views[i];
    }
    return views[0];
  }

  // 找出每个 section 属于哪个视图
  function viewOf(el) {
    var n = el;
    while (n && n !== document.body) {
      if (n.classList && n.classList.contains('view')) return n;
      n = n.parentNode;
    }
    return null;
  }

  // 真正切换 DOM。转场幕布会在这之前盖住整屏。
  function swapView(name, anchorId) {
    var target = null;
    Array.prototype.forEach.call(views, function (v) {
      if (v.getAttribute('data-view') === name) target = v;
    });
    if (!target) target = views[0];

    var changed = target.hidden;
    Array.prototype.forEach.call(views, function (v) { v.hidden = (v !== target); });

    if (changed) {
      // 重新触发该视图内的入场动画
      Array.prototype.forEach.call(target.querySelectorAll('.reveal'), function (el) {
        el.classList.remove('show');
      });
      refillBars(target);
      armReveal(target);
    }

    // 定位（幕布盖着，用 auto 避免看到滚动过程）
    var el = anchorId ? document.getElementById(anchorId) : null;
    if (el && viewOf(el) === target) {
      window.scrollTo({ top: el.offsetTop - 22, behavior: 'auto' });
    } else if (changed) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    updateActive(name, anchorId);
    onScroll();
    return changed;
  }

  var transitioning = false;

  // 切到指定视图；带幕布转场
  function showView(name, anchorId, instant) {
    // 同视图内跳锚点：不盖幕布，平滑滚过去就行
    var sameView = false;
    var probe = anchorId ? document.getElementById(anchorId) : null;
    if (probe) {
      var pv = viewOf(probe);
      sameView = pv && pv.getAttribute('data-view') === name &&
                 !pv.hidden;
    }

    var wantCurtain = curtain2 && !instant && !sameView && !transitioning;

    if (wantCurtain) {
      transitioning = true;
      curtain2.classList.remove('off');
      curtain2.classList.add('on');

      // 等幕布落下（0.3s + 0.1s 错峰）
      var tDrop = 420;
      setTimeout(function () {
        swapView(name, anchorId);
        // 让浏览器先把新视图画出来，再揭开
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            curtain2.classList.add('off');
            setTimeout(function () {
              curtain2.classList.remove('on');
              curtain2.classList.remove('off');
              transitioning = false;
            }, 720);
          });
        });
      }, tDrop);
      return;
    }

    swapView(name, anchorId);
  }

  function updateActive(viewName, anchorId) {
    links.forEach(function (a) {
      var linkView = a.getAttribute('data-view');
      var linkAnchor = a.getAttribute('data-anchor');
      var on = false;
      if (anchorId && linkAnchor === anchorId) on = true;
      else if (!anchorId && linkView === viewName) on = true;
      a.classList.toggle('active', on);
    });
  }

  // 点击导航
  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var anchor = a.getAttribute('data-anchor');
      var el = anchor ? document.getElementById(anchor) : null;
      var v = el ? viewOf(el) : null;
      var name = v ? v.getAttribute('data-view') : (a.getAttribute('data-view') || 'home');
      showView(name, anchor, false);
      closeRail();
    });
  });

  // 页内其他 # 链接（hero 按钮、卡片里的锚点）
  $$('a[href^="#"]').forEach(function (a) {
    if (a.classList.contains('rail-link')) return;
    a.addEventListener('click', function (e) {
      var id = (a.getAttribute('href') || '').slice(1);
      if (!id) return;
      var el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      var v = viewOf(el);
      var name = v ? v.getAttribute('data-view') : 'home';
      showView(name, id, false);
    });
  });

  /* ---------- 6b. 首个视图：若带 hash 则定位 ---------- */
  (function initView() {
    var hash = location.hash ? location.hash.slice(1) : '';
    var el = hash ? document.getElementById(hash) : null;
    if (el) {
      var v = viewOf(el);
      showView(v ? v.getAttribute('data-view') : 'home', hash, true);
    } else {
      showView('home', null, true);
    }
    // 当前可见视图立即纳入观察，其余视图等切换时再说
    armReveal(currentView());
  })();

  /* ---------- 6c. 滚动时的高亮（视图内 spy） ---------- */
  function spy() {
    var v = currentView();
    if (!v) return;
    var vName = v.getAttribute('data-view');
    // 当前视图内的锚点链接
    var inner = links.filter(function (a) {
      var el = document.getElementById(a.getAttribute('data-anchor') || '');
      return el && viewOf(el) === v;
    });
    if (!inner.length) { updateActive(vName, null); return; }

    var pos = window.scrollY + window.innerHeight * 0.3;
    var best = inner[0];
    inner.forEach(function (a) {
      var el = document.getElementById(a.getAttribute('data-anchor'));
      if (el && el.offsetTop <= pos) best = a;
    });
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 60) {
      best = inner[inner.length - 1];
    }
    // 只高亮最靠下的匹配项，但主链接（data-view）保持分组感
    Array.prototype.forEach.call(links, function (a) { a.classList.remove('active'); });
    best.classList.add('active');
  }
  window.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('resize', spy);

  function refillBars(scope) {
    (scope || document).querySelectorAll('.bar i').forEach(function (b) {
      b.classList.remove('fill');
      setTimeout(function () { b.classList.add('fill'); }, 160);
    });
  }

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
