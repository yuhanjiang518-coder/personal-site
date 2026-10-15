/* DriftWall —— 从 reactbits.dev/components/drift-wall 移植。
 *
 * 原版的结构：把条目轮流分进 N 根竖直的轨道，每根轨道把自己复制若干遍，
 * 整体按 copyHeight 取模循环平移 —— 于是每根轨道都是无限滚动的。
 * 相邻列的滚动方向相反，速度按黄金比的伪随机系数拉开差距，
 * 整块"墙"再挂到一个 rotateX/rotateY 的 3D 平面上，跟随指针做阻尼视差。
 * 指针压到哪一块，那一块就抬起来（translateZ）并解除压暗，同时那一列暂停。
 *
 * 移植时有意改动的地方：
 *   · **加了可见性门控**：原版的 rAF 是常驻的。这里是全屏浮层里的一张墙，
 *     关掉浮层还在跑纯属浪费 —— 所以只在浮层打开且元素真的在视口里时才转。
 *   · 去掉了 React，改成读 DOM 里的图库条目（#artStrip [data-full]），
 *     这样加一张画廊图不用再同步一份数据。
 *   · 遮挡层不透明度抽成 --dw-overlay-o，方便按站点暗底调。
 */
(function () {
  'use strict';

  var DEFAULTS = {
    columns: 6,
    tileWidth: 200,
    tileHeight: 268,
    gap: 18,
    radius: 16,
    tilt: 14,
    turn: -12,
    roll: 0,
    perspective: 1200,
    depth: 120,
    speed: 42,
    direction: 'up',
    variance: 0.45,
    parallax: 0.6,
    lift: 70,
    fade: 0.6,
    dim: 0.78,
    overlayColor: '#0a1622',
    minColumns: 3,
    columnWidth: 250
  };

  // 黄金比伪随机：让每一列的速度都不一样，但又是确定的（同样的输入永远同样的墙）
  function columnFactor(index, variance) {
    var pseudo = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1;
    return 1 + variance * pseudo;
  }

  function num(el, name, dflt) {
    var v = el.getAttribute('data-dw-' + name);
    if (v === null || v === '') return dflt;
    var n = Number(v);
    return isNaN(n) ? dflt : n;
  }

  function mount(host, items, opts) {
    var S = {};
    for (var k in DEFAULTS) S[k] = DEFAULTS[k];
    if (opts) for (var o in opts) if (opts[o] !== undefined) S[o] = opts[o];
    S.columns = num(host, 'columns', S.columns);
    S.speed = num(host, 'speed', S.speed);
    S.dim = num(host, 'dim', S.dim);
    S.lift = num(host, 'lift', S.lift);
    S.parallax = num(host, 'parallax', S.parallax);
    S.fade = num(host, 'fade', S.fade);
    S.variance = num(host, 'variance', S.variance);
    if (host.getAttribute('data-dw-direction')) S.direction = host.getAttribute('data-dw-direction');
    if (host.getAttribute('data-dw-overlay')) S.overlayColor = host.getAttribute('data-dw-overlay');

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- 分列：轮流发牌，和原版一致 ----
    function buildColumns(n) {
      var cols = [];
      for (var i = 0; i < n; i++) cols.push([]);
      items.forEach(function (item, i) { cols[i % n].push(item); });
      cols.forEach(function (col, i) { if (!col.length) col.push(items[0]); });
      return cols;
    }

    var columnItems = buildColumns(S.columns);
    var columnMeta = [];
    var trackEls = [];
    var offsets = [];
    var velocities = [];
    var containerHeight = 600;

    var plane = document.createElement('div');
    plane.className = 'drift-wall__plane';
    host.textContent = '';
    host.appendChild(plane);

    host.classList.add('drift-wall');
    host.style.setProperty('--dw-perspective', S.perspective + 'px');
    host.style.setProperty('--dw-lift', S.lift + 'px');
    host.style.setProperty('--dw-dim', String(S.dim));
    host.style.setProperty('--dw-overlay', S.overlayColor);
    host.style.setProperty('--dw-edge', Math.max(0, (1 - S.fade) * 100) + '%');
    host.style.setProperty('--dw-radius', S.radius + 'px');
    if (S.direction === 'down') host.classList.add('drift-wall--down');

    function currentColumns() {
      // 视口越窄列越少；再按容器宽度收一下，别让墙离得太开
      var byWidth = Math.round((host.clientWidth || window.innerWidth) / S.columnWidth);
      return Math.max(S.minColumns, Math.min(S.columns, byWidth || S.minColumns));
    }

    function measure() {
      var n = currentColumns();
      if (n !== columnItems.length) columnItems = buildColumns(n);
      containerHeight = host.clientHeight || 600;

      var unit = S.tileHeight + S.gap;
      plane.textContent = '';
      trackEls = [];
      columnMeta = columnItems.map(function (col) {
        var copyHeight = Math.max(unit, col.length * unit);
        return { copyHeight: copyHeight, copies: Math.max(2, Math.ceil((containerHeight * 1.6) / copyHeight) + 1), unit: unit };
      });

      columnItems.forEach(function (col, c) {
        var meta = columnMeta[c];
        var colEl = document.createElement('div');
        colEl.className = 'drift-wall__col';
        var track = document.createElement('div');
        track.className = 'drift-wall__track';

        for (var copy = 0; copy < meta.copies; copy++) {
          col.forEach(function (item, itemIndex) {
            var id = c + '-' + copy + '-' + itemIndex;
            var tile = document.createElement('div');
            tile.className = 'drift-wall__tile';
            tile.setAttribute('data-tile-id', id);
            tile.setAttribute('data-col', String(c));
            // 大图与说明沿用画廊自己的 data 属性，灯箱才认得出这是同一张
            tile.setAttribute('data-full', item.full);
            tile.setAttribute('data-cap', item.cap);
            tile.setAttribute('role', 'button');
            tile.setAttribute('tabindex', '0');
            tile.setAttribute('aria-label', item.cap || item.alt || '插画');
            var inner = document.createElement('span');
            inner.className = 'drift-wall__inner';
            var img = document.createElement('img');
            img.src = item.src;
            img.alt = copy === 0 ? (item.alt || '') : '';
            /* 这里刻意不用 lazy：墙是"点开才搭"的，搭的时候它已经在视口里、
               用户就是来看图的 —— 这时候还懒加载等于把解码推到滚动/帧回调上，
               在帧被节流的情况下会看到一片没画出来的空块。画廊那边仍然是 lazy。 */
            img.loading = 'eager';
            img.decoding = 'async';
            img.draggable = false;
            var ov = document.createElement('span');
            ov.className = 'drift-wall__overlay';
            ov.setAttribute('aria-hidden', 'true');
            inner.appendChild(img);
            inner.appendChild(ov);
            tile.appendChild(inner);
            tile.addEventListener('focus', function () { activate(id, c); });
            tile.addEventListener('blur', function () { if (!wallHovered) release(); });
            track.appendChild(tile);
          });
        }
        colEl.appendChild(track);
        plane.appendChild(colEl);
        trackEls.push(track);
      });

      // 每列给一个不同的初始相位，避免所有列一开始就对齐成一条线
      offsets = columnMeta.map(function (meta, c) { return meta.copyHeight * ((c * 0.37) % 1); });
      velocities = columnItems.map(function () { return 0; });
      host.style.setProperty('--dw-tile-w', S.tileWidth + 'px');
      host.style.setProperty('--dw-tile-h', S.tileHeight + 'px');
      host.style.setProperty('--dw-gap', S.gap + 'px');
      baseVelocities = columnItems.map(function (_, c) {
        var dirSign = S.direction === 'up' ? 1 : -1;
        var altSign = c % 2 === 0 ? 1 : -1;
        return S.speed * columnFactor(c, S.variance) * dirSign * altSign;
      });
      if (reduced) {
        for (var i = 0; i < trackEls.length; i++) {
          trackEls[i].style.transform = 'translate3d(0,' + (-(offsets[i] || 0)) + 'px,0)';
        }
      }
    }

    var baseVelocities = [];
    var activeId = null;
    var wallHovered = false;
    var pointer = { x: 0, y: 0 };
    var damped = { x: 0, y: 0 };
    var lastTs = null;
    var raf = 0;
    var running = false;
    var visible = false;

    function applyPlane(px, py) {
      plane.style.transform =
        'translate(-50%, -50%) scale(1.18) ' +
        'rotateX(' + (S.tilt + py) + 'deg) rotateY(' + (S.turn + px) + 'deg) rotateZ(' + S.roll + 'deg) ' +
        'translateZ(' + (-S.depth) + 'px)';
    }

    function activate(id, col) {
      activeId = id;
      hoveredCol = col;
      var prev = plane.querySelector('.drift-wall__tile.is-active');
      if (prev) prev.classList.remove('is-active');
      var el = plane.querySelector('[data-tile-id="' + id + '"]');
      if (el) el.classList.add('is-active');
    }

    var hoveredCol = -1;

    function release() {
      activeId = null;
      hoveredCol = -1;
      var prev = plane.querySelector('.drift-wall__tile.is-active');
      if (prev) prev.classList.remove('is-active');
    }

    function frame(ts) {
      raf = 0;
      if (!running) return;
      if (lastTs === null) lastTs = ts;
      var dt = Math.min(0.05, Math.max(0, ts - lastTs) / 1000);
      lastTs = ts;

      if (!reduced) {
        var maxTilt = S.parallax * 8;
        var damp = 1 - Math.exp(-dt / 0.12);
        damped.x += (pointer.x * maxTilt - damped.x) * damp;
        damped.y += (-pointer.y * maxTilt - damped.y) * damp;
        applyPlane(damped.x, damped.y);

        for (var c = 0; c < trackEls.length; c++) {
          var meta = columnMeta[c];
          if (!meta) continue;
          var factor = hoveredCol === c ? 0 : 1;
          var target = baseVelocities[c] * factor;
          var ease = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28));
          velocities[c] += (target - velocities[c]) * ease;
          var next = (offsets[c] || 0) + velocities[c] * dt;
          next = ((next % meta.copyHeight) + meta.copyHeight) % meta.copyHeight;
          offsets[c] = next;
          trackEls[c].style.transform = 'translate3d(0,' + (-next) + 'px,0)';
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (raf || !running) return;
      lastTs = null;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastTs = null;
    }

    function onMove(e) {
      var rect = host.getBoundingClientRect();
      if (S.parallax > 0 && !reduced) {
        pointer.x = (e.clientX - rect.left) / rect.width - 0.5;
        pointer.y = (e.clientY - rect.top) / rect.height - 0.5;
      }
      if (!running) return;
      // 命中测试：inner 设了 pointer-events:none，所以这里拿到的总是 .drift-wall__tile
      var hit = document.elementFromPoint(e.clientX, e.clientY);
      var tile = hit && hit.closest ? hit.closest('[data-tile-id]') : null;
      if (!tile) return;
      if (tile.getAttribute('data-tile-id') === activeId) return;
      activate(tile.getAttribute('data-tile-id'), Number(tile.getAttribute('data-col')));
    }

    function onEnter() { wallHovered = true; }
    function onLeave() {
      wallHovered = false;
      pointer.x = 0;
      pointer.y = 0;
      release();
    }

    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerenter', onEnter, { passive: true });
    host.addEventListener('pointerleave', onLeave, { passive: true });

    var ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(function () { measure(); });
      ro.observe(host);
    } else {
      window.addEventListener('resize', measure);
    }

    measure();
    applyPlane(0, 0);

    return {
      start: function () {
        running = true;
        visible = true;
        start();
      },
      stop: function () {
        running = false;
        stop();
      },
      measure: measure,
      release: release,
      isRunning: function () { return !!raf; }
    };
  }

  /* ---------- 读画廊条目：图库加一张，墙上就多一张 ---------- */
  function collectItems() {
    var out = [];
    var nodes = document.querySelectorAll('#artStrip [data-full]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var img = el.querySelector('img');
      var src = img ? (img.getAttribute('src') || '') : (el.getAttribute('data-full') || '');
      if (!src) continue;
      out.push({
        src: src,
        full: el.getAttribute('data-full') || src,
        cap: el.getAttribute('data-cap') || '',
        alt: img ? img.getAttribute('alt') || '' : ''
      });
    }
    return out;
  }

  function boot() {
    var field = document.querySelector('[data-drift-wall]');
    if (!field) return;
    var openBtn = document.querySelector('[data-wall-open]');
    var veil = document.querySelector('[data-wall-veil]');
    var closeBtn = document.querySelector('[data-wall-close]');

    // 低端机 / 省电模式让路：这张墙是纯粹的氛围效果，开按钮都不给，
    // 免得点开一个空浮层。
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    if (saveData || cores <= 4 || mem <= 4) return;

    var items = collectItems();
    if (items.length < 4) return;

    var OPTS = {
      columns: 6,
      tileWidth: 200,
      tileHeight: 268,
      gap: 18,
      radius: 16,
      tilt: 14,
      turn: -12,
      depth: 120,
      speed: 42,
      variance: 0.45,
      parallax: 0.6,
      lift: 70,
      fade: 0.62,
      dim: 0.78
    };

    var wall = null;

    document.documentElement.classList.add('has-drift-wall');

    var lastFocus = null;
    function open() {
      if (!veil) return;
      lastFocus = document.activeElement;
      veil.classList.add('is-open');
      veil.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      /* 第一次打开才搭墙。放在这里而不是页面加载时，有两个实打实的好处：
         · 五十多块画、上百个 <img> 不再在页面加载时就存在 —— 那面墙大多数时候没人看；
         · 也就不会出现"这些图是在一个 visibility:hidden 的容器里被创建的"这种状态。
       下面这行强制样式重算，就是为了保证 mount() 之前浮层已经是"计算出来的可见"，
       而不是"类加上了但样式还没重算"—— 那两种状态下新建的 <img> 命运不一样。 */
      void veil.offsetHeight;
      if (!wall) wall = mount(field, items, OPTS);
      wall.measure();
      wall.start();
      if (closeBtn) closeBtn.focus();
    }
    function close() {
      if (!veil) return;
      veil.classList.remove('is-open');
      veil.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (wall) {          // 关掉就停 rAF：常驻的白烧 CPU
        wall.stop();
        wall.release();
      }
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    if (openBtn) openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (veil) {
      veil.addEventListener('click', function (e) {
        // 点浮层空白处（不是画）就关掉
        if (e.target === veil) close();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && veil && veil.classList.contains('is-open')) close();
    });
    // 浮层里点画 -> 交给既有的灯箱。墙上的每一块都带着 data-full/data-cap，
    // 和画廊用的是同一套属性，所以灯箱能直接认出是同一张图。
    field.addEventListener('click', function (e) {
      var tile = e.target.closest ? e.target.closest('[data-full]') : null;
      if (!tile) return;
      var ev = new CustomEvent('driftwall:pick', {
        bubbles: true,
        detail: { full: tile.getAttribute('data-full'), cap: tile.getAttribute('data-cap') }
      });
      tile.dispatchEvent(ev);
    });
    field.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var tile = e.target.closest ? e.target.closest('[data-full]') : null;
      if (!tile) return;
      e.preventDefault();
      tile.dispatchEvent(new CustomEvent('driftwall:pick', {
        bubbles: true,
        detail: { full: tile.getAttribute('data-full'), cap: tile.getAttribute('data-cap') }
      }));
    });

    window.DriftWall = { open: open, close: close, wall: wall, items: items };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
